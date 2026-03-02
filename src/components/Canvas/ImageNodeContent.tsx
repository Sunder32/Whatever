import { useState, useEffect } from 'react'
import { Rect, Text, Image as KonvaImage } from 'react-konva'
import type { DiagramNode } from '@/types'

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

// Hook to load image from data URL
const useImage = (imageData: string | undefined): HTMLImageElement | null => {
  const [image, setImage] = useState<HTMLImageElement | null>(null)

  useEffect(() => {
    if (!imageData) {
      setImage(null)
      return
    }

    const img = new window.Image()
    img.onload = () => setImage(img)
    img.onerror = () => setImage(null)
    img.src = imageData

    return () => {
      img.onload = null
      img.onerror = null
    }
  }, [imageData])

  return image
}

interface ImageNodeContentProps {
  node: DiagramNode
  baseStyle: ShapeStyle
}

export function ImageNodeContent({ node, baseStyle }: ImageNodeContentProps) {
  const image = useImage(node.imageData)

  if (!image) {
    return (
      <>
        <Rect
          width={node.size.width}
          height={node.size.height}
          fill="#f3f4f6"
          stroke={baseStyle.stroke}
          strokeWidth={baseStyle.strokeWidth}
          cornerRadius={4}
        />
        <Text
          x={0}
          y={node.size.height / 2 - 10}
          width={node.size.width}
          text={node.imageData ? 'Загрузка...' : '🖼️ Нет изображения'}
          fontSize={14}
          fill="#9ca3af"
          align="center"
        />
      </>
    )
  }

  return (
    <>
      <KonvaImage
        image={image}
        width={node.size.width}
        height={node.size.height}
        shadowColor={baseStyle.shadowColor}
        shadowBlur={baseStyle.shadowBlur}
      />
      <Rect
        width={node.size.width}
        height={node.size.height}
        fill="transparent"
        stroke={baseStyle.stroke}
        strokeWidth={baseStyle.strokeWidth}
      />
    </>
  )
}
