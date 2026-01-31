from fastapi import APIRouter, HTTPException, status
from app.models import (
    LayoutRequest, LayoutResponse,
    AnalysisRequest, AnalysisResponse,
    DiagramNode, DiagramEdge
)
from app.services import layout_service

router = APIRouter(prefix="/layout", tags=["Layout"])


@router.post("/apply", response_model=LayoutResponse)
async def apply_layout(request: LayoutRequest) -> LayoutResponse:
    result = await layout_service.apply_layout(request)
    if not result.success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result.error
        )
    return result


@router.post("/force-directed", response_model=LayoutResponse)
async def apply_force_directed_layout(request: LayoutRequest) -> LayoutResponse:
    from app.models import LayoutAlgorithm
    request.algorithm = LayoutAlgorithm.FORCE_DIRECTED
    result = await layout_service.apply_layout(request)
    if not result.success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result.error
        )
    return result


@router.post("/hierarchical", response_model=LayoutResponse)
async def apply_hierarchical_layout(request: LayoutRequest) -> LayoutResponse:
    from app.models import LayoutAlgorithm
    request.algorithm = LayoutAlgorithm.HIERARCHICAL
    result = await layout_service.apply_layout(request)
    if not result.success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result.error
        )
    return result


@router.post("/circular", response_model=LayoutResponse)
async def apply_circular_layout(request: LayoutRequest) -> LayoutResponse:
    from app.models import LayoutAlgorithm
    request.algorithm = LayoutAlgorithm.CIRCULAR
    result = await layout_service.apply_layout(request)
    if not result.success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result.error
        )
    return result


@router.post("/grid", response_model=LayoutResponse)
async def apply_grid_layout(request: LayoutRequest) -> LayoutResponse:
    from app.models import LayoutAlgorithm
    request.algorithm = LayoutAlgorithm.GRID
    result = await layout_service.apply_layout(request)
    if not result.success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result.error
        )
    return result


@router.post("/tree", response_model=LayoutResponse)
async def apply_tree_layout(request: LayoutRequest) -> LayoutResponse:
    from app.models import LayoutAlgorithm
    request.algorithm = LayoutAlgorithm.TREE
    result = await layout_service.apply_layout(request)
    if not result.success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result.error
        )
    return result


@router.post("/radial", response_model=LayoutResponse)
async def apply_radial_layout(request: LayoutRequest) -> LayoutResponse:
    from app.models import LayoutAlgorithm
    request.algorithm = LayoutAlgorithm.RADIAL
    result = await layout_service.apply_layout(request)
    if not result.success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result.error
        )
    return result


@router.post("/analyze", response_model=AnalysisResponse)
async def analyze_diagram(request: AnalysisRequest) -> AnalysisResponse:
    try:
        nodes = request.content.nodes
        edges = request.content.edges
        
        analysis = layout_service.analyze_graph(nodes, edges)
        
        return AnalysisResponse(
            success=True,
            nodeCount=analysis["nodeCount"],
            edgeCount=analysis["edgeCount"],
            layerCount=len(request.content.layers),
            connectedComponents=analysis["connectedComponents"],
            isolatedNodes=analysis["isolatedNodes"],
            density=analysis["density"],
            averageDegree=analysis["averageDegree"],
            maxDegree=analysis["maxDegree"],
            hasCycles=analysis["hasCycles"],
            longestPath=analysis["longestPath"]
        )
    except Exception as e:
        return AnalysisResponse(
            success=False,
            error=str(e)
        )


@router.get("/algorithms")
async def list_algorithms():
    from app.models import LayoutAlgorithm
    
    algorithms = [
        {
            "id": LayoutAlgorithm.FORCE_DIRECTED.value,
            "name": "Force-Directed",
            "description": "Physics-based layout using spring simulation",
            "options": {
                "iterations": "Number of simulation iterations (default: 50)",
                "k": "Optimal distance between nodes",
                "seed": "Random seed for reproducibility"
            }
        },
        {
            "id": LayoutAlgorithm.HIERARCHICAL.value,
            "name": "Hierarchical",
            "description": "Layered layout for directed graphs",
            "options": {
                "direction": "TB (top-bottom), BT, LR, RL",
                "levelSpacing": "Vertical spacing between levels",
                "nodeSpacing": "Horizontal spacing between nodes"
            }
        },
        {
            "id": LayoutAlgorithm.CIRCULAR.value,
            "name": "Circular",
            "description": "Nodes arranged in a circle",
            "options": {
                "radius": "Circle radius",
                "startAngle": "Starting angle in radians"
            }
        },
        {
            "id": LayoutAlgorithm.GRID.value,
            "name": "Grid",
            "description": "Nodes arranged in a regular grid",
            "options": {
                "spacing": "Distance between nodes",
                "columns": "Number of columns (auto-calculated if not specified)"
            }
        },
        {
            "id": LayoutAlgorithm.TREE.value,
            "name": "Tree",
            "description": "Hierarchical tree layout",
            "options": {
                "levelSpacing": "Vertical spacing between levels",
                "siblingSpacing": "Horizontal spacing between siblings"
            }
        },
        {
            "id": LayoutAlgorithm.RADIAL.value,
            "name": "Radial",
            "description": "Nodes arranged in concentric circles from root",
            "options": {
                "center": "Center point coordinates [x, y]",
                "radiusStep": "Distance between concentric circles"
            }
        },
        {
            "id": LayoutAlgorithm.SPECTRAL.value,
            "name": "Spectral",
            "description": "Layout based on graph Laplacian eigenvectors",
            "options": {
                "scale": "Scale factor for positions"
            }
        },
        {
            "id": LayoutAlgorithm.KAMADA_KAWAI.value,
            "name": "Kamada-Kawai",
            "description": "Energy minimization layout algorithm",
            "options": {
                "scale": "Scale factor for positions"
            }
        },
        {
            "id": LayoutAlgorithm.SPRING.value,
            "name": "Spring",
            "description": "Spring-based force-directed layout",
            "options": {
                "k": "Optimal distance between nodes",
                "iterations": "Number of iterations",
                "seed": "Random seed"
            }
        }
    ]
    
    return {
        "success": True,
        "algorithms": algorithms
    }
