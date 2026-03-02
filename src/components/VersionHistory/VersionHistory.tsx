import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { X, History, RotateCcw, Clock, FileText, ChevronDown, ChevronUp, Loader2 } from 'lucide-react'
import { schemasApi } from '@/api'
import type { SchemaVersion } from '@/types'
import { cn } from '@/utils'

interface VersionHistoryProps {
  isOpen: boolean
  onClose: () => void
  schemaId: string | null
  onRestore?: (version: SchemaVersion) => void
}

export function VersionHistory({ isOpen, onClose, schemaId, onRestore }: VersionHistoryProps) {
  const { t } = useTranslation()
  const [versions, setVersions] = useState<SchemaVersion[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [restoringId, setRestoringId] = useState<string | null>(null)

  const fetchVersions = useCallback(async () => {
    if (!schemaId) return
    setLoading(true)
    setError(null)
    try {
      const result = await schemasApi.getVersions(schemaId)
      if (result.success && result.data) {
        setVersions(result.data)
      } else {
        setError(result.error || 'Failed to load versions')
      }
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }, [schemaId])

  useEffect(() => {
    if (isOpen && schemaId) {
      fetchVersions()
    }
  }, [isOpen, schemaId, fetchVersions])

  const handleRestore = async (version: SchemaVersion) => {
    if (!schemaId) return
    setRestoringId(version.id)
    try {
      const result = await schemasApi.restoreVersion(schemaId, version.id)
      if (result.success) {
        onRestore?.(version)
        onClose()
      } else {
        setError(result.error || 'Failed to restore version')
      }
    } catch {
      setError('Network error')
    } finally {
      setRestoringId(null)
    }
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleString()
  }

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      
      <div className="relative w-full max-w-lg bg-popover border rounded-lg shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <History size={20} />
            <h2 className="text-lg font-semibold">
              {t('versionHistory.title', 'Version History')}
            </h2>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-accent">
            <X size={20} />
          </button>
        </div>

        <div className="max-h-[500px] overflow-y-auto p-4">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={24} className="animate-spin text-muted-foreground" />
            </div>
          )}

          {error && (
            <div className="text-sm text-destructive bg-destructive/10 rounded p-3 mb-3">
              {error}
            </div>
          )}

          {!loading && !error && versions.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <History size={32} className="mx-auto mb-2 opacity-50" />
              <p className="text-sm">{t('versionHistory.noVersions', 'No versions yet')}</p>
              <p className="text-xs mt-1">{t('versionHistory.hint', 'Versions are created when you save')}</p>
            </div>
          )}

          {!loading && versions.length > 0 && (
            <div className="space-y-2">
              {versions.map((version, index) => (
                <div
                  key={version.id}
                  className={cn(
                    'border rounded-lg overflow-hidden transition-colors',
                    index === 0 ? 'border-primary/30 bg-primary/5' : 'hover:bg-accent/50'
                  )}
                >
                  <button
                    className="w-full flex items-center justify-between p-3 text-left"
                    onClick={() => setExpandedId(expandedId === version.id ? null : version.id)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-muted text-xs font-mono font-bold">
                        v{version.versionNumber}
                      </div>
                      <div>
                        <p className="text-sm font-medium">
                          {version.commitMessage || `Version ${version.versionNumber}`}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                          <Clock size={12} />
                          <span>{formatDate(version.createdAt)}</span>
                          {version.fileSize > 0 && (
                            <>
                              <span>•</span>
                              <FileText size={12} />
                              <span>{formatSize(version.fileSize)}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    {expandedId === version.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>

                  {expandedId === version.id && (
                    <div className="px-3 pb-3 border-t pt-2">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                        <span>Hash: <code className="font-mono">{version.contentHash?.slice(0, 12)}...</code></span>
                      </div>
                      {index > 0 && (
                        <button
                          onClick={() => handleRestore(version)}
                          disabled={restoringId === version.id}
                          className={cn(
                            'flex items-center gap-2 px-3 py-1.5 text-xs rounded',
                            'bg-primary text-primary-foreground hover:bg-primary/90',
                            'disabled:opacity-50 disabled:cursor-not-allowed'
                          )}
                        >
                          {restoringId === version.id ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <RotateCcw size={14} />
                          )}
                          {t('versionHistory.restore', 'Restore this version')}
                        </button>
                      )}
                      {index === 0 && (
                        <span className="text-xs text-primary font-medium">
                          {t('versionHistory.current', 'Current version')}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
