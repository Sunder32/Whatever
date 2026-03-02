import { memo } from 'react'
import { Group, Circle as KonvaCircle } from 'react-konva'
import type Konva from 'konva'
import type { DiagramNode, AnchorPosition, Tool } from '@/types'
import { getAnchorPosition } from '@/utils'

interface ConnectionState {
  isCreating: boolean
  sourceId: string | null
  sourceAnchor: AnchorPosition | null
  tempTargetPos: { x: number; y: number } | null
}

interface AnchorPointsProps {
  node: DiagramNode
  currentTool: Tool
  hoveredNodeId: string | null
  connectionState: ConnectionState
  nearestTarget: { nodeId: string; anchor: AnchorPosition } | null
  onAnchorClick: (nodeId: string, anchor: AnchorPosition, pos: { x: number; y: number }) => void
  onAnchorHover: (nodeId: string, anchor: AnchorPosition) => void
  onAnchorLeave: (nodeId: string, anchor: AnchorPosition) => void
}

/**
 * Renders anchor points on a node for creating connections.
 * Only visible when using line/arrow tool or actively creating a connection.
 */
export const AnchorPoints = memo(function AnchorPoints({
  node,
  currentTool,
  hoveredNodeId,
  connectionState,
  nearestTarget,
  onAnchorClick,
  onAnchorHover,
  onAnchorLeave,
}: AnchorPointsProps) {
  const isConnectionTool = currentTool === 'line' || currentTool === 'arrow'
  const isHoveredWithConnectionTool = hoveredNodeId === node.id && isConnectionTool
  const showAnchors = connectionState.isCreating || isHoveredWithConnectionTool

  if (!showAnchors) return null

  const anchors: AnchorPosition[] = ['top', 'right', 'bottom', 'left']
  const isSourceNode = connectionState.sourceId === node.id

  return (
    <>
      {anchors.map(anchor => {
        const pos = getAnchorPosition(
          node.position.x,
          node.position.y,
          node.size.width,
          node.size.height,
          anchor
        )

        const isSourceAnchor = isSourceNode && connectionState.sourceAnchor === anchor
        const isNearestTarget = nearestTarget?.nodeId === node.id && nearestTarget?.anchor === anchor

        const hitRadius = 20
        const visualRadius = isNearestTarget ? 12 : (isSourceAnchor ? 10 : 8)
        const innerSize = isNearestTarget ? 4 : 3

        const outerColor = isNearestTarget ? '#22d3ee' : (isSourceAnchor ? '#4ade80' : 'rgba(96, 165, 250, 0.9)')
        const innerColor = '#ffffff'

        return (
          <Group key={`anchor-${node.id}-${anchor}`}>
            {/* Glow effect for source or target */}
            {(isNearestTarget || isSourceAnchor) && (
              <KonvaCircle
                x={pos.x}
                y={pos.y}
                radius={24}
                fill="transparent"
                stroke={isSourceAnchor ? '#4ade80' : '#22d3ee'}
                strokeWidth={2}
                opacity={0.6}
                dash={[4, 4]}
                listening={false}
              />
            )}
            {/* Large clickable hit area */}
            <KonvaCircle
              x={pos.x}
              y={pos.y}
              radius={hitRadius}
              fill="rgba(96, 165, 250, 0.1)"
              stroke="transparent"
              onClick={(e: Konva.KonvaEventObject<MouseEvent>) => {
                e.cancelBubble = true
                onAnchorClick(node.id, anchor, pos)
              }}
              onMouseEnter={(e: Konva.KonvaEventObject<MouseEvent>) => {
                e.cancelBubble = true
                const stage = e.target.getStage()
                if (stage) stage.container().style.cursor = 'crosshair'
                onAnchorHover(node.id, anchor)
              }}
              onMouseLeave={(e: Konva.KonvaEventObject<MouseEvent>) => {
                e.cancelBubble = true
                const stage = e.target.getStage()
                if (stage && !connectionState.isCreating) {
                  stage.container().style.cursor = 'default'
                }
                onAnchorLeave(node.id, anchor)
              }}
            />
            {/* Visual outer ring */}
            <KonvaCircle
              x={pos.x}
              y={pos.y}
              radius={visualRadius}
              fill={outerColor}
              stroke={isNearestTarget ? '#ffffff' : 'rgba(255,255,255,0.8)'}
              strokeWidth={isNearestTarget ? 2.5 : 2}
              shadowColor={isNearestTarget ? '#22d3ee' : '#3b82f6'}
              shadowBlur={isNearestTarget ? 16 : 6}
              shadowOpacity={isNearestTarget ? 0.9 : 0.5}
              listening={false}
            />
            {/* Inner dot */}
            <KonvaCircle
              x={pos.x}
              y={pos.y}
              radius={innerSize}
              fill={innerColor}
              listening={false}
            />
          </Group>
        )
      })}
    </>
  )
})
