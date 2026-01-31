import type { WtvFile } from '@/types'

const WTV_FORMAT_VERSION = '1.0.0'
const WTV_EXTENSION = '.wtv'

export function validateWtvFile(content: unknown): content is WtvFile {
  if (!content || typeof content !== 'object') return false
  
  const file = content as Record<string, unknown>
  
  if (typeof file.id !== 'string') return false
  if (typeof file.formatVersion !== 'string') return false
  if (!file.metadata || typeof file.metadata !== 'object') return false
  if (!file.content || typeof file.content !== 'object') return false
  if (!file.canvasState || typeof file.canvasState !== 'object') return false
  
  return true
}

export function parseWtvFile(jsonString: string): WtvFile {
  const parsed = JSON.parse(jsonString)
  
  if (!validateWtvFile(parsed)) {
    throw new Error('Invalid .wtv file format')
  }
  
  return parsed
}

export function serializeWtvFile(file: WtvFile): string {
  const updatedFile: WtvFile = {
    ...file,
    metadata: {
      ...file.metadata,
      modified: new Date().toISOString(),
    }
  }
  
  const jsonString = JSON.stringify(updatedFile, null, 2)
  updatedFile.metadata.fileSize = new Blob([jsonString]).size
  
  return JSON.stringify(updatedFile, null, 2)
}

export function createFileName(name: string): string {
  const sanitized = name
    .replace(/[<>:"/\\|?*]/g, '')
    .replace(/\s+/g, '_')
    .toLowerCase()
  
  return sanitized.endsWith(WTV_EXTENSION) 
    ? sanitized 
    : sanitized + WTV_EXTENSION
}

export function getFileNameWithoutExtension(fileName: string): string {
  return fileName.replace(WTV_EXTENSION, '')
}

export function isWtvFile(fileName: string): boolean {
  return fileName.toLowerCase().endsWith(WTV_EXTENSION)
}

export function migrateWtvFile(file: WtvFile): WtvFile {
  const currentVersion = file.formatVersion
  
  if (currentVersion === WTV_FORMAT_VERSION) {
    return file
  }
  
  return {
    ...file,
    formatVersion: WTV_FORMAT_VERSION,
  }
}

export async function downloadWtvFile(file: WtvFile): Promise<void> {
  const content = serializeWtvFile(file)
  const blob = new Blob([content], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  
  const a = document.createElement('a')
  a.href = url
  a.download = createFileName(file.metadata.name)
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export async function readWtvFileFromBlob(blob: Blob): Promise<WtvFile> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    
    reader.onload = () => {
      try {
        const file = parseWtvFile(reader.result as string)
        resolve(file)
      } catch (error) {
        reject(error)
      }
    }
    
    reader.onerror = () => reject(reader.error)
    reader.readAsText(blob)
  })
}
