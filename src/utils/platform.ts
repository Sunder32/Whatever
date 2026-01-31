/**
 * Platform Detection Utilities
 * Determines the runtime environment (Web, Electron, etc.)
 */

export interface PlatformInfo {
  isElectron: boolean
  isWeb: boolean
  isMac: boolean
  isWindows: boolean
  isLinux: boolean
  appVersion: string
}

/**
 * Check if running in Electron environment
 */
export function isElectron(): boolean {
  // Renderer process
  if (typeof window !== 'undefined' && typeof window.process === 'object' && (window.process as any).type === 'renderer') {
    return true
  }

  // Main process
  if (typeof process !== 'undefined' && typeof process.versions === 'object' && !!(process.versions as any).electron) {
    return true
  }

  // Detect the user agent when the `nodeIntegration` option is set to false
  if (typeof navigator === 'object' && typeof navigator.userAgent === 'string' && navigator.userAgent.indexOf('Electron') >= 0) {
    return true
  }

  // Check for electronAPI exposed via preload
  if (typeof window !== 'undefined' && 'electronAPI' in window) {
    return true
  }

  return false
}

/**
 * Get current platform information
 */
export function getPlatformInfo(): PlatformInfo {
  const electron = isElectron()
  const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : ''
  
  return {
    isElectron: electron,
    isWeb: !electron,
    isMac: /Mac|iPhone|iPad|iPod/i.test(userAgent),
    isWindows: /Win/i.test(userAgent),
    isLinux: /Linux/i.test(userAgent) && !/Android/i.test(userAgent),
    appVersion: electron ? (window as any).electronAPI?.version || '1.0.0' : '1.0.0'
  }
}

/**
 * Get the Electron API if available
 */
export function getElectronAPI() {
  if (isElectron() && typeof window !== 'undefined') {
    return (window as any).electronAPI
  }
  return null
}

/**
 * Platform-aware file operations
 */
export const platformFile = {
  /**
   * Save file - uses native dialog in Electron, download link in Web
   */
  async save(content: string | Blob, filename: string, mimeType: string): Promise<boolean> {
    const api = getElectronAPI()
    
    if (api) {
      // Electron: use native save dialog
      try {
        const result = await api.dialog.save()
        if (result?.filePath) {
          const textContent = content instanceof Blob ? await content.text() : content
          await api.file.write(result.filePath, textContent)
          return true
        }
        return false
      } catch (error) {
        console.error('Failed to save file:', error)
        return false
      }
    } else {
      // Web: use download link
      const blob = content instanceof Blob ? content : new Blob([content], { type: mimeType })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      return true
    }
  },

  /**
   * Open file - uses native dialog in Electron, file input in Web
   */
  async open(accept?: string): Promise<{ content: string; path?: string } | null> {
    const api = getElectronAPI()
    
    if (api) {
      // Electron: use native open dialog
      try {
        const result = await api.dialog.open()
        return result || null
      } catch (error) {
        console.error('Failed to open file:', error)
        return null
      }
    } else {
      // Web: use file input
      return new Promise((resolve) => {
        const input = document.createElement('input')
        input.type = 'file'
        if (accept) input.accept = accept
        
        input.onchange = async () => {
          const file = input.files?.[0]
          if (file) {
            const content = await file.text()
            resolve({ content, path: file.name })
          } else {
            resolve(null)
          }
        }
        
        input.click()
      })
    }
  }
}

export default {
  isElectron,
  getPlatformInfo,
  getElectronAPI,
  platformFile
}
