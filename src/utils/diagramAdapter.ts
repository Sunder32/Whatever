import { v4 as uuidv4 } from 'uuid'
import type { WtvFile, DiagramNode, DiagramEdge, NodeType as WtvNodeType } from '@/types'
import type { FlowNode, FlowEdge, CustomNodeData, CustomEdgeData } from '@/stores/graphStore'
import { MarkerType } from '@xyflow/react'

/**
 * Адаптер для конвертации между форматами WtvFile и React Flow
 * 
 * WtvFile - формат хранения файлов (IndexedDB, сервер)
 * FlowNode/FlowEdge - формат React Flow (UI)
 */

// =============================================================================
// WtvFile -> React Flow (при загрузке файла)
// =============================================================================

export function wtvNodeToFlowNode(node: DiagramNode): FlowNode {
  return {
    id: node.id,
    type: 'custom',
    position: { x: node.position.x, y: node.position.y },
    data: {
      label: node.text || '',
      nodeType: node.type as WtvNodeType,
      fill: node.style.fill,
      stroke: node.style.stroke,
      strokeWidth: node.style.strokeWidth,
      opacity: node.style.opacity,
      cornerRadius: node.style.cornerRadius || 8,
      textColor: node.textStyle.color,
      fontSize: node.textStyle.fontSize,
      fontFamily: node.textStyle.fontFamily,
      locked: node.locked,
      isContainer: node.isContainer,
      children: node.children,
      imageData: node.imageData,
      pathData: node.pathData,
      metadata: node.metadata,
    },
    style: {
      width: node.size.width,
      height: node.size.height,
    },
    zIndex: node.zIndex,
    hidden: !node.visible,
  }
}

export function wtvEdgeToFlowEdge(edge: DiagramEdge): FlowEdge {
  // Конвертация типа стрелки
  const getMarker = (arrowType: string) => {
    switch (arrowType) {
      case 'arrow': return { type: MarkerType.ArrowClosed }
      case 'diamond': return { type: MarkerType.Arrow } // Приближение
      case 'circle': return { type: MarkerType.Arrow } // Приближение
      default: return undefined
    }
  }
  
  // Конвертация стиля линии
  const getStrokeStyle = (style: string): 'solid' | 'dashed' | 'dotted' => {
    if (style === 'dashed') return 'dashed'
    if (style === 'dotted') return 'dotted'
    return 'solid'
  }
  
  return {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    sourceHandle: edge.sourceAnchor,
    targetHandle: edge.targetAnchor,
    type: edge.type === 'curve' ? 'smoothstep' : edge.type === 'polyline' ? 'step' : 'smoothstep',
    markerStart: getMarker(edge.arrowStart),
    markerEnd: getMarker(edge.arrowEnd),
    label: edge.label,
    data: {
      label: edge.label,
      strokeStyle: getStrokeStyle(edge.style.strokeStyle),
      animated: false,
    },
    style: {
      stroke: edge.style.stroke,
      strokeWidth: edge.style.strokeWidth,
      opacity: edge.style.opacity,
      strokeDasharray: edge.style.strokeStyle === 'dashed' ? '8 4' : 
                       edge.style.strokeStyle === 'dotted' ? '2 2' : undefined,
    },
  }
}

export function wtvFileToFlowData(file: WtvFile): { nodes: FlowNode[]; edges: FlowEdge[] } {
  const nodes = file.content.nodes.map(wtvNodeToFlowNode)
  const edges = file.content.edges.map(wtvEdgeToFlowEdge)
  
  return { nodes, edges }
}

// =============================================================================
// React Flow -> WtvFile (при сохранении)
// =============================================================================

export function flowNodeToWtvNode(node: FlowNode): DiagramNode {
  const data = node.data as CustomNodeData
  const width = (node.measured?.width || node.style?.width || 200) as number
  const height = (node.measured?.height || node.style?.height || 100) as number
  
  return {
    id: node.id,
    type: data.nodeType,
    position: { x: node.position.x, y: node.position.y },
    size: { width, height },
    style: {
      fill: data.fill,
      stroke: data.stroke,
      strokeWidth: data.strokeWidth,
      opacity: data.opacity,
      cornerRadius: data.cornerRadius,
    },
    text: data.label,
    textStyle: {
      fontSize: data.fontSize,
      fontFamily: data.fontFamily,
      fontWeight: 'normal',
      fontStyle: 'normal',
      color: data.textColor,
      align: 'center',
      lineHeight: 1.4,
      letterSpacing: 0,
    },
    rotation: 0,
    locked: data.locked,
    visible: !node.hidden,
    zIndex: node.zIndex || 0,
    metadata: data.metadata || {},
    imageData: data.imageData,
    pathData: data.pathData,
    children: data.children,
    isContainer: data.isContainer,
  }
}

