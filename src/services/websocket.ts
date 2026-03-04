import { API_BASE_URL } from '@/api/client'

type MessageHandler = (data: unknown) => void
type ConnectionHandler = () => void

interface WebSocketMessage {
  type: string
  payload: unknown
  timestamp: string
}

/**
 * Derive WebSocket URL from API base URL
 */
export function getWebSocketUrl(): string {
  if (API_BASE_URL.startsWith('/')) {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    return `${protocol}//${window.location.host}/ws`
  }
  try {
    const url = new URL(API_BASE_URL)
    const wsProtocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
    return `${wsProtocol}//${url.host}/ws`
  } catch {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    return `${protocol}//${window.location.host}/ws`
  }
}

class WebSocketService {
  private ws: WebSocket | null = null
  private url: string = ''
  private token: string = ''
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectDelay = 1000
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null
  private messageHandlers: Map<string, Set<MessageHandler>> = new Map()
  private connectionHandlers: Set<ConnectionHandler> = new Set()
  private disconnectionHandlers: Set<ConnectionHandler> = new Set()
  private isConnecting = false
  private currentSchemaId: string | null = null

  init(url: string, token: string) {
    this.url = url
    this.token = token
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        resolve()
        return
      }

      if (this.isConnecting) {
        // Wait for existing connection
        const checkInterval = setInterval(() => {
          if (this.ws?.readyState === WebSocket.OPEN) {
            clearInterval(checkInterval)
            resolve()
          }
        }, 100)
        return
      }

      this.isConnecting = true
      const wsUrl = `${this.url}?token=${this.token}`

      try {
        this.ws = new WebSocket(wsUrl)

        this.ws.onopen = () => {
          if (import.meta.env.DEV) console.debug('WebSocket connected')
          this.isConnecting = false
          this.reconnectAttempts = 0
          this.startHeartbeat()
          this.connectionHandlers.forEach(handler => handler())
          resolve()
        }

        this.ws.onmessage = (event) => {
          try {
            // The Go backend may batch multiple JSON messages into a single
            // WebSocket frame separated by newlines (writePump optimization).
            // Split on newlines and parse each message individually.
            const raw = event.data as string
            const parts = raw.split('\n').filter(Boolean)
            for (const part of parts) {
              try {
                const message: WebSocketMessage = JSON.parse(part)
                this.handleMessage(message)
              } catch (innerError) {
                console.error('Failed to parse WebSocket message part:', innerError)
              }
            }
          } catch (error) {
            console.error('Failed to process WebSocket message:', error)
          }
        }

        this.ws.onclose = () => {
          if (import.meta.env.DEV) console.debug('WebSocket disconnected')
          this.isConnecting = false
          this.stopHeartbeat()
          this.disconnectionHandlers.forEach(handler => handler())
          this.attemptReconnect()
        }

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error)
          this.isConnecting = false
          reject(error)
        }
      } catch (error) {
        this.isConnecting = false
        reject(error)
      }
    })
  }

  disconnect() {
    this.stopHeartbeat()
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
    this.reconnectAttempts = this.maxReconnectAttempts // Prevent reconnection
  }

  private attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.warn('Max reconnection attempts reached')
      return
    }

    this.reconnectAttempts++
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1)
    
    if (import.meta.env.DEV) console.debug(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`)
    
    setTimeout(() => {
      this.connect().catch(console.error)
    }, delay)
  }

  private startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      this.send('ping', {})
    }, 30000) // Every 30 seconds
  }

  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = null
    }
  }

  private handleMessage(message: WebSocketMessage) {
    const handlers = this.messageHandlers.get(message.type)
    if (handlers) {
      handlers.forEach(handler => handler(message.payload))
    }

    // Also notify 'all' handlers
    const allHandlers = this.messageHandlers.get('*')
    if (allHandlers) {
      allHandlers.forEach(handler => handler(message))
    }
  }

  send(type: string, payload: unknown) {
    if (this.ws?.readyState !== WebSocket.OPEN) {
      console.warn('WebSocket not connected, message not sent:', type)
      return false
    }

    const message: WebSocketMessage = {
      type,
      payload,
      timestamp: new Date().toISOString(),
    }

    this.ws.send(JSON.stringify(message))
    return true
  }

  on(type: string, handler: MessageHandler): () => void {
    if (!this.messageHandlers.has(type)) {
      this.messageHandlers.set(type, new Set())
    }
    this.messageHandlers.get(type)!.add(handler)

    // Return unsubscribe function
    return () => {
      this.messageHandlers.get(type)?.delete(handler)
    }
  }

  off(type: string, handler: MessageHandler) {
    this.messageHandlers.get(type)?.delete(handler)
  }

  onConnect(handler: ConnectionHandler): () => void {
    this.connectionHandlers.add(handler)
    return () => this.connectionHandlers.delete(handler)
  }

  onDisconnect(handler: ConnectionHandler): () => void {
    this.disconnectionHandlers.add(handler)
    return () => this.disconnectionHandlers.delete(handler)
  }

  // Schema-specific methods (reference-counted to support multiple hooks)
  private schemaRefCounts: Map<string, number> = new Map()

  joinSchema(schemaId: string) {
    const count = this.schemaRefCounts.get(schemaId) || 0
    this.schemaRefCounts.set(schemaId, count + 1)
    if (count === 0) {
      this.currentSchemaId = schemaId
      this.send('join_room', { room: `schema:${schemaId}` })
    }
  }

  leaveSchema(schemaId: string) {
    const count = this.schemaRefCounts.get(schemaId) || 0
    if (count <= 1) {
      this.schemaRefCounts.delete(schemaId)
      if (this.currentSchemaId === schemaId) {
        this.currentSchemaId = null
      }
      this.send('leave_room', { room: `schema:${schemaId}` })
    } else {
      this.schemaRefCounts.set(schemaId, count - 1)
    }
  }

  // Cursor updates for real-time collaboration
  sendCursorPosition(position: { x: number; y: number }, meta?: { userId?: string; userName?: string; color?: string }) {
    if (!this.currentSchemaId) return
    
    this.send('cursor_move', {
      room: `schema:${this.currentSchemaId}`,
      position,
      ...meta,
    })
  }

  // Selection updates
  sendSelectionUpdate(selectedElements: string[]) {
    if (!this.currentSchemaId) return
    
    this.send('selection_change', {
      room: `schema:${this.currentSchemaId}`,
      selectedElements,
    })
  }

  // Element updates for collaborative editing
  sendElementUpdate(elementId: string, changes: Record<string, unknown>, userId?: string) {
    if (!this.currentSchemaId) return
    
    this.send('element_update', {
      room: `schema:${this.currentSchemaId}`,
      elementId,
      changes,
      userId,
    })
  }

  // Lock element for editing
  lockElement(elementId: string): Promise<boolean> {
    return new Promise((resolve) => {
      if (!this.currentSchemaId) {
        resolve(false)
        return
      }

      const unsubscribe = this.on('element_lock_response', (data: unknown) => {
        const response = data as { elementId: string; success: boolean }
        if (response.elementId === elementId) {
          unsubscribe()
          resolve(response.success)
        }
      })

      this.send('element_lock', {
        room: `schema:${this.currentSchemaId}`,
        elementId,
      })

      // Timeout after 5 seconds
      setTimeout(() => {
        unsubscribe()
        resolve(false)
      }, 5000)
    })
  }

  unlockElement(elementId: string) {
    if (!this.currentSchemaId) return
    
    this.send('element_unlock', {
      room: `schema:${this.currentSchemaId}`,
      elementId,
    })
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN
  }
}

export const webSocketService = new WebSocketService()
export default webSocketService
