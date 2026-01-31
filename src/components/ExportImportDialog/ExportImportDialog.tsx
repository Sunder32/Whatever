import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { X, Download, Upload, FileJson, FileImage, FileText, File, Box, Printer, Loader2 } from 'lucide-react'
import { useDiagramStore } from '@/stores'
import { exportApi, type ExportFormat as ApiExportFormat } from '@/api'
import { cn, serializeWtvFile, parseWtvFile, generateWtvFileName, isValidWtvFile } from '@/utils'

interface ExportImportDialogProps {
  isOpen: boolean
  onClose: () => void
  mode: 'export' | 'import'
  importIntoNodeId?: string | null  // If provided, import into this node
}

type ExportFormat = 'wtv' | 'json' | 'png' | 'svg' | 'pdf'

export function ExportImportDialog({ isOpen, onClose, mode, importIntoNodeId }: ExportImportDialogProps) {
  const { t } = useTranslation()
  const file = useDiagramStore(state => state.file)
  const loadFile = useDiagramStore(state => state.loadFile)
  const importIntoNode = useDiagramStore(state => state.importIntoNode)
  const getNode = useDiagramStore(state => state.getNode)
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('wtv')
  const [importError, setImportError] = useState<string | null>(null)
  const [isExporting, setIsExporting] = useState(false)
  
  // Get target node name for display
  const targetNode = importIntoNodeId ? getNode(importIntoNodeId) : null
  const isImportIntoNode = mode === 'import' && importIntoNodeId && targetNode
  
  if (!isOpen) return null
  
  const handleExportServer = async (format: ApiExportFormat) => {
    if (!file) return
    setIsExporting(true)
    try {
      const blob = await exportApi.exportDiagram(file, format)
      const url = URL.createObjectURL(blob)
      
      const link = document.createElement('a')
      link.href = url
      link.download = `${file.metadata.name || 'diagram'}.${format}`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      
      onClose()
    } catch (error) {
      console.error('Export failed:', error)
      setImportError('Export failed')
    } finally {
      setIsExporting(false)
    }
  }

  const handleExportWTV = () => {
    if (!file) return
    
    const dataStr = serializeWtvFile(file)
    const blob = new Blob([dataStr], { type: 'application/x-wtv-diagram' })
    const url = URL.createObjectURL(blob)
    
    const link = document.createElement('a')
    link.href = url
    link.download = generateWtvFileName(file)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    
    onClose()
  }
  
  const handleExportJSON = () => {
    if (!file) return
    
    const dataStr = JSON.stringify(file, null, 2)
    const blob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    
    const link = document.createElement('a')
    link.href = url
    link.download = `${file.metadata.name || 'diagram'}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    
    onClose()
  }
  
  const handleExportPNG = async () => {
    // Dispatch event to request export from Canvas component
    const exportPromise = new Promise<string>((resolve, reject) => {
      const handler = (e: Event) => {
        const customEvent = e as CustomEvent<{ dataUrl: string }>
        resolve(customEvent.detail.dataUrl)
        window.removeEventListener('exportPNGResult', handler)
      }
      const errorHandler = () => {
        reject(new Error('Export failed'))
        window.removeEventListener('exportPNGError', errorHandler)
      }
      window.addEventListener('exportPNGResult', handler)
      window.addEventListener('exportPNGError', errorHandler)
      
      // Timeout after 5 seconds
      setTimeout(() => {
        window.removeEventListener('exportPNGResult', handler)
        window.removeEventListener('exportPNGError', errorHandler)
        reject(new Error('Export timeout'))
      }, 5000)
    })
    
    window.dispatchEvent(new CustomEvent('requestExportPNG'))
    
    try {
      const dataURL = await exportPromise
      const link = document.createElement('a')
      link.href = dataURL
      link.download = `${file?.metadata.name || 'diagram'}.png`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      onClose()
    } catch (error) {
      // Fallback to old method
      const stage = document.querySelector('.konvajs-content canvas') as HTMLCanvasElement
      if (stage) {
        const dataURL = stage.toDataURL('image/png')
        const link = document.createElement('a')
        link.href = dataURL
        link.download = `${file?.metadata.name || 'diagram'}.png`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
      }
      onClose()
    }
  }
  
  const handleExportSVG = async () => {
    // Create SVG from diagram data
    if (!file) {
      onClose()
      return
    }
    
    const nodes = file.content.nodes
    const edges = file.content.edges
    
    // Calculate bounds
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    nodes.forEach(node => {
      minX = Math.min(minX, node.position.x)
      minY = Math.min(minY, node.position.y)
      maxX = Math.max(maxX, node.position.x + node.size.width)
      maxY = Math.max(maxY, node.position.y + node.size.height)
    })
    
    if (!isFinite(minX)) {
      minX = minY = 0
      maxX = maxY = 100
    }
    
    const padding = 20
    const width = maxX - minX + padding * 2
    const height = maxY - minY + padding * 2
    
    // Generate SVG
    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">\n`
    svg += `  <rect width="100%" height="100%" fill="white"/>\n`
    
    // Draw nodes
    nodes.forEach(node => {
      const x = node.position.x - minX + padding
      const y = node.position.y - minY + padding
      const fill = node.style.fill || '#3b82f6'
      const stroke = node.style.stroke || '#60a5fa'
      const strokeWidth = node.style.strokeWidth || 2
      
      switch (node.type) {
        case 'rectangle':
          svg += `  <rect x="${x}" y="${y}" width="${node.size.width}" height="${node.size.height}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" rx="${node.style.cornerRadius || 0}"/>\n`
          break
        case 'ellipse':
          const cx = x + node.size.width / 2
          const cy = y + node.size.height / 2
          svg += `  <ellipse cx="${cx}" cy="${cy}" rx="${node.size.width / 2}" ry="${node.size.height / 2}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"/>\n`
          break
        case 'diamond':
          const dx = node.size.width / 2
          const dy = node.size.height / 2
          svg += `  <polygon points="${x + dx},${y} ${x + node.size.width},${y + dy} ${x + dx},${y + node.size.height} ${x},${y + dy}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"/>\n`
          break
        default:
          svg += `  <rect x="${x}" y="${y}" width="${node.size.width}" height="${node.size.height}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"/>\n`
      }
      
      // Add text if present
      if (node.text) {
        const textX = x + node.size.width / 2
        const textY = y + node.size.height / 2
        svg += `  <text x="${textX}" y="${textY}" text-anchor="middle" dominant-baseline="middle" font-family="${node.textStyle.fontFamily}" font-size="${node.textStyle.fontSize}" fill="${node.textStyle.color}">${node.text}</text>\n`
      }
    })
    
    // Draw edges
    edges.forEach(edge => {
      const sourceNode = nodes.find(n => n.id === edge.source)
      const targetNode = nodes.find(n => n.id === edge.target)
      if (!sourceNode || !targetNode) return
      
      const x1 = sourceNode.position.x - minX + padding + sourceNode.size.width / 2
      const y1 = sourceNode.position.y - minY + padding + sourceNode.size.height / 2
      const x2 = targetNode.position.x - minX + padding + targetNode.size.width / 2
      const y2 = targetNode.position.y - minY + padding + targetNode.size.height / 2
      
      const stroke = edge.style?.stroke || '#64748b'
      const strokeWidth = edge.style?.strokeWidth || 2
      
      if (edge.arrowEnd === 'arrow') {
        svg += `  <defs><marker id="arrow" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto"><path d="M0,0 L0,6 L9,3 z" fill="${stroke}"/></marker></defs>\n`
        svg += `  <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="${strokeWidth}" marker-end="url(#arrow)"/>\n`
      } else {
        svg += `  <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="${strokeWidth}"/>\n`
      }
    })
    
    svg += '</svg>'
    
    // Download
    const blob = new Blob([svg], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${file.metadata.name || 'diagram'}.svg`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    
    onClose()
  }
  
  const handleExport = () => {
    switch (selectedFormat) {
      case 'wtv':
        handleExportWTV()
        break
      case 'json':
        handleExportJSON()
        break
      case 'png':
        // Prefer server export for high quality? Or ask user?
        // For now, let's keep PNG client-side for speed, and add PDF server-side.
        handleExportPNG()
        break
      case 'svg':
        handleExportSVG()
        break
      case 'pdf':
        handleExportServer('pdf')
        break
    }
  }
  
  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputFile = e.target.files?.[0]
    if (!inputFile) return
    
    setImportError(null)
    
    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string
        let parsedFile
        
        // Check if it's a WTV file
        if (inputFile.name.endsWith('.wtv') || isValidWtvFile(content)) {
          parsedFile = parseWtvFile(content)
        } else {
          // Try parsing as regular JSON
          parsedFile = JSON.parse(content)
          
          // Validate the file structure
          if (!parsedFile.id || !parsedFile.content || !parsedFile.metadata) {
            throw new Error(t('export.invalidFormat'))
          }
        }
        
        // If importing into a node, use importIntoNode method
        if (isImportIntoNode && importIntoNodeId) {
          importIntoNode(importIntoNodeId, parsedFile)
        } else {
          // Normal full file import
          loadFile(parsedFile)
        }
        
        onClose()
      } catch (err) {
        if (err instanceof Error) {
          setImportError(err.message)
        } else {
          setImportError(t('export.parseError'))
        }
      }
    }
    reader.readAsText(inputFile)
  }
  
  const formats: { id: ExportFormat; label: string; icon: React.ReactNode; description: string }[] = [
    { 
      id: 'wtv', 
      label: 'WTV (родной формат)', 
      icon: <File size={24} />,
      description: t('export.wtvDescription')
    },
    { 
      id: 'json', 
      label: 'JSON', 
      icon: <FileJson size={24} />,
      description: t('export.jsonDescription')
    },
    { 
      id: 'png', 
      label: 'PNG', 
      icon: <FileImage size={24} />,
      description: t('export.pngDescription')
    },
    { 
      id: 'svg', 
      label: 'SVG', 
      icon: <FileText size={24} />,
      description: t('export.svgDescription')
    },
    { 
      id: 'pdf', 
      label: 'PDF (High Quality)', 
      icon: <Printer size={24} />,
      description: 'Экспорт в PDF через сервер'
    },
  ]
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      
      <div className="relative w-full max-w-md bg-popover border rounded-lg shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            {mode === 'export' ? <Download size={20} /> : <Upload size={20} />}
            {mode === 'export' ? t('export.title') : t('export.importTitle')}
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-accent"
          >
            <X size={20} />
          </button>
        </div>
        
        <div className="p-4">
          {mode === 'export' ? (
            <>
              <p className="text-sm text-muted-foreground mb-4">
                {t('export.selectFormat')}
              </p>
              
              <div className="space-y-2 mb-4">
                {formats.map(format => (
                  <button
                    key={format.id}
                    onClick={() => setSelectedFormat(format.id)}
                    className={cn(
                      'flex items-center gap-3 w-full p-3 rounded-lg border transition-colors text-left',
                      selectedFormat === format.id 
                        ? 'border-primary bg-accent' 
                        : 'hover:bg-accent/50'
                    )}
                  >
                    {format.icon}
                    <div>
                      <p className="font-medium">{format.label}</p>
                      <p className="text-xs text-muted-foreground">{format.description}</p>
                    </div>
                  </button>
                ))}
              </div>
              
              <button
                onClick={handleExport}
                disabled={isExporting}
                className={cn(
                  "w-full py-2 px-4 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors",
                  isExporting && "opacity-50 cursor-not-allowed"
                )}
              >
                {isExporting ? <Loader2 className="animate-spin w-5 h-5 mx-auto" /> : t('export.exportButton')}
              </button>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground mb-4">
                {isImportIntoNode 
                  ? `Импорт в объект "${targetNode?.text || 'Контейнер'}". Элементы будут масштабированы и размещены внутри выбранного объекта.`
                  : t('export.importDescription')
                }
              </p>
              
              {isImportIntoNode && (
                <div className="flex items-center gap-2 p-3 mb-4 bg-accent/50 rounded-lg border">
                  <Box size={20} className="text-primary" />
                  <div>
                    <p className="text-sm font-medium">Целевой объект</p>
                    <p className="text-xs text-muted-foreground">
                      {targetNode?.text || `${targetNode?.type} (${Math.round(targetNode?.size.width || 0)}×${Math.round(targetNode?.size.height || 0)})`}
                    </p>
                  </div>
                </div>
              )}
              
              <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-accent/50 transition-colors">
                <Upload size={32} className="text-muted-foreground mb-2" />
                <span className="text-sm text-muted-foreground">
                  {t('export.dropOrClick')}
                </span>
                <input
                  type="file"
                  accept=".wtv,.json"
                  onChange={handleImport}
                  className="hidden"
                />
              </label>
              
              {importError && (
                <p className="mt-2 text-sm text-destructive">{importError}</p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