export function flowEdgeToWtvEdge(edge: FlowEdge): DiagramEdge {
  const data = edge.data as CustomEdgeData | undefined
  
  // Конвертация типа связи
  const getEdgeType = (type?: string): 'line' | 'polyline' | 'curve' | 'arrow' => {
    if (type === 'step') return 'polyline'
    if (type === 'straight') return 'line'
    return 'curve'
  }
  
  // Конвертация маркера в тип стрелки
  const getArrowType = (marker?: { type: MarkerType }): 'none' | 'arrow' | 'diamond' | 'circle' => {
    if (!marker) return 'none'
    if (marker.type === MarkerType.ArrowClosed) return 'arrow'
    if (marker.type === MarkerType.Arrow) return 'arrow'
    return 'none'
  }
  
  return {
    id: edge.id,
    type: getEdgeType(edge.type),
    source: edge.source,
    target: edge.target,
    sourceAnchor: (edge.sourceHandle as 'top' | 'right' | 'bottom' | 'left') || 'bottom',
    targetAnchor: (edge.targetHandle as 'top' | 'right' | 'bottom' | 'left') || 'top',
    points: [],
    style: {
      stroke: (edge.style?.stroke as string) || '#64748b',
      strokeWidth: (edge.style?.strokeWidth as number) || 2,
      strokeStyle: data?.strokeStyle || 'solid',
      opacity: (edge.style?.opacity as number) || 1,
    },
    arrowStart: getArrowType(edge.markerStart as { type: MarkerType } | undefined),
    arrowEnd: getArrowType(edge.markerEnd as { type: MarkerType } | undefined),
    label: data?.label || '',
    labelPosition: 'middle',
  }
}

export function flowDataToWtvContent(nodes: FlowNode[], edges: FlowEdge[]): {
  nodes: DiagramNode[]
  edges: DiagramEdge[]
} {
  return {
    nodes: nodes.map(flowNodeToWtvNode),
    edges: edges.map(flowEdgeToWtvEdge),
  }
}

// =============================================================================
// Утилиты синхронизации
// =============================================================================

/**
 * Обновляет WtvFile с текущими данными из React Flow
 */
export function syncFlowToWtvFile(
  file: WtvFile,
  nodes: FlowNode[],
  edges: FlowEdge[],
  viewport?: { x: number; y: number; zoom: number }
): WtvFile {
  const content = flowDataToWtvContent(nodes, edges)
  
  return {
    ...file,
    metadata: {
      ...file.metadata,
      modified: new Date().toISOString(),
    },
    content: {
      ...file.content,
      nodes: content.nodes,
      edges: content.edges,
    },
    canvasState: viewport ? {
      ...file.canvasState,
      zoom: viewport.zoom,
      pan: { x: viewport.x, y: viewport.y },
    } : file.canvasState,
  }
}

/**
 * Создает новый пустой WtvFile
 */
export function createEmptyWtvFile(name: string, projectId?: string): WtvFile {
  return {
    id: uuidv4(),
    projectId,
    formatVersion: '1.0.0',
    metadata: {
      name,
      description: '',
      author: '',
      created: new Date().toISOString(),
      modified: new Date().toISOString(),
      fileSize: 0,
      tags: [],
    },
    content: {
      nodes: [],
      edges: [],
      textElements: [],
      images: [],
      groups: [],
      layers: [
        {
          id: uuidv4(),
          name: 'Layer 1',
          visible: true,
          locked: false,
          elements: [],
        }
      ],
    },
    canvasState: {
      zoom: 1,
      pan: { x: 0, y: 0 },
      grid: {
        enabled: true,
        size: 20,
        snap: true,
        color: '#e5e7eb',
      },
      selectedElements: [],
      viewport: { width: 0, height: 0 },
    },
    assets: [],
    encryption: {
      encrypted: false,
      method: '',
    },
  }
}
