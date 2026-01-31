import { useEffect, useRef, useCallback } from 'react'
import { useDiagramStore, useAppStore } from '@/stores'

interface UseAutoSaveOptions {
  interval?: number
  enabled?: boolean
  onSave?: () => Promise<void>
  onError?: (error: Error) => void
}

export function useAutoSave(options: UseAutoSaveOptions = {}) {
  const {
    interval = 30000, // 30 seconds default
    enabled = true,
    onSave,
    onError,
  } = options

  const file = useDiagramStore(state => state.file)
  const hasUnsavedChanges = useAppStore(state => state.hasUnsavedChanges)
  const setHasUnsavedChanges = useAppStore(state => state.setHasUnsavedChanges)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const lastSaveRef = useRef<string | null>(null)
  const isSavingRef = useRef(false)

  const performSave = useCallback(async () => {
    if (isSavingRef.current || !hasUnsavedChanges || !file) {
      return
    }

    // Check if content actually changed since last save
    const contentHash = JSON.stringify({
      nodes: file.content.nodes,
      edges: file.content.edges,
    })

    if (contentHash === lastSaveRef.current) {
      return
    }

    isSavingRef.current = true

    try {
      if (onSave) {
        await onSave()
      }
      
      lastSaveRef.current = contentHash
      setHasUnsavedChanges(false)
      console.log('Auto-save completed at', new Date().toISOString())
    } catch (error) {
      console.error('Auto-save failed:', error)
      onError?.(error as Error)
    } finally {
      isSavingRef.current = false
    }
  }, [hasUnsavedChanges, file, onSave, onError, setHasUnsavedChanges])

  useEffect(() => {
    if (!enabled) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      return
    }

    intervalRef.current = setInterval(performSave, interval)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [enabled, interval, performSave])

  // Save on page unload
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault()
        e.returnValue = ''
        performSave()
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [hasUnsavedChanges, performSave])

  // Manual trigger
  const triggerSave = useCallback(async () => {
    await performSave()
  }, [performSave])

  return {
    triggerSave,
    isSaving: isSavingRef.current,
  }
}

export default useAutoSave
