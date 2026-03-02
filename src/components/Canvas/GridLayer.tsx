import { memo } from 'react'
import { Line } from 'react-konva'
import type { GridSettings, Position } from '@/types'

interface GridLayerProps {
  grid: GridSettings | undefined
  width: number
  height: number
  zoom: number
  pan: Position
}

/**
 * Renders the grid overlay on the canvas.
 * Memoized to prevent re-renders when other canvas state changes.
 */
export const GridLayer = memo(function GridLayer({ grid, width, height, zoom, pan }: GridLayerProps) {
  if (!grid?.enabled) return null

  const gridLines = []
  const gridSize = grid.size
  const largeGridSize = gridSize * 5
  const startX = Math.floor(-pan.x / zoom / gridSize) * gridSize
  const startY = Math.floor(-pan.y / zoom / gridSize) * gridSize
  const endX = startX + width / zoom + gridSize * 2
  const endY = startY + height / zoom + gridSize * 2

  const minorOpacity = 0.15
  const majorOpacity = 0.25

  for (let x = startX; x < endX; x += gridSize) {
    const isMajor = x % largeGridSize === 0
    gridLines.push(
      <Line
        key={`v-${x}`}
        points={[x, startY, x, endY]}
        stroke={grid.color}
        strokeWidth={isMajor ? 1 : 0.5}
        opacity={isMajor ? majorOpacity : minorOpacity}
      />
    )
  }

  for (let y = startY; y < endY; y += gridSize) {
    const isMajor = y % largeGridSize === 0
    gridLines.push(
      <Line
        key={`h-${y}`}
        points={[startX, y, endX, y]}
        stroke={grid.color}
        strokeWidth={isMajor ? 1 : 0.5}
        opacity={isMajor ? majorOpacity : minorOpacity}
      />
    )
  }

  return <>{gridLines}</>
})
