import io
import os
import json
import math
import base64
from typing import Dict, List, Any, Optional, Tuple
from PIL import Image, ImageDraw, ImageFont
import svgwrite
from reportlab.lib.pagesizes import A4, letter, landscape
from reportlab.pdfgen import canvas as pdf_canvas
from reportlab.lib.units import mm

from app.models import (
    DiagramNode, DiagramEdge, DiagramContent, Layer,
    ExportFormat, ExportRequest, ExportResponse,
    ThumbnailRequest, ThumbnailResponse
)
from app.config import settings


class ExportService:
    def __init__(self):
        self.temp_dir = settings.export_temp_dir
        self.max_width = settings.export_max_width
        self.max_height = settings.export_max_height
        self.default_dpi = settings.export_default_dpi
        os.makedirs(self.temp_dir, exist_ok=True)

    def _get_bounds(self, content: DiagramContent, padding: int = 20) -> Tuple[float, float, float, float]:
        if not content.nodes:
            return 0, 0, 800, 600
        
        min_x = float('inf')
        min_y = float('inf')
        max_x = float('-inf')
        max_y = float('-inf')
        
        for node in content.nodes:
            if not node.visible:
                continue
            
            x = node.position.x
            y = node.position.y
            w = node.size.width
            h = node.size.height
            
            min_x = min(min_x, x)
            min_y = min(min_y, y)
            max_x = max(max_x, x + w)
            max_y = max(max_y, y + h)
        
        if min_x == float('inf'):
            return 0, 0, 800, 600
        
        return min_x - padding, min_y - padding, max_x + padding, max_y + padding

    def _get_visible_nodes(self, content: DiagramContent) -> List[DiagramNode]:
        visible_layer_ids = {layer.id for layer in content.layers if layer.visible}
        
        visible_nodes = []
        for node in content.nodes:
            if not node.visible:
                continue
            if node.layerId and node.layerId not in visible_layer_ids:
                continue
            visible_nodes.append(node)
        
        return visible_nodes

    def _hex_to_rgb(self, hex_color: str) -> Tuple[int, int, int]:
        hex_color = hex_color.lstrip('#')
        if len(hex_color) == 3:
            hex_color = ''.join([c*2 for c in hex_color])
        return tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))

    def _hex_to_rgba(self, hex_color: str, opacity: float = 1.0) -> Tuple[int, int, int, int]:
        r, g, b = self._hex_to_rgb(hex_color)
        return (r, g, b, int(opacity * 255))

    async def export(self, request: ExportRequest) -> ExportResponse:
        try:
            if not request.content:
                return ExportResponse(
                    success=False,
                    error="Content is required for export"
                )
            
            if request.format == ExportFormat.PNG:
                return await self._export_png(request)
            elif request.format == ExportFormat.SVG:
                return await self._export_svg(request)
            elif request.format == ExportFormat.PDF:
                return await self._export_pdf(request)
            elif request.format == ExportFormat.JPEG:
                return await self._export_jpeg(request)
            elif request.format == ExportFormat.WEBP:
                return await self._export_webp(request)
            else:
                return ExportResponse(
                    success=False,
                    error=f"Unsupported export format: {request.format}"
                )
                
        except Exception as e:
            return ExportResponse(
                success=False,
                error=f"Export failed: {str(e)}"
            )

    async def _export_png(self, request: ExportRequest) -> ExportResponse:
        img = self._render_to_image(request)
        
        buffer = io.BytesIO()
        img.save(buffer, format='PNG', optimize=True)
        buffer.seek(0)
        
        return ExportResponse(
            success=True,
            data=buffer.getvalue(),
            mimeType="image/png",
            fileName="diagram.png"
        )

    async def _export_jpeg(self, request: ExportRequest) -> ExportResponse:
        img = self._render_to_image(request)
        
        if img.mode == 'RGBA':
            background = Image.new('RGB', img.size, self._hex_to_rgb(request.backgroundColor or '#ffffff'))
            background.paste(img, mask=img.split()[3])
            img = background
        
        buffer = io.BytesIO()
        img.save(buffer, format='JPEG', quality=request.quality, optimize=True)
        buffer.seek(0)
        
        return ExportResponse(
            success=True,
            data=buffer.getvalue(),
            mimeType="image/jpeg",
            fileName="diagram.jpg"
        )

    async def _export_webp(self, request: ExportRequest) -> ExportResponse:
        img = self._render_to_image(request)
        
        buffer = io.BytesIO()
        img.save(buffer, format='WEBP', quality=request.quality, lossless=request.quality >= 100)
        buffer.seek(0)
        
        return ExportResponse(
            success=True,
            data=buffer.getvalue(),
            mimeType="image/webp",
            fileName="diagram.webp"
        )

    def _render_to_image(self, request: ExportRequest) -> Image.Image:
        content = request.content
        visible_nodes = self._get_visible_nodes(content)
        
        bounds = self._get_bounds(content, request.padding)
        min_x, min_y, max_x, max_y = bounds
        
        width = int((max_x - min_x) * request.scale)
        height = int((max_y - min_y) * request.scale)
        
        if request.width:
            width = request.width
        if request.height:
            height = request.height
        
        width = min(width, self.max_width)
        height = min(height, self.max_height)
        
        if request.transparent:
            img = Image.new('RGBA', (width, height), (0, 0, 0, 0))
        else:
            bg_color = self._hex_to_rgb(request.backgroundColor or '#ffffff')
            img = Image.new('RGBA', (width, height), (*bg_color, 255))
        
        draw = ImageDraw.Draw(img)
        
        if request.includeGrid:
            self._draw_grid(draw, width, height, 20)
        
        offset_x = -min_x * request.scale
        offset_y = -min_y * request.scale
        
        sorted_nodes = sorted(visible_nodes, key=lambda n: (
            next((l.order for l in content.layers if l.id == n.layerId), 0)
        ))
        
        for node in sorted_nodes:
            self._draw_node(draw, node, offset_x, offset_y, request.scale)
        
        visible_node_ids = {n.id for n in visible_nodes}
        for edge in content.edges:
            if edge.source in visible_node_ids and edge.target in visible_node_ids:
                self._draw_edge(draw, edge, content.nodes, offset_x, offset_y, request.scale)
        
        return img

    def _draw_grid(self, draw: ImageDraw.Draw, width: int, height: int, grid_size: int):
        grid_color = (200, 200, 200, 100)
        
        for x in range(0, width, grid_size):
            draw.line([(x, 0), (x, height)], fill=grid_color, width=1)
        
        for y in range(0, height, grid_size):
            draw.line([(0, y), (width, y)], fill=grid_color, width=1)

    def _draw_node(self, draw: ImageDraw.Draw, node: DiagramNode, 
                   offset_x: float, offset_y: float, scale: float):
        x = node.position.x * scale + offset_x
        y = node.position.y * scale + offset_y
        w = node.size.width * scale
        h = node.size.height * scale
        
        style = node.style or {}
        fill = style.fill if hasattr(style, 'fill') and style.fill else '#ffffff'
        stroke = style.stroke if hasattr(style, 'stroke') and style.stroke else '#000000'
        stroke_width = int((style.strokeWidth if hasattr(style, 'strokeWidth') and style.strokeWidth else 1) * scale)
        opacity = style.opacity if hasattr(style, 'opacity') and style.opacity else 1.0
        corner_radius = (style.cornerRadius if hasattr(style, 'cornerRadius') and style.cornerRadius else 0) * scale
        
        fill_color = self._hex_to_rgba(fill, opacity)
        stroke_color = self._hex_to_rgba(stroke, opacity)
        
        if node.type == 'rectangle':
            if corner_radius > 0:
                draw.rounded_rectangle(
                    [x, y, x + w, y + h],
                    radius=corner_radius,
                    fill=fill_color,
                    outline=stroke_color,
                    width=stroke_width
                )
            else:
                draw.rectangle(
                    [x, y, x + w, y + h],
                    fill=fill_color,
                    outline=stroke_color,
                    width=stroke_width
                )
        
        elif node.type == 'ellipse':
            draw.ellipse(
                [x, y, x + w, y + h],
                fill=fill_color,
                outline=stroke_color,
                width=stroke_width
            )
        
        elif node.type == 'diamond':
            cx = x + w / 2
            cy = y + h / 2
            points = [
                (cx, y),
                (x + w, cy),
                (cx, y + h),
                (x, cy)
            ]
            draw.polygon(points, fill=fill_color, outline=stroke_color, width=stroke_width)
        
        elif node.type == 'triangle':
            cx = x + w / 2
            points = [
                (cx, y),
                (x + w, y + h),
                (x, y + h)
            ]
            draw.polygon(points, fill=fill_color, outline=stroke_color, width=stroke_width)
        
        else:
            draw.rectangle(
                [x, y, x + w, y + h],
                fill=fill_color,
                outline=stroke_color,
                width=stroke_width
            )
        
        if node.label:
            try:
                font = ImageFont.truetype("arial.ttf", int(14 * scale))
            except:
                font = ImageFont.load_default()
            
            text_bbox = draw.textbbox((0, 0), node.label, font=font)
            text_width = text_bbox[2] - text_bbox[0]
            text_height = text_bbox[3] - text_bbox[1]
            
            text_x = x + (w - text_width) / 2
            text_y = y + (h - text_height) / 2
            
            draw.text((text_x, text_y), node.label, fill=(0, 0, 0, 255), font=font)

    def _draw_edge(self, draw: ImageDraw.Draw, edge: DiagramEdge, 
                   nodes: List[DiagramNode], offset_x: float, offset_y: float, scale: float):
        source_node = next((n for n in nodes if n.id == edge.source), None)
        target_node = next((n for n in nodes if n.id == edge.target), None)
        
        if not source_node or not target_node:
            return
        
        sx = (source_node.position.x + source_node.size.width / 2) * scale + offset_x
        sy = (source_node.position.y + source_node.size.height / 2) * scale + offset_y
        tx = (target_node.position.x + target_node.size.width / 2) * scale + offset_x
        ty = (target_node.position.y + target_node.size.height / 2) * scale + offset_y
        
        style = edge.style or {}
        stroke = style.stroke if hasattr(style, 'stroke') and style.stroke else '#000000'
        stroke_width = int((style.strokeWidth if hasattr(style, 'strokeWidth') and style.strokeWidth else 1) * scale)
        opacity = style.opacity if hasattr(style, 'opacity') and style.opacity else 1.0
        
        stroke_color = self._hex_to_rgba(stroke, opacity)
        
        draw.line([(sx, sy), (tx, ty)], fill=stroke_color, width=stroke_width)
        
        arrow_end = style.arrowEnd if hasattr(style, 'arrowEnd') else 'arrow'
        if arrow_end == 'arrow':
            self._draw_arrow(draw, sx, sy, tx, ty, stroke_color, stroke_width * 3)

    def _draw_arrow(self, draw: ImageDraw.Draw, x1: float, y1: float, 
                    x2: float, y2: float, color: Tuple, size: float):
        angle = math.atan2(y2 - y1, x2 - x1)
        
        arrow_angle = math.pi / 6
        
        ax1 = x2 - size * math.cos(angle - arrow_angle)
        ay1 = y2 - size * math.sin(angle - arrow_angle)
        ax2 = x2 - size * math.cos(angle + arrow_angle)
        ay2 = y2 - size * math.sin(angle + arrow_angle)
        
        draw.polygon([(x2, y2), (ax1, ay1), (ax2, ay2)], fill=color)

    async def _export_svg(self, request: ExportRequest) -> ExportResponse:
        content = request.content
        visible_nodes = self._get_visible_nodes(content)
        
        bounds = self._get_bounds(content, request.padding)
        min_x, min_y, max_x, max_y = bounds
        
        width = (max_x - min_x) * request.scale
        height = (max_y - min_y) * request.scale
        
        if request.width:
            width = request.width
        if request.height:
            height = request.height
        
        dwg = svgwrite.Drawing(size=(f"{width}px", f"{height}px"))
        dwg.viewbox(minx=0, miny=0, width=width, height=height)
        
        if not request.transparent:
            bg_color = request.backgroundColor or '#ffffff'
            dwg.add(dwg.rect(insert=(0, 0), size=(width, height), fill=bg_color))
        
        if request.includeGrid:
            grid_group = dwg.g(id='grid', stroke='#cccccc', stroke_width=0.5)
            for x in range(0, int(width), 20):
                grid_group.add(dwg.line(start=(x, 0), end=(x, height)))
            for y in range(0, int(height), 20):
                grid_group.add(dwg.line(start=(0, y), end=(width, y)))
            dwg.add(grid_group)
        
        offset_x = -min_x * request.scale
        offset_y = -min_y * request.scale
        
        edges_group = dwg.g(id='edges')
        visible_node_ids = {n.id for n in visible_nodes}
        for edge in content.edges:
            if edge.source in visible_node_ids and edge.target in visible_node_ids:
                self._add_svg_edge(dwg, edges_group, edge, content.nodes, offset_x, offset_y, request.scale)
        dwg.add(edges_group)
        
        nodes_group = dwg.g(id='nodes')
        for node in visible_nodes:
            self._add_svg_node(dwg, nodes_group, node, offset_x, offset_y, request.scale)
        dwg.add(nodes_group)
        
        svg_content = dwg.tostring()
        
        return ExportResponse(
            success=True,
            data=svg_content.encode('utf-8'),
            mimeType="image/svg+xml",
            fileName="diagram.svg"
        )

    def _add_svg_node(self, dwg, group, node: DiagramNode, 
                      offset_x: float, offset_y: float, scale: float):
        x = node.position.x * scale + offset_x
        y = node.position.y * scale + offset_y
        w = node.size.width * scale
        h = node.size.height * scale
        
        style = node.style or {}
        fill = style.fill if hasattr(style, 'fill') and style.fill else '#ffffff'
        stroke = style.stroke if hasattr(style, 'stroke') and style.stroke else '#000000'
        stroke_width = (style.strokeWidth if hasattr(style, 'strokeWidth') and style.strokeWidth else 1) * scale
        opacity = style.opacity if hasattr(style, 'opacity') and style.opacity else 1.0
        corner_radius = (style.cornerRadius if hasattr(style, 'cornerRadius') and style.cornerRadius else 0) * scale
        
        if node.type == 'rectangle':
            rect = dwg.rect(
                insert=(x, y),
                size=(w, h),
                rx=corner_radius,
                ry=corner_radius,
                fill=fill,
                stroke=stroke,
                stroke_width=stroke_width,
                opacity=opacity
            )
            group.add(rect)
        
        elif node.type == 'ellipse':
            ellipse = dwg.ellipse(
                center=(x + w/2, y + h/2),
                r=(w/2, h/2),
                fill=fill,
                stroke=stroke,
                stroke_width=stroke_width,
                opacity=opacity
            )
            group.add(ellipse)
        
        elif node.type == 'diamond':
            cx = x + w / 2
            cy = y + h / 2
            points = [(cx, y), (x + w, cy), (cx, y + h), (x, cy)]
            polygon = dwg.polygon(
                points=points,
                fill=fill,
                stroke=stroke,
                stroke_width=stroke_width,
                opacity=opacity
            )
            group.add(polygon)
        
        elif node.type == 'triangle':
            cx = x + w / 2
            points = [(cx, y), (x + w, y + h), (x, y + h)]
            polygon = dwg.polygon(
                points=points,
                fill=fill,
                stroke=stroke,
                stroke_width=stroke_width,
                opacity=opacity
            )
            group.add(polygon)
        
        else:
            rect = dwg.rect(
                insert=(x, y),
                size=(w, h),
                fill=fill,
                stroke=stroke,
                stroke_width=stroke_width,
                opacity=opacity
            )
            group.add(rect)
        
        if node.label:
            text = dwg.text(
                node.label,
                insert=(x + w/2, y + h/2),
                text_anchor='middle',
                dominant_baseline='middle',
                font_size=14 * scale,
                font_family='Arial'
            )
            group.add(text)

    def _add_svg_edge(self, dwg, group, edge: DiagramEdge, 
                      nodes: List[DiagramNode], offset_x: float, offset_y: float, scale: float):
        source_node = next((n for n in nodes if n.id == edge.source), None)
        target_node = next((n for n in nodes if n.id == edge.target), None)
        
        if not source_node or not target_node:
            return
        
        sx = (source_node.position.x + source_node.size.width / 2) * scale + offset_x
        sy = (source_node.position.y + source_node.size.height / 2) * scale + offset_y
        tx = (target_node.position.x + target_node.size.width / 2) * scale + offset_x
        ty = (target_node.position.y + target_node.size.height / 2) * scale + offset_y
        
        style = edge.style or {}
        stroke = style.stroke if hasattr(style, 'stroke') and style.stroke else '#000000'
        stroke_width = (style.strokeWidth if hasattr(style, 'strokeWidth') and style.strokeWidth else 1) * scale
        opacity = style.opacity if hasattr(style, 'opacity') and style.opacity else 1.0
        
        line = dwg.line(
            start=(sx, sy),
            end=(tx, ty),
            stroke=stroke,
            stroke_width=stroke_width,
            opacity=opacity
        )
        group.add(line)

    async def _export_pdf(self, request: ExportRequest) -> ExportResponse:
        content = request.content
        
        bounds = self._get_bounds(content, request.padding)
        min_x, min_y, max_x, max_y = bounds
        
        width = (max_x - min_x) * request.scale
        height = (max_y - min_y) * request.scale
        
        if request.width:
            width = request.width
        if request.height:
            height = request.height
        
        buffer = io.BytesIO()
        c = pdf_canvas.Canvas(buffer, pagesize=(width, height))
        
        if not request.transparent:
            bg_color = self._hex_to_rgb(request.backgroundColor or '#ffffff')
            c.setFillColorRGB(bg_color[0]/255, bg_color[1]/255, bg_color[2]/255)
            c.rect(0, 0, width, height, fill=1, stroke=0)
        
        offset_x = -min_x * request.scale
        offset_y = -min_y * request.scale
        
        visible_nodes = self._get_visible_nodes(content)
        
        for node in visible_nodes:
            self._draw_pdf_node(c, node, offset_x, offset_y, height, request.scale)
        
        visible_node_ids = {n.id for n in visible_nodes}
        for edge in content.edges:
            if edge.source in visible_node_ids and edge.target in visible_node_ids:
                self._draw_pdf_edge(c, edge, content.nodes, offset_x, offset_y, height, request.scale)
        
        c.save()
        buffer.seek(0)
        
        return ExportResponse(
            success=True,
            data=buffer.getvalue(),
            mimeType="application/pdf",
            fileName="diagram.pdf"
        )

    def _draw_pdf_node(self, c, node: DiagramNode, 
                       offset_x: float, offset_y: float, page_height: float, scale: float):
        x = node.position.x * scale + offset_x
        y = page_height - (node.position.y * scale + offset_y + node.size.height * scale)
        w = node.size.width * scale
        h = node.size.height * scale
        
        style = node.style or {}
        fill = style.fill if hasattr(style, 'fill') and style.fill else '#ffffff'
        stroke = style.stroke if hasattr(style, 'stroke') and style.stroke else '#000000'
        stroke_width = (style.strokeWidth if hasattr(style, 'strokeWidth') and style.strokeWidth else 1) * scale
        
        fill_rgb = self._hex_to_rgb(fill)
        stroke_rgb = self._hex_to_rgb(stroke)
        
        c.setFillColorRGB(fill_rgb[0]/255, fill_rgb[1]/255, fill_rgb[2]/255)
        c.setStrokeColorRGB(stroke_rgb[0]/255, stroke_rgb[1]/255, stroke_rgb[2]/255)
        c.setLineWidth(stroke_width)
        
        if node.type in ['rectangle', 'default']:
            c.rect(x, y, w, h, fill=1, stroke=1)
        elif node.type == 'ellipse':
            c.ellipse(x, y, x + w, y + h, fill=1, stroke=1)
        else:
            c.rect(x, y, w, h, fill=1, stroke=1)
        
        if node.label:
            c.setFillColorRGB(0, 0, 0)
            c.drawCentredString(x + w/2, y + h/2, node.label)

    def _draw_pdf_edge(self, c, edge: DiagramEdge, nodes: List[DiagramNode],
                       offset_x: float, offset_y: float, page_height: float, scale: float):
        source_node = next((n for n in nodes if n.id == edge.source), None)
        target_node = next((n for n in nodes if n.id == edge.target), None)
        
        if not source_node or not target_node:
            return
        
        sx = (source_node.position.x + source_node.size.width / 2) * scale + offset_x
        sy = page_height - ((source_node.position.y + source_node.size.height / 2) * scale + offset_y)
        tx = (target_node.position.x + target_node.size.width / 2) * scale + offset_x
        ty = page_height - ((target_node.position.y + target_node.size.height / 2) * scale + offset_y)
        
        style = edge.style or {}
        stroke = style.stroke if hasattr(style, 'stroke') and style.stroke else '#000000'
        stroke_width = (style.strokeWidth if hasattr(style, 'strokeWidth') and style.strokeWidth else 1) * scale
        
        stroke_rgb = self._hex_to_rgb(stroke)
        c.setStrokeColorRGB(stroke_rgb[0]/255, stroke_rgb[1]/255, stroke_rgb[2]/255)
        c.setLineWidth(stroke_width)
        
        c.line(sx, sy, tx, ty)

    async def generate_thumbnail(self, request: ThumbnailRequest) -> ThumbnailResponse:
        try:
            export_request = ExportRequest(
                content=request.content,
                format=request.format,
                width=request.width,
                height=request.height,
                scale=1.0,
                quality=80,
                transparent=False,
                padding=10
            )
            
            result = await self.export(export_request)
            
            if not result.success:
                return ThumbnailResponse(
                    success=False,
                    error=result.error
                )
            
            thumbnail_base64 = base64.b64encode(result.data).decode('utf-8')
            
            return ThumbnailResponse(
                success=True,
                thumbnail=thumbnail_base64,
                mimeType=result.mimeType
            )
            
        except Exception as e:
            return ThumbnailResponse(
                success=False,
                error=f"Thumbnail generation failed: {str(e)}"
            )


export_service = ExportService()
