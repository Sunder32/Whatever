export interface Position {
  x: number
  y: number
}

export interface Size {
  width: number
  height: number
}

export interface NodeStyle {
  fill: string
  stroke: string
  strokeWidth: number
  opacity: number
  shadowColor?: string
  shadowBlur?: number
  shadowOffsetX?: number
  shadowOffsetY?: number
  cornerRadius?: number
}

export interface TextStyle {
  fontSize: number
  fontFamily: string
  fontWeight: 'normal' | 'bold'
  fontStyle: 'normal' | 'italic'
  color: string
  align: 'left' | 'center' | 'right'
  lineHeight: number
  letterSpacing: number
}

export interface EdgeStyle {
  stroke: string
  strokeWidth: number
  strokeStyle: 'solid' | 'dashed' | 'dotted'
  opacity: number
}

export type NodeType = 'rectangle' | 'ellipse' | 'diamond' | 'triangle' | 'star' | 'hexagon' | 'cylinder' | 'cloud' | 'callout' | 'note' | 'container' | 'image' | 'freehand' | 'custom'
export type EdgeType = 'line' | 'polyline' | 'curve' | 'arrow'
export type ArrowType = 'none' | 'arrow' | 'diamond' | 'circle'
export type AnchorPosition = 'top' | 'right' | 'bottom' | 'left' | 'center'
export type RelationType = 'one-to-one' | 'one-to-many' | 'many-to-one' | 'many-to-many'

export interface DiagramNode {
  id: string
  type: NodeType
  position: Position
  size: Size
  style: NodeStyle
  text: string
  textStyle: TextStyle
  rotation: number
  locked: boolean
  visible: boolean
  zIndex: number
  metadata: Record<string, unknown>
  // For nodes - linked imported data
  linkedData?: Array<{
    source?: string
    data: Record<string, unknown> | unknown
  }>
  // For image nodes
  imageData?: string
  // For freehand nodes
  pathData?: string
  // For container - child elements
  children?: string[]
  isContainer?: boolean
}

export interface DiagramEdge {
  id: string
  type: EdgeType
  source: string
  target: string
  sourceAnchor: AnchorPosition
  targetAnchor: AnchorPosition
  points: Position[]
  style: EdgeStyle
  arrowStart: ArrowType
  arrowEnd: ArrowType
  label: string
  labelPosition: 'start' | 'middle' | 'end'
  relationType?: RelationType  // For database diagrams: one-to-one, one-to-many, etc.
}

export interface TextElement {
  id: string
  position: Position
  text: string
  style: TextStyle
  attachedTo?: string
}

export interface ImageElement {
  id: string
  position: Position
  size: Size
  data?: string
  assetId?: string
}

export interface Group {
  id: string
  name: string
  children: string[]
  collapsed: boolean
}

export interface Layer {
  id: string
  name: string
  visible: boolean
  locked: boolean
  elements: string[]
}

export interface GridSettings {
  enabled: boolean
  size: number
  snap: boolean
  color: string
}

export interface CanvasState {
  zoom: number
  pan: Position
  grid: GridSettings
  selectedElements: string[]
  viewport: Size
}

export interface Asset {
  id: string
  name: string
  mimeType: string
  data: string
  hash: string
}

export interface Thumbnail {
  data: string
  width: number
  height: number
}

export interface Encryption {
  encrypted: boolean
  method: string
  salt?: string
  iv?: string
}

export interface SchemaMetadata {
  name: string
  description: string
  author: string
  created: string
  modified: string
  fileSize: number
  tags: string[]
}

export interface SchemaContent {
  nodes: DiagramNode[]
  edges: DiagramEdge[]
  textElements: TextElement[]
  images: ImageElement[]
  groups: Group[]
  layers: Layer[]
}

export interface WtvFile {
  id: string
  projectId?: string  // Link to project for multi-project support
  formatVersion: string
  metadata: SchemaMetadata
  content: SchemaContent
  canvasState: CanvasState
  assets: Asset[]
  thumbnail?: Thumbnail
  encryption: Encryption
}
