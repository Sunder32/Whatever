import { memo } from 'react'
import { Rect, Ellipse, Line, RegularPolygon, Text } from 'react-konva'
import type { DiagramNode } from '@/types'
import { ImageNodeContent } from './ImageNodeContent'

interface ShapeStyle {
  fill: string
  stroke: string
  strokeWidth: number
  shadowColor: string
  shadowBlur: number
  shadowOffsetX: number
  shadowOffsetY: number
  opacity: number
}

interface ShapeRendererProps {
  node: DiagramNode
  style: ShapeStyle
}

/**
 * Renders a single node shape based on its type.
 * Extracted from Canvas.tsx to reduce monolith size and improve memoization.
 */
export const ShapeRenderer = memo(function ShapeRenderer({ node, style }: ShapeRendererProps) {
  const { ...baseStyle } = style

  const textElement = node.text ? (
    <Text
      text={node.text}
      x={0}
      y={0}
      width={node.size.width}
      height={node.size.height}
      fontSize={node.textStyle?.fontSize || 14}
      fontFamily={node.textStyle?.fontFamily || 'Arial'}
      fontStyle={node.textStyle?.fontStyle || 'normal'}
      fill={node.textStyle?.color || '#1f2937'}
      align={node.textStyle?.align || 'center'}
      verticalAlign="middle"
      padding={8}
      listening={false}
    />
  ) : null

  switch (node.type) {
    case 'rectangle':
      return (
        <>
          <Rect
            width={node.size.width}
            height={node.size.height}
            cornerRadius={node.style.cornerRadius || 8}
            {...baseStyle}
          />
          {textElement}
        </>
      )

    case 'ellipse':
      return (
        <>
          <Ellipse
            x={node.size.width / 2}
            y={node.size.height / 2}
            radiusX={node.size.width / 2}
            radiusY={node.size.height / 2}
            fill={baseStyle.fill}
            stroke={baseStyle.stroke}
            strokeWidth={baseStyle.strokeWidth}
            shadowColor={baseStyle.shadowColor}
            shadowBlur={baseStyle.shadowBlur}
            shadowOffsetX={baseStyle.shadowOffsetX}
            shadowOffsetY={baseStyle.shadowOffsetY}
            opacity={baseStyle.opacity}
          />
          {textElement}
        </>
      )

    case 'diamond':
      return (
        <>
          <RegularPolygon
            x={node.size.width / 2}
            y={node.size.height / 2}
            sides={4}
            radius={Math.min(node.size.width, node.size.height) / 2}
            rotation={45}
            fill={baseStyle.fill}
            stroke={baseStyle.stroke}
            strokeWidth={baseStyle.strokeWidth}
            shadowColor={baseStyle.shadowColor}
            shadowBlur={baseStyle.shadowBlur}
            shadowOffsetX={baseStyle.shadowOffsetX}
            shadowOffsetY={baseStyle.shadowOffsetY}
            opacity={baseStyle.opacity}
          />
          {textElement}
        </>
      )

    case 'triangle':
      return (
        <>
          <RegularPolygon
            x={node.size.width / 2}
            y={node.size.height / 2}
            sides={3}
            radius={Math.min(node.size.width, node.size.height) / 2}
            fill={baseStyle.fill}
            stroke={baseStyle.stroke}
            strokeWidth={baseStyle.strokeWidth}
            shadowColor={baseStyle.shadowColor}
            shadowBlur={baseStyle.shadowBlur}
            shadowOffsetX={baseStyle.shadowOffsetX}
            shadowOffsetY={baseStyle.shadowOffsetY}
            opacity={baseStyle.opacity}
          />
          {textElement}
        </>
      )

    case 'star': {
      const cx = node.size.width / 2
      const cy = node.size.height / 2
      const outerR = Math.min(node.size.width, node.size.height) / 2
      const innerR = outerR * 0.4
      const points: number[] = []
      for (let i = 0; i < 10; i++) {
        const angle = (i * Math.PI) / 5 - Math.PI / 2
        const r = i % 2 === 0 ? outerR : innerR
        points.push(cx + r * Math.cos(angle), cy + r * Math.sin(angle))
      }
      return (
        <>
          <Line
            points={points}
            closed
            fill={baseStyle.fill}
            stroke={baseStyle.stroke}
            strokeWidth={baseStyle.strokeWidth}
            opacity={baseStyle.opacity}
          />
          {textElement}
        </>
      )
    }

    case 'hexagon':
      return (
        <>
          <RegularPolygon
            x={node.size.width / 2}
            y={node.size.height / 2}
            sides={6}
            radius={Math.min(node.size.width, node.size.height) / 2}
            fill={baseStyle.fill}
            stroke={baseStyle.stroke}
            strokeWidth={baseStyle.strokeWidth}
            shadowColor={baseStyle.shadowColor}
            shadowBlur={baseStyle.shadowBlur}
            shadowOffsetX={baseStyle.shadowOffsetX}
            shadowOffsetY={baseStyle.shadowOffsetY}
            opacity={baseStyle.opacity}
          />
          {textElement}
        </>
      )

    case 'cylinder':
      return (
        <>
          <Rect
            x={0}
            y={node.size.height * 0.1}
            width={node.size.width}
            height={node.size.height * 0.8}
            fill={baseStyle.fill}
            stroke={baseStyle.stroke}
            strokeWidth={baseStyle.strokeWidth}
            opacity={baseStyle.opacity}
          />
          <Ellipse
            x={node.size.width / 2}
            y={node.size.height * 0.1}
            radiusX={node.size.width / 2}
            radiusY={node.size.height * 0.1}
            fill={baseStyle.fill}
            stroke={baseStyle.stroke}
            strokeWidth={baseStyle.strokeWidth}
            opacity={baseStyle.opacity}
          />
          <Ellipse
            x={node.size.width / 2}
            y={node.size.height * 0.9}
            radiusX={node.size.width / 2}
            radiusY={node.size.height * 0.1}
            fill={baseStyle.fill}
            stroke={baseStyle.stroke}
            strokeWidth={baseStyle.strokeWidth}
            opacity={baseStyle.opacity}
          />
          {textElement}
        </>
      )

    case 'cloud': {
      const w = node.size.width
      const h = node.size.height
      return (
        <>
          <Line
            points={[
              w * 0.2, h * 0.6,
              w * 0.1, h * 0.4,
              w * 0.2, h * 0.25,
              w * 0.35, h * 0.2,
              w * 0.5, h * 0.15,
              w * 0.65, h * 0.2,
              w * 0.8, h * 0.25,
              w * 0.9, h * 0.4,
              w * 0.85, h * 0.6,
              w * 0.7, h * 0.75,
              w * 0.5, h * 0.8,
              w * 0.3, h * 0.75,
              w * 0.2, h * 0.6,
            ]}
            closed
            tension={0.5}
            fill={baseStyle.fill}
            stroke={baseStyle.stroke}
            strokeWidth={baseStyle.strokeWidth}
            opacity={baseStyle.opacity}
          />
          {textElement}
        </>
      )
    }

    case 'callout':
      return (
        <>
          <Line
            points={[
              0, 0,
              node.size.width, 0,
              node.size.width, node.size.height * 0.75,
              node.size.width * 0.3, node.size.height * 0.75,
              node.size.width * 0.15, node.size.height,
              node.size.width * 0.25, node.size.height * 0.75,
              0, node.size.height * 0.75,
              0, 0,
            ]}
            closed
            fill={baseStyle.fill}
            stroke={baseStyle.stroke}
            strokeWidth={baseStyle.strokeWidth}
            opacity={baseStyle.opacity}
          />
          {textElement}
        </>
      )

    case 'note':
      return (
        <>
          <Line
            points={[
              0, 0,
              node.size.width - 20, 0,
              node.size.width, 20,
              node.size.width, node.size.height,
              0, node.size.height,
              0, 0,
            ]}
            closed
            fill={baseStyle.fill || '#ffffa5'}
            stroke={baseStyle.stroke}
            strokeWidth={baseStyle.strokeWidth}
            opacity={baseStyle.opacity}
          />
          <Line
            points={[
              node.size.width - 20, 0,
              node.size.width - 20, 20,
              node.size.width, 20,
            ]}
            stroke={baseStyle.stroke}
            strokeWidth={baseStyle.strokeWidth}
            opacity={baseStyle.opacity}
          />
          {textElement}
        </>
      )

    case 'container':
      return (
        <>
          <Rect
            width={node.size.width}
            height={node.size.height}
            cornerRadius={4}
            fill={baseStyle.fill || 'rgba(200, 200, 200, 0.1)'}
            stroke={baseStyle.stroke}
            strokeWidth={baseStyle.strokeWidth}
            strokeDash={[5, 5]}
            opacity={baseStyle.opacity}
          />
          <Rect
            width={node.size.width}
            height={30}
            cornerRadius={[4, 4, 0, 0]}
            fill={baseStyle.stroke || '#666'}
            opacity={0.3}
          />
          <Text
            x={8}
            y={6}
            text={node.text || 'Container'}
            fontSize={14}
            fontStyle="bold"
            fill={node.textStyle?.color || '#fff'}
          />
        </>
      )

    case 'freehand': {
      const pathPoints = node.pathData
        ? node.pathData.split(',').map(Number)
        : []
      return (
        <Line
          points={pathPoints}
          stroke={baseStyle.stroke || '#3b82f6'}
          strokeWidth={node.style.strokeWidth || 3}
          opacity={baseStyle.opacity}
          lineCap="round"
          lineJoin="round"
          tension={0.5}
          shadowColor={baseStyle.shadowColor}
          shadowBlur={baseStyle.shadowBlur}
        />
      )
    }

    case 'image':
      return <ImageNodeContent node={node} baseStyle={baseStyle} />

    default:
      return null
  }
})
