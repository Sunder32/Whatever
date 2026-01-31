type MessageHandler = (data: unknown) => void
type ConnectionHandler = () => void

interface WebSocketMessage {
  type: string
  payload: unknown
  timestamp: string
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
          console.log('WebSocket connected')
          this.isConnecting = false
          this.reconnectAttempts = 0
          this.startHeartbeat()
          this.connectionHandlers.forEach(handler => handler())
          resolve()
        }

        this.ws.onmessage = (event) => {
          try {
            const message: WebSocketMessage = JSON.parse(event.data)
            this.handleMessage(message)
          } catch (error) {
            console.error('Failed to parse WebSocket message:', error)
          }
        }

        this.ws.onclose = () => {
          console.log('WebSocket disconnected')
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
      console.log('Max reconnection attempts reached')
      return
    }

    this.reconnectAttempts++
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1)
    
    console.log(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`)
    
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

  // Schema-specific methods
  joinSchema(schemaId: string) {
    this.currentSchemaId = schemaId
    this.send('schema:join', { schemaId })
  }

  leaveSchema(schemaId: string) {
    if (this.currentSchemaId === schemaId) {
      this.currentSchemaId = null
    }
    this.send('schema:leave', { schemaId })
  }

  // Cursor updates for real-time collaboration
  sendCursorPosition(position: { x: number; y: number }) {
    if (!this.currentSchemaId) return
    
    this.send('cursor:move', {
      schemaId: this.currentSchemaId,
      position,
    })
  }

  // Selection updates
  sendSelectionUpdate(selectedElements: string[]) {
    if (!this.currentSchemaId) return
    
    this.send('selection:update', {
      schemaId: this.currentSchemaId,
      selectedElements,
    })
  }

  // Element updates for collaborative editing
  sendElementUpdate(elementId: string, changes: Record<string, unknown>) {
    if (!this.currentSchemaId) return
    
    this.send('element:update', {
      schemaId: this.currentSchemaId,
      elementId,
      changes,
    })
  }

  // Lock element for editing
  lockElement(elementId: string): Promise<boolean> {
    return new Promise((resolve) => {
      if (!this.currentSchemaId) {
        resolve(false)
        return
      }

      const unsubscribe = this.on('element:lock:response', (data: unknown) => {
        const response = data as { elementId: string; success: boolean }
        if (response.elementId === elementId) {
          unsubscribe()
          resolve(response.success)
        }
      })

      this.send('element:lock', {
        schemaId: this.currentSchemaId,
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
    
    this.send('element:unlock', {
      schemaId: this.currentSchemaId,
      elementId,
    })
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN
  }
}

export const webSocketService = new WebSocketService()
export default webSocketService
