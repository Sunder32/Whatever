import math
from typing import Dict, List, Any, Optional, Tuple
import networkx as nx
import numpy as np
from scipy.spatial.distance import cdist

from app.models import (
    DiagramNode, DiagramEdge, LayoutAlgorithm, 
    LayoutRequest, LayoutResponse, Position
)


class LayoutService:
    def __init__(self):
        self.default_node_spacing = 100
        self.default_level_spacing = 150
        self.default_iterations = 50

    def _build_graph(self, nodes: List[DiagramNode], edges: List[DiagramEdge]) -> nx.DiGraph:
        G = nx.DiGraph()
        
        for node in nodes:
            G.add_node(
                node.id,
                x=node.position.x,
                y=node.position.y,
                width=node.size.width,
                height=node.size.height
            )
        
        for edge in edges:
            if edge.source in G.nodes and edge.target in G.nodes:
                G.add_edge(edge.source, edge.target)
        
        return G

    def _extract_positions(self, G: nx.DiGraph, layout: Dict[str, np.ndarray], scale: float = 1.0) -> Dict[str, Dict[str, float]]:
        positions = {}
        for node_id, pos in layout.items():
            positions[node_id] = {
                "x": float(pos[0] * scale),
                "y": float(pos[1] * scale)
            }
        return positions

    def _normalize_positions(self, positions: Dict[str, Dict[str, float]], 
                            width: float = 1000, height: float = 800,
                            padding: float = 50) -> Dict[str, Dict[str, float]]:
        if not positions:
            return positions
        
        xs = [p["x"] for p in positions.values()]
        ys = [p["y"] for p in positions.values()]
        
        min_x, max_x = min(xs), max(xs)
        min_y, max_y = min(ys), max(ys)
        
        range_x = max_x - min_x if max_x != min_x else 1
        range_y = max_y - min_y if max_y != min_y else 1
        
        normalized = {}
        for node_id, pos in positions.items():
            normalized[node_id] = {
                "x": padding + ((pos["x"] - min_x) / range_x) * (width - 2 * padding),
                "y": padding + ((pos["y"] - min_y) / range_y) * (height - 2 * padding)
            }
        
        return normalized

    async def apply_layout(self, request: LayoutRequest) -> LayoutResponse:
        try:
            G = self._build_graph(request.nodes, request.edges)
            
            if len(G.nodes) == 0:
                return LayoutResponse(success=True, nodes=[])
            
            options = request.options or {}
            
            if request.algorithm == LayoutAlgorithm.FORCE_DIRECTED:
                positions = self._force_directed_layout(G, options)
            elif request.algorithm == LayoutAlgorithm.HIERARCHICAL:
                positions = self._hierarchical_layout(G, options)
            elif request.algorithm == LayoutAlgorithm.CIRCULAR:
                positions = self._circular_layout(G, options)
            elif request.algorithm == LayoutAlgorithm.GRID:
                positions = self._grid_layout(G, options)
            elif request.algorithm == LayoutAlgorithm.TREE:
                positions = self._tree_layout(G, options)
            elif request.algorithm == LayoutAlgorithm.RADIAL:
                positions = self._radial_layout(G, options)
            elif request.algorithm == LayoutAlgorithm.SPECTRAL:
                positions = self._spectral_layout(G, options)
            elif request.algorithm == LayoutAlgorithm.KAMADA_KAWAI:
                positions = self._kamada_kawai_layout(G, options)
            elif request.algorithm == LayoutAlgorithm.SPRING:
                positions = self._spring_layout(G, options)
            else:
                return LayoutResponse(
                    success=False,
                    error=f"Unsupported layout algorithm: {request.algorithm}"
                )
            
            width = options.get("width", 1000)
            height = options.get("height", 800)
            padding = options.get("padding", 50)
            
            normalized = self._normalize_positions(positions, width, height, padding)
            
            result_nodes = []
            for node in request.nodes:
                if node.id in normalized:
                    result_nodes.append({
                        "id": node.id,
                        "position": normalized[node.id]
                    })
            
            return LayoutResponse(success=True, nodes=result_nodes)
            
        except Exception as e:
            return LayoutResponse(
                success=False,
                error=f"Layout calculation failed: {str(e)}"
            )

    def _force_directed_layout(self, G: nx.DiGraph, options: Dict[str, Any]) -> Dict[str, Dict[str, float]]:
        k = options.get("k", None)
        iterations = options.get("iterations", self.default_iterations)
        seed = options.get("seed", 42)
        
        pos = nx.spring_layout(G, k=k, iterations=iterations, seed=seed)
        return self._extract_positions(G, pos, scale=500)

    def _hierarchical_layout(self, G: nx.DiGraph, options: Dict[str, Any]) -> Dict[str, Dict[str, float]]:
        level_spacing = options.get("levelSpacing", self.default_level_spacing)
        node_spacing = options.get("nodeSpacing", self.default_node_spacing)
        direction = options.get("direction", "TB")
        
        levels = {}
        visited = set()
        
        roots = [n for n in G.nodes() if G.in_degree(n) == 0]
        if not roots:
            roots = list(G.nodes())[:1]
        
        def assign_levels(node, level):
            if node in visited:
                return
            visited.add(node)
            levels[node] = max(levels.get(node, 0), level)
            for successor in G.successors(node):
                assign_levels(successor, level + 1)
        
        for root in roots:
            assign_levels(root, 0)
        
        for node in G.nodes():
            if node not in levels:
                levels[node] = 0
        
        level_nodes = {}
        for node, level in levels.items():
            if level not in level_nodes:
                level_nodes[level] = []
            level_nodes[level].append(node)
        
        positions = {}
        for level, nodes in level_nodes.items():
            total_width = len(nodes) * node_spacing
            start_x = -total_width / 2
            
            for i, node in enumerate(sorted(nodes)):
                if direction == "TB":
                    positions[node] = {"x": start_x + i * node_spacing, "y": level * level_spacing}
                elif direction == "BT":
                    positions[node] = {"x": start_x + i * node_spacing, "y": -level * level_spacing}
                elif direction == "LR":
                    positions[node] = {"x": level * level_spacing, "y": start_x + i * node_spacing}
                elif direction == "RL":
                    positions[node] = {"x": -level * level_spacing, "y": start_x + i * node_spacing}
        
        return positions

    def _circular_layout(self, G: nx.DiGraph, options: Dict[str, Any]) -> Dict[str, Dict[str, float]]:
        radius = options.get("radius", 300)
        start_angle = options.get("startAngle", 0)
        
        pos = nx.circular_layout(G, scale=radius)
        return self._extract_positions(G, pos)

    def _grid_layout(self, G: nx.DiGraph, options: Dict[str, Any]) -> Dict[str, Dict[str, float]]:
        spacing = options.get("spacing", self.default_node_spacing)
        columns = options.get("columns", None)
        
        nodes = list(G.nodes())
        n = len(nodes)
        
        if columns is None:
            columns = max(1, int(math.sqrt(n)))
        
        positions = {}
        for i, node in enumerate(nodes):
            row = i // columns
            col = i % columns
            positions[node] = {
                "x": col * spacing,
                "y": row * spacing
            }
        
        return positions

    def _tree_layout(self, G: nx.DiGraph, options: Dict[str, Any]) -> Dict[str, Dict[str, float]]:
        level_spacing = options.get("levelSpacing", self.default_level_spacing)
        sibling_spacing = options.get("siblingSpacing", self.default_node_spacing)
        
        roots = [n for n in G.nodes() if G.in_degree(n) == 0]
        if not roots:
            roots = list(G.nodes())[:1] if G.nodes() else []
        
        positions = {}
        current_x = [0]
        
        def layout_subtree(node, level, visited):
            if node in visited:
                return
            visited.add(node)
            
            children = [c for c in G.successors(node) if c not in visited]
            
            if not children:
                positions[node] = {"x": current_x[0], "y": level * level_spacing}
                current_x[0] += sibling_spacing
            else:
                child_positions = []
                for child in children:
                    layout_subtree(child, level + 1, visited)
                    if child in positions:
                        child_positions.append(positions[child]["x"])
                
                if child_positions:
                    center_x = (min(child_positions) + max(child_positions)) / 2
                else:
                    center_x = current_x[0]
                    current_x[0] += sibling_spacing
                
                positions[node] = {"x": center_x, "y": level * level_spacing}
        
        visited = set()
        for root in roots:
            layout_subtree(root, 0, visited)
        
        for node in G.nodes():
            if node not in positions:
                positions[node] = {"x": current_x[0], "y": 0}
                current_x[0] += sibling_spacing
        
        return positions

    def _radial_layout(self, G: nx.DiGraph, options: Dict[str, Any]) -> Dict[str, Dict[str, float]]:
        center = options.get("center", (0, 0))
        radius_step = options.get("radiusStep", 100)
        
        roots = [n for n in G.nodes() if G.in_degree(n) == 0]
        if not roots:
            roots = list(G.nodes())[:1] if G.nodes() else []
        
        levels = {}
        for root in roots:
            for node, level in nx.single_source_shortest_path_length(G, root).items():
                levels[node] = min(levels.get(node, float('inf')), level)
        
        for node in G.nodes():
            if node not in levels:
                levels[node] = 0
        
        level_nodes = {}
        for node, level in levels.items():
            if level not in level_nodes:
                level_nodes[level] = []
            level_nodes[level].append(node)
        
        positions = {}
        for level, nodes in level_nodes.items():
            if level == 0:
                for i, node in enumerate(nodes):
                    if len(nodes) == 1:
                        positions[node] = {"x": center[0], "y": center[1]}
                    else:
                        angle = 2 * math.pi * i / len(nodes)
                        positions[node] = {
                            "x": center[0] + radius_step * math.cos(angle),
                            "y": center[1] + radius_step * math.sin(angle)
                        }
            else:
                radius = level * radius_step
                for i, node in enumerate(nodes):
                    angle = 2 * math.pi * i / len(nodes)
                    positions[node] = {
                        "x": center[0] + radius * math.cos(angle),
                        "y": center[1] + radius * math.sin(angle)
                    }
        
        return positions

    def _spectral_layout(self, G: nx.DiGraph, options: Dict[str, Any]) -> Dict[str, Dict[str, float]]:
        scale = options.get("scale", 500)
        
        try:
            pos = nx.spectral_layout(G, scale=scale)
            return self._extract_positions(G, pos)
        except:
            return self._force_directed_layout(G, options)

    def _kamada_kawai_layout(self, G: nx.DiGraph, options: Dict[str, Any]) -> Dict[str, Dict[str, float]]:
        scale = options.get("scale", 500)
        
        try:
            pos = nx.kamada_kawai_layout(G, scale=scale)
            return self._extract_positions(G, pos)
        except:
            return self._force_directed_layout(G, options)

    def _spring_layout(self, G: nx.DiGraph, options: Dict[str, Any]) -> Dict[str, Dict[str, float]]:
        k = options.get("k", None)
        iterations = options.get("iterations", self.default_iterations)
        seed = options.get("seed", 42)
        
        pos = nx.spring_layout(G, k=k, iterations=iterations, seed=seed, scale=500)
        return self._extract_positions(G, pos)

    def analyze_graph(self, nodes: List[DiagramNode], edges: List[DiagramEdge]) -> Dict[str, Any]:
        G = self._build_graph(nodes, edges)
        
        undirected = G.to_undirected()
        connected_components = nx.number_connected_components(undirected)
        
        isolated = [n for n in G.nodes() if G.degree(n) == 0]
        
        n = G.number_of_nodes()
        m = G.number_of_edges()
        max_edges = n * (n - 1)
        density = m / max_edges if max_edges > 0 else 0
        
        degrees = [d for n, d in G.degree()]
        avg_degree = sum(degrees) / len(degrees) if degrees else 0
        max_degree = max(degrees) if degrees else 0
        
        try:
            has_cycles = not nx.is_directed_acyclic_graph(G)
        except:
            has_cycles = False
        
        longest_path = 0
        if not has_cycles and G.number_of_nodes() > 0:
            try:
                longest_path = nx.dag_longest_path_length(G)
            except:
                pass
        
        return {
            "nodeCount": n,
            "edgeCount": m,
            "connectedComponents": connected_components,
            "isolatedNodes": isolated,
            "density": density,
            "averageDegree": avg_degree,
            "maxDegree": max_degree,
            "hasCycles": has_cycles,
            "longestPath": longest_path
        }


layout_service = LayoutService()
