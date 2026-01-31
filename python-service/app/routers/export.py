from fastapi import APIRouter, HTTPException, Response, status
from fastapi.responses import StreamingResponse
import io

from app.models import (
    ExportRequest, ExportResponse,
    ThumbnailRequest, ThumbnailResponse,
    ValidationRequest, ValidationResponse,
    OptimizeRequest, OptimizeResponse,
    ExportFormat, DiagramContent
)
from app.services import export_service

router = APIRouter(prefix="/export", tags=["Export"])


@router.post("/", response_model=ExportResponse)
async def export_diagram(request: ExportRequest) -> ExportResponse:
    result = await export_service.export(request)
    if not result.success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result.error
        )
    return result


@router.post("/download")
async def export_and_download(request: ExportRequest):
    result = await export_service.export(request)
    
    if not result.success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result.error
        )
    
    return StreamingResponse(
        io.BytesIO(result.data),
        media_type=result.mimeType,
        headers={
            "Content-Disposition": f"attachment; filename={result.fileName}"
        }
    )


@router.post("/png")
async def export_png(request: ExportRequest):
    request.format = ExportFormat.PNG
    result = await export_service.export(request)
    
    if not result.success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result.error
        )
    
    return Response(
        content=result.data,
        media_type="image/png",
        headers={
            "Content-Disposition": "attachment; filename=diagram.png"
        }
    )


@router.post("/svg")
async def export_svg(request: ExportRequest):
    request.format = ExportFormat.SVG
    result = await export_service.export(request)
    
    if not result.success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result.error
        )
    
    return Response(
        content=result.data,
        media_type="image/svg+xml",
        headers={
            "Content-Disposition": "attachment; filename=diagram.svg"
        }
    )


@router.post("/pdf")
async def export_pdf(request: ExportRequest):
    request.format = ExportFormat.PDF
    result = await export_service.export(request)
    
    if not result.success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result.error
        )
    
    return Response(
        content=result.data,
        media_type="application/pdf",
        headers={
            "Content-Disposition": "attachment; filename=diagram.pdf"
        }
    )


@router.post("/jpeg")
async def export_jpeg(request: ExportRequest):
    request.format = ExportFormat.JPEG
    result = await export_service.export(request)
    
    if not result.success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result.error
        )
    
    return Response(
        content=result.data,
        media_type="image/jpeg",
        headers={
            "Content-Disposition": "attachment; filename=diagram.jpg"
        }
    )


@router.post("/webp")
async def export_webp(request: ExportRequest):
    request.format = ExportFormat.WEBP
    result = await export_service.export(request)
    
    if not result.success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result.error
        )
    
    return Response(
        content=result.data,
        media_type="image/webp",
        headers={
            "Content-Disposition": "attachment; filename=diagram.webp"
        }
    )


@router.post("/thumbnail", response_model=ThumbnailResponse)
async def generate_thumbnail(request: ThumbnailRequest) -> ThumbnailResponse:
    result = await export_service.generate_thumbnail(request)
    if not result.success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result.error
        )
    return result


@router.post("/validate", response_model=ValidationResponse)
async def validate_content(request: ValidationRequest) -> ValidationResponse:
    errors = []
    warnings = []
    
    content = request.content
    
    if not content.nodes:
        warnings.append("Diagram has no nodes")
    
    node_ids = {node.id for node in content.nodes}
    
    for i, node in enumerate(content.nodes):
        if not node.id:
            errors.append(f"Node at index {i} has no ID")
        
        if node.size.width <= 0 or node.size.height <= 0:
            errors.append(f"Node '{node.id}' has invalid size")
        
        if node.style and hasattr(node.style, 'opacity'):
            if node.style.opacity < 0 or node.style.opacity > 1:
                errors.append(f"Node '{node.id}' has invalid opacity")
    
    edge_ids = set()
    for i, edge in enumerate(content.edges):
        if not edge.id:
            errors.append(f"Edge at index {i} has no ID")
        
        if edge.id in edge_ids:
            errors.append(f"Duplicate edge ID: {edge.id}")
        edge_ids.add(edge.id)
        
        if edge.source not in node_ids:
            errors.append(f"Edge '{edge.id}' references non-existent source node '{edge.source}'")
        
        if edge.target not in node_ids:
            errors.append(f"Edge '{edge.id}' references non-existent target node '{edge.target}'")
        
        if edge.source == edge.target:
            warnings.append(f"Edge '{edge.id}' is a self-loop")
    
    layer_ids = {layer.id for layer in content.layers}
    for node in content.nodes:
        if node.layerId and node.layerId not in layer_ids:
            warnings.append(f"Node '{node.id}' references non-existent layer '{node.layerId}'")
    
    return ValidationResponse(
        valid=len(errors) == 0,
        errors=errors,
        warnings=warnings
    )


@router.post("/optimize", response_model=OptimizeResponse)
async def optimize_content(request: OptimizeRequest) -> OptimizeResponse:
    try:
        content = request.content
        removed_nodes = 0
        removed_edges = 0
        removed_layers = 0
        
        nodes = list(content.nodes)
        edges = list(content.edges)
        layers = list(content.layers)
        
        if request.removeHiddenElements:
            original_node_count = len(nodes)
            nodes = [n for n in nodes if n.visible]
            removed_nodes += original_node_count - len(nodes)
            
            visible_node_ids = {n.id for n in nodes}
            original_edge_count = len(edges)
            edges = [e for e in edges if e.source in visible_node_ids and e.target in visible_node_ids]
            removed_edges += original_edge_count - len(edges)
        
        if request.removeEmptyLayers:
            used_layer_ids = {n.layerId for n in nodes if n.layerId}
            original_layer_count = len(layers)
            layers = [l for l in layers if l.id in used_layer_ids or l.id == "default"]
            removed_layers += original_layer_count - len(layers)
        
        if request.simplifyEdges:
            seen_edges = set()
            unique_edges = []
            for edge in edges:
                edge_key = (edge.source, edge.target)
                if edge_key not in seen_edges:
                    seen_edges.add(edge_key)
                    unique_edges.append(edge)
                else:
                    removed_edges += 1
            edges = unique_edges
        
        optimized_content = DiagramContent(
            nodes=nodes,
            edges=edges,
            layers=layers
        )
        
        return OptimizeResponse(
            success=True,
            content=optimized_content,
            removedNodes=removed_nodes,
            removedEdges=removed_edges,
            removedLayers=removed_layers
        )
        
    except Exception as e:
        return OptimizeResponse(
            success=False,
            error=str(e)
        )


@router.get("/formats")
async def list_export_formats():
    formats = [
        {
            "id": "png",
            "name": "PNG",
            "mimeType": "image/png",
            "extension": ".png",
            "supportsTransparency": True,
            "supportsQuality": False
        },
        {
            "id": "svg",
            "name": "SVG",
            "mimeType": "image/svg+xml",
            "extension": ".svg",
            "supportsTransparency": True,
            "supportsQuality": False,
            "isVector": True
        },
        {
            "id": "pdf",
            "name": "PDF",
            "mimeType": "application/pdf",
            "extension": ".pdf",
            "supportsTransparency": False,
            "supportsQuality": False,
            "isVector": True
        },
        {
            "id": "jpeg",
            "name": "JPEG",
            "mimeType": "image/jpeg",
            "extension": ".jpg",
            "supportsTransparency": False,
            "supportsQuality": True
        },
        {
            "id": "webp",
            "name": "WebP",
            "mimeType": "image/webp",
            "extension": ".webp",
            "supportsTransparency": True,
            "supportsQuality": True
        }
    ]
    
    return {
        "success": True,
        "formats": formats
    }
