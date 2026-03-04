import { useEffect, useRef, useCallback } from 'react'
import { webSocketService } from '@/services'

interface Cursor {
  userId: string
  userName: string
  color: string
  position: { x: number; y: number }
  lastUpdate: number
}

interface UseCollaborationOptions {
  schemaId: string | null
  userId: string
  userName: string
  userColor?: string
  enabled?: boolean
  onCursorUpdate?: (cursors: Map<string, Cursor>) => void
  onElementUpdate?: (elementId: string, changes: Record<string, unknown>) => void
  onElementCreate?: (data: Record<string, unknown>) => void
  onElementDelete?: (data: Record<string, unknown>) => void
  onUserJoin?: (userId: string, userName: string) => void
  onUserLeave?: (userId: string) => void
  onSyncRequest?: (fromUserId: string) => void
  onSyncResponse?: (data: Record<string, unknown>) => void
}

export function useCollaboration(options: UseCollaborationOptions) {
  const {
    schemaId,
    userId,
    userName,
    userColor = '#3b82f6',
    enabled = true,
    onCursorUpdate,
    onElementUpdate,
    onElementCreate,
    onElementDelete,
    onUserJoin,
    onUserLeave,
    onSyncRequest,
    onSyncResponse,
  } = options

  const cursorsRef = useRef<Map<string, Cursor>>(new Map())
  const cleanupRef = useRef<(() => void)[]>([])

  useEffect(() => {
    if (!enabled || !schemaId || !webSocketService.isConnected()) {
      return
    }

    // Join schema room
    webSocketService.joinSchema(schemaId)

    // Listen for cursor updates from backend (type: cursor_move)
    const unsubCursor = webSocketService.on('cursor_move', (data: unknown) => {
      const update = data as { userId: string; userName: string; color: string; position: { x: number; y: number } }
      
      if (update.userId !== userId) {
        cursorsRef.current.set(update.userId, {
          ...update,
          lastUpdate: Date.now(),
        })
        onCursorUpdate?.(new Map(cursorsRef.current))
      }
    })

    // Listen for element updates from backend (type: element_update)
    const unsubElement = webSocketService.on('element_update', (data: unknown) => {
      const update = data as { elementId: string; changes: Record<string, unknown>; userId: string }
      
      if (update.userId !== userId) {
        onElementUpdate?.(update.elementId, update.changes)
      }
    })

    // Listen for element creation from backend (type: element_create)
    const unsubCreate = webSocketService.on('element_create', (data: unknown) => {
      const payload = data as Record<string, unknown>
      onElementCreate?.(payload)
    })

    // Listen for element deletion from backend (type: element_delete)
    const unsubDelete = webSocketService.on('element_delete', (data: unknown) => {
      const payload = data as Record<string, unknown>
      onElementDelete?.(payload)
    })

    // Listen for user join/leave from backend (type: user_joined / user_left)
    const unsubJoin = webSocketService.on('user_joined', (data: unknown) => {
      const { userId: joinedUserId, userName: joinedUserName } = data as { userId: string; userName: string }
      onUserJoin?.(joinedUserId, joinedUserName)
    })

    const unsubLeave = webSocketService.on('user_left', (data: unknown) => {
      const { userId: leftUserId } = data as { userId: string }
      cursorsRef.current.delete(leftUserId)
      onCursorUpdate?.(new Map(cursorsRef.current))
      onUserLeave?.(leftUserId)
    })

    // Listen for full-sync requests from new joiners
    const unsubSyncReq = webSocketService.on('request_sync', (data: unknown) => {
      const payload = data as { userId: string }
      if (payload.userId !== userId) {
        onSyncRequest?.(payload.userId)
      }
    })

    // Listen for full-sync responses (when we join and someone sends us the state)
    const unsubSyncResp = webSocketService.on('sync_response', (data: unknown) => {
      const payload = data as Record<string, unknown>
      if (payload.targetUserId === userId) {
        onSyncResponse?.(payload)
      }
    })

    cleanupRef.current = [unsubCursor, unsubElement, unsubCreate, unsubDelete, unsubJoin, unsubLeave, unsubSyncReq, unsubSyncResp]

    // Request full sync from existing room members
    webSocketService.send('request_sync', {
      room: `schema:${schemaId}`,
      userId,
    })

    // Cleanup stale cursors every 5 seconds
    const cleanupInterval = setInterval(() => {
      const now = Date.now()
      let hasChanges = false
      
      cursorsRef.current.forEach((cursor, id) => {
        if (now - cursor.lastUpdate > 10000) { // 10 seconds timeout
          cursorsRef.current.delete(id)
          hasChanges = true
        }
      })

      if (hasChanges) {
        onCursorUpdate?.(new Map(cursorsRef.current))
      }
    }, 5000)

    return () => {
      webSocketService.leaveSchema(schemaId)
      cleanupRef.current.forEach(fn => fn())
      clearInterval(cleanupInterval)
    }
  }, [enabled, schemaId, userId, userName, userColor, onCursorUpdate, onElementUpdate, onElementCreate, onElementDelete, onUserJoin, onUserLeave, onSyncRequest, onSyncResponse])

  const sendCursorPosition = useCallback((position: { x: number; y: number }) => {
    if (!enabled || !schemaId) return
    webSocketService.sendCursorPosition(position, { userId, userName, color: userColor })
  }, [enabled, schemaId, userId, userName, userColor])

  const sendElementUpdate = useCallback((elementId: string, changes: Record<string, unknown>) => {
    if (!enabled || !schemaId) return
    webSocketService.sendElementUpdate(elementId, changes, userId)
  }, [enabled, schemaId, userId])

  const sendSelectionUpdate = useCallback((selectedElements: string[]) => {
    if (!enabled || !schemaId) return
    webSocketService.sendSelectionUpdate(selectedElements)
  }, [enabled, schemaId])

  const sendSyncResponse = useCallback((targetUserId: string, nodes: unknown[], edges: unknown[]) => {
    if (!enabled || !schemaId) return
    webSocketService.send('sync_response', {
      room: `schema:${schemaId}`,
      targetUserId,
      nodes,
      edges,
      userId,
    })
  }, [enabled, schemaId, userId])

  const lockElement = useCallback(async (elementId: string): Promise<boolean> => {
    if (!enabled || !schemaId) return false
    return webSocketService.lockElement(elementId)
  }, [enabled, schemaId])

  const unlockElement = useCallback((elementId: string) => {
    if (!enabled || !schemaId) return
    webSocketService.unlockElement(elementId)
  }, [enabled, schemaId])

  return {
    cursors: cursorsRef.current,
    sendCursorPosition,
    sendElementUpdate,
    sendSelectionUpdate,
    sendSyncResponse,
    lockElement,
    unlockElement,
  }
}

export default useCollaboration
