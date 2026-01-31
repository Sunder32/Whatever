import type { WtvFile, Asset } from '@/types'
import { v4 as uuidv4 } from 'uuid'

// .wtv file format version
export const WTV_FORMAT_VERSION = '1.0.0'
export const WTV_FILE_EXTENSION = '.wtv'
export const WTV_MIME_TYPE = 'application/x-wtv-diagram'

/**
 * Create a new empty WTV file
 */
export function createEmptyWtvFile(name: string = 'Untitled'): WtvFile {
  const now = new Date().toISOString()
  
  return {
    id: uuidv4(),
    formatVersion: WTV_FORMAT_VERSION,
    metadata: {
      name,
      description: '',
      author: '',
      created: now,
      modified: now,
      fileSize: 0,
      tags: [],
    },
    content: {
      nodes: [],
      edges: [],
      textElements: [],
      images: [],
      groups: [],
      layers: [{
        id: uuidv4(),
        name: 'Основной слой',
        visible: true,
        locked: false,
        elements: [],
      }],
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
      viewport: { width: 1920, height: 1080 },
    },
    assets: [],
    encryption: {
      encrypted: false,
      method: '',
    },
  }
}

/**
 * Generate file name for export
 */
export function generateWtvFileName(file: WtvFile): string {
  const safeName = file.metadata.name
    .replace(/[^a-zA-Zа-яА-Я0-9\s-_]/g, '')
    .replace(/\s+/g, '_')
    .substring(0, 50) || 'diagram'
  
  return `${safeName}${WTV_FILE_EXTENSION}`
}

/**
 * Check if file is a valid WTV file
 */
export function isValidWtvFile(content: string): boolean {
  try {
    const parsed = JSON.parse(content)
    return !!(
      parsed.id &&
      parsed.formatVersion &&
      parsed.content &&
      parsed.metadata
    )
  } catch {
    return false
  }
}

/**
 * Create a thumbnail from canvas
 */
export async function generateThumbnail(
  canvas: HTMLCanvasElement,
  maxWidth: number = 300,
  maxHeight: number = 200
): Promise<{ data: string; width: number; height: number }> {
  const ratio = Math.min(maxWidth / canvas.width, maxHeight / canvas.height)
  const width = Math.round(canvas.width * ratio)
  const height = Math.round(canvas.height * ratio)
  
  const thumbCanvas = document.createElement('canvas')
  thumbCanvas.width = width
  thumbCanvas.height = height
  
  const ctx = thumbCanvas.getContext('2d')
  if (!ctx) throw new Error('Failed to get canvas context')
  
  ctx.drawImage(canvas, 0, 0, width, height)
  
  return {
    data: thumbCanvas.toDataURL('image/png'),
    width,
    height,
  }
}

/**
 * Calculate file hash for deduplication
 */
export async function calculateFileHash(content: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(content)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Add asset to WTV file with deduplication
 */
export async function addAssetToFile(
  file: WtvFile,
  assetData: string,
  name: string,
  mimeType: string
): Promise<{ file: WtvFile; assetId: string }> {
  const hash = await calculateFileHash(assetData)
  
  // Check if asset already exists
  const existingAsset = file.assets.find(a => a.hash === hash)
  if (existingAsset) {
    return { file, assetId: existingAsset.id }
  }
  
  const newAsset: Asset = {
    id: uuidv4(),
    name,
    mimeType,
    data: assetData,
    hash,
  }
  
  return {
    file: {
      ...file,
      assets: [...file.assets, newAsset],
    },
    assetId: newAsset.id,
  }
}
