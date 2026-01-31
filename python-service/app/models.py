from pydantic import BaseModel, Field
from typing import Optional, Any
from datetime import datetime
from uuid import UUID
from enum import Enum


class ExportFormat(str, Enum):
    PNG = "png"
    SVG = "svg"
    PDF = "pdf"
    JPEG = "jpeg"
    WEBP = "webp"


class LayoutAlgorithm(str, Enum):
    FORCE_DIRECTED = "force_directed"
    HIERARCHICAL = "hierarchical"
    CIRCULAR = "circular"
    GRID = "grid"
    TREE = "tree"
    RADIAL = "radial"
    SPECTRAL = "spectral"
    KAMADA_KAWAI = "kamada_kawai"
    SPRING = "spring"


class EncryptionAlgorithm(str, Enum):
    AES_256_GCM = "aes-256-gcm"
    AES_256_CBC = "aes-256-cbc"
    CHACHA20_POLY1305 = "chacha20-poly1305"


class Position(BaseModel):
    x: float
    y: float


class Size(BaseModel):
    width: float
    height: float


class NodeStyle(BaseModel):
    fill: Optional[str] = "#ffffff"
    stroke: Optional[str] = "#000000"
    strokeWidth: Optional[float] = 1.0
    opacity: Optional[float] = 1.0
    cornerRadius: Optional[float] = 0.0
    shadow: Optional[bool] = False
    shadowColor: Optional[str] = "#000000"
    shadowBlur: Optional[float] = 5.0
    shadowOffsetX: Optional[float] = 2.0
    shadowOffsetY: Optional[float] = 2.0


class EdgeStyle(BaseModel):
    stroke: Optional[str] = "#000000"
    strokeWidth: Optional[float] = 1.0
    strokeDasharray: Optional[str] = None
    opacity: Optional[float] = 1.0
    arrowStart: Optional[str] = None
    arrowEnd: Optional[str] = "arrow"


class DiagramNode(BaseModel):
    id: str
    type: str
    position: Position
    size: Size
    rotation: Optional[float] = 0.0
    style: Optional[NodeStyle] = None
    data: Optional[dict[str, Any]] = None
    label: Optional[str] = None
    layerId: Optional[str] = None
    locked: Optional[bool] = False
    visible: Optional[bool] = True


class DiagramEdge(BaseModel):
    id: str
    source: str
    target: str
    sourceHandle: Optional[str] = None
    targetHandle: Optional[str] = None
    type: Optional[str] = "default"
    style: Optional[EdgeStyle] = None
    data: Optional[dict[str, Any]] = None
    label: Optional[str] = None
    points: Optional[list[Position]] = None


class Layer(BaseModel):
    id: str
    name: str
    visible: bool = True
    locked: bool = False
    opacity: float = 1.0
    order: int = 0


class CanvasState(BaseModel):
    zoom: float = 1.0
    panX: float = 0.0
    panY: float = 0.0
    gridEnabled: bool = True
    gridSize: int = 20
    snapToGrid: bool = True


class DiagramContent(BaseModel):
    nodes: list[DiagramNode] = []
    edges: list[DiagramEdge] = []
    layers: list[Layer] = []


class WtvFile(BaseModel):
    formatVersion: str = "1.0.0"
    metadata: dict[str, Any] = {}
    content: DiagramContent
    canvasState: Optional[CanvasState] = None
    assets: Optional[dict[str, Any]] = None
    encryption: Optional[dict[str, Any]] = None


class ExportRequest(BaseModel):
    schemaId: Optional[UUID] = None
    content: Optional[DiagramContent] = None
    format: ExportFormat = ExportFormat.PNG
    width: Optional[int] = None
    height: Optional[int] = None
    scale: float = Field(default=1.0, ge=0.1, le=10.0)
    quality: int = Field(default=90, ge=1, le=100)
    backgroundColor: Optional[str] = "#ffffff"
    transparent: bool = False
    padding: int = Field(default=20, ge=0, le=200)
    includeGrid: bool = False


class ExportResponse(BaseModel):
    success: bool
    data: Optional[bytes] = None
    mimeType: Optional[str] = None
    fileName: Optional[str] = None
    error: Optional[str] = None


class LayoutRequest(BaseModel):
    nodes: list[DiagramNode]
    edges: list[DiagramEdge]
    algorithm: LayoutAlgorithm = LayoutAlgorithm.FORCE_DIRECTED
    options: Optional[dict[str, Any]] = None


class LayoutResponse(BaseModel):
    success: bool
    nodes: Optional[list[dict[str, Any]]] = None
    error: Optional[str] = None


class EncryptRequest(BaseModel):
    data: str
    password: str
    algorithm: EncryptionAlgorithm = EncryptionAlgorithm.AES_256_GCM


class EncryptResponse(BaseModel):
    success: bool
    encryptedData: Optional[str] = None
    salt: Optional[str] = None
    iv: Optional[str] = None
    tag: Optional[str] = None
    algorithm: Optional[str] = None
    error: Optional[str] = None


class DecryptRequest(BaseModel):
    encryptedData: str
    password: str
    salt: str
    iv: str
    tag: Optional[str] = None
    algorithm: EncryptionAlgorithm = EncryptionAlgorithm.AES_256_GCM


class DecryptResponse(BaseModel):
    success: bool
    data: Optional[str] = None
    error: Optional[str] = None


class HealthResponse(BaseModel):
    status: str
    version: str
    timestamp: datetime
    services: dict[str, str]


class ValidationRequest(BaseModel):
    content: DiagramContent


class ValidationResponse(BaseModel):
    valid: bool
    errors: list[str] = []
    warnings: list[str] = []


class AnalysisRequest(BaseModel):
    content: DiagramContent


class AnalysisResponse(BaseModel):
    success: bool
    nodeCount: int = 0
    edgeCount: int = 0
    layerCount: int = 0
    connectedComponents: int = 0
    isolatedNodes: list[str] = []
    density: float = 0.0
    averageDegree: float = 0.0
    maxDegree: int = 0
    hasCycles: bool = False
    longestPath: int = 0
    error: Optional[str] = None


class ThumbnailRequest(BaseModel):
    content: DiagramContent
    width: int = Field(default=200, ge=50, le=800)
    height: int = Field(default=150, ge=50, le=600)
    format: ExportFormat = ExportFormat.PNG


class ThumbnailResponse(BaseModel):
    success: bool
    thumbnail: Optional[str] = None
    mimeType: Optional[str] = None
    error: Optional[str] = None


class OptimizeRequest(BaseModel):
    content: DiagramContent
    removeHiddenElements: bool = True
    mergeOverlappingNodes: bool = False
    simplifyEdges: bool = True
    removeEmptyLayers: bool = True


class OptimizeResponse(BaseModel):
    success: bool
    content: Optional[DiagramContent] = None
    removedNodes: int = 0
    removedEdges: int = 0
    removedLayers: int = 0
    error: Optional[str] = None
