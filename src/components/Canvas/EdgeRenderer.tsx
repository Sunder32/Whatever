import { memo } from 'react'
import { Line, Arrow } from 'react-konva'
import type Konva from 'konva'
import type { DiagramNode, DiagramEdge, AnchorPosition } from '@/types'
import { getAnchorPosition } from '@/utils'

interface EdgeRendererProps {
  edge: DiagramEdge
  nodes: DiagramNode[]
  selectedIds: string[]
  onSelect: (e: Konva.KonvaEventObject<MouseEvent>, edgeId: string) => void
}

/**
 * Compute orthogonal (right-angle) polyline points between source and target.
 * Routes through up to 2 intermediate bend points for a clean L-shape or Z-shape path.
 */
function computePolylinePoints(
  sx: number, sy: number, sourceAnchor: AnchorPosition,
  tx: number, ty: number, targetAnchor: AnchorPosition,
): number[] {
  const OFFSET = 30 // minimum offset from the node edge before first bend

  // Determine the initial direction from source anchor
  const pts: number[] = [sx, sy]

  // Horizontal anchors (left/right) exit horizontally, vertical anchors (top/bottom) exit vertically
  const srcHorizontal = sourceAnchor === 'left' || sourceAnchor === 'right'
  const tgtHorizontal = targetAnchor === 'left' || targetAnchor === 'right'

  if (srcHorizontal && tgtHorizontal) {
    // Both horizontal: route with midpoint X or two bends
    const midX = (sx + tx) / 2
    pts.push(midX, sy, midX, ty)
  } else if (!srcHorizontal && !tgtHorizontal) {
    // Both vertical: route with midpoint Y
    const midY = (sy + ty) / 2
    pts.push(sx, midY, tx, midY)
  } else if (srcHorizontal && !tgtHorizontal) {
    // Source horizontal, target vertical: one bend at (tx, sy)
    const exitX = sourceAnchor === 'right' ? Math.max(sx + OFFSET, tx) : Math.min(sx - OFFSET, tx)
    pts.push(exitX, sy, exitX, ty + (targetAnchor === 'top' ? -OFFSET : OFFSET))
    pts.push(tx, ty + (targetAnchor === 'top' ? -OFFSET : OFFSET))
  } else {
    // Source vertical, target horizontal: one bend at (sx, ty)
    const exitY = sourceAnchor === 'bottom' ? Math.max(sy + OFFSET, ty) : Math.min(sy - OFFSET, ty)
    pts.push(sx, exitY, tx + (targetAnchor === 'left' ? -OFFSET : OFFSET), exitY)
    pts.push(tx + (targetAnchor === 'left' ? -OFFSET : OFFSET), ty)
  }

  pts.push(tx, ty)
  return pts
}

/**
 * Renders a single edge (line/arrow/polyline) between two nodes.
 * Extracted from Canvas.tsx for better separation of concerns.
 */
export const EdgeRenderer = memo(function EdgeRenderer({
  edge,
  nodes,
  selectedIds,
  onSelect,
}: EdgeRendererProps) {
  const sourceNode = nodes.find(n => n.id === edge.source)
  const targetNode = nodes.find(n => n.id === edge.target)

  if (!sourceNode || !targetNode) return null

  const sourcePos = getAnchorPosition(
    sourceNode.position.x,
    sourceNode.position.y,
    sourceNode.size.width,
    sourceNode.size.height,
    edge.sourceAnchor
  )

  const targetPos = getAnchorPosition(
    targetNode.position.x,
    targetNode.position.y,
    targetNode.size.width,
    targetNode.size.height,
    edge.targetAnchor
  )

  // Choose point routing based on edge type
  let points: number[]
  if (edge.type === 'polyline') {
    points = computePolylinePoints(
      sourcePos.x, sourcePos.y, edge.sourceAnchor,
      targetPos.x, targetPos.y, edge.targetAnchor,
    )
  } else if (edge.type === 'curve') {
    // Curve uses the same two endpoints; Konva's tension will handle the curve
    points = [sourcePos.x, sourcePos.y, targetPos.x, targetPos.y]
  } else {
    points = [sourcePos.x, sourcePos.y, targetPos.x, targetPos.y]
  }

  const isSelected = selectedIds.includes(edge.id)
  const baseStrokeWidth = edge.style.strokeWidth || 2
  const strokeWidth = isSelected ? baseStrokeWidth + 1 : baseStrokeWidth
  const strokeColor = isSelected ? '#60a5fa' : (edge.style.stroke || '#64748b')

  const edgeHandlers = {
    onClick: (e: Konva.KonvaEventObject<MouseEvent>) => {
      e.cancelBubble = true
      onSelect(e, edge.id)
    },
    onMouseEnter: (e: Konva.KonvaEventObject<MouseEvent>) => {
      const stage = e.target.getStage()
      if (stage) stage.container().style.cursor = 'pointer'
    },
    onMouseLeave: (e: Konva.KonvaEventObject<MouseEvent>) => {
      const stage = e.target.getStage()
      if (stage) stage.container().style.cursor = 'default'
    },
  }

  const getDashPattern = () => {
    if (edge.style.strokeStyle === 'dashed') return [8, 4]
    if (edge.style.strokeStyle === 'dotted') return [2, 4]
    return undefined
  }

  // Curve type uses tension for smooth rendering
  const tension = edge.type === 'curve' ? 0.4 : 0

  if (edge.arrowEnd === 'arrow' || edge.type === 'arrow') {
    return (
      <Arrow
        key={edge.id}
        points={points}
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        opacity={1}
        fill={strokeColor}
        pointerLength={10}
        pointerWidth={8}
        tension={tension}
        lineCap="round"
        lineJoin={edge.type === 'polyline' ? 'miter' : 'round'}
        hitStrokeWidth={16}
        dash={getDashPattern()}
        shadowColor={isSelected ? '#3b82f6' : 'rgba(0,0,0,0.2)'}
        shadowBlur={isSelected ? 6 : 2}
        shadowOpacity={isSelected ? 0.6 : 0.3}
        shadowOffsetY={1}
        {...edgeHandlers}
      />
    )
  }

  return (
    <Line
      key={edge.id}
      points={points}
      stroke={strokeColor}
      strokeWidth={strokeWidth}
      opacity={1}
      tension={tension}
      lineCap="round"
      lineJoin={edge.type === 'polyline' ? 'miter' : 'round'}
      hitStrokeWidth={16}
      dash={getDashPattern()}
      shadowColor={isSelected ? '#3b82f6' : 'rgba(0,0,0,0.2)'}
      shadowBlur={isSelected ? 6 : 2}
      shadowOpacity={isSelected ? 0.6 : 0.3}
      shadowOffsetY={1}
      {...edgeHandlers}
    />
  )
})
