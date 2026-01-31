/**
 * Simple Event Bus for decoupling Zustand stores
 * Eliminates circular dependencies between authStore, projectStore, diagramStore
 */

type EventCallback<T = unknown> = (data: T) => void | Promise<void>

interface EventBus {
  on<T = unknown>(event: string, callback: EventCallback<T>): () => void
  off<T = unknown>(event: string, callback: EventCallback<T>): void
  emit<T = unknown>(event: string, data?: T): void
  once<T = unknown>(event: string, callback: EventCallback<T>): () => void
}

class EventBusImpl implements EventBus {
  private listeners: Map<string, Set<EventCallback>> = new Map()

  on<T = unknown>(event: string, callback: EventCallback<T>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)!.add(callback as EventCallback)
    
    // Return unsubscribe function
    return () => this.off(event, callback)
  }

  off<T = unknown>(event: string, callback: EventCallback<T>): void {
    const callbacks = this.listeners.get(event)
    if (callbacks) {
      callbacks.delete(callback as EventCallback)
    }
  }

  emit<T = unknown>(event: string, data?: T): void {
    const callbacks = this.listeners.get(event)
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(data)
        } catch (error) {
          console.error(`Error in event handler for "${event}":`, error)
        }
      })
    }
  }

  once<T = unknown>(event: string, callback: EventCallback<T>): () => void {
    const wrappedCallback: EventCallback<T> = (data) => {
      this.off(event, wrappedCallback)
      callback(data)
    }
    return this.on(event, wrappedCallback)
  }
}

// Singleton instance
export const eventBus = new EventBusImpl()

// Event type definitions for type safety
export const AppEvents = {
  // Auth events
  AUTH_LOGIN: 'auth:login',
  AUTH_LOGOUT: 'auth:logout',
  AUTH_PROFILE_UPDATED: 'auth:profile-updated',
  
  // Project events
  PROJECT_CREATED: 'project:created',
  PROJECT_UPDATED: 'project:updated',
  PROJECT_DELETED: 'project:deleted',
  PROJECT_SELECTED: 'project:selected',
  
  // Diagram events
  DIAGRAM_LOADED: 'diagram:loaded',
  DIAGRAM_SAVED: 'diagram:saved',
  DIAGRAM_MODIFIED: 'diagram:modified',
  
  // Store reset events
  RESET_PROJECT_STORE: 'store:reset-project',
  RESET_DIAGRAM_STORE: 'store:reset-diagram',
  FETCH_FOLLOWING: 'store:fetch-following',
  
  // Sync events
  SYNC_REQUIRED: 'sync:required',
  SYNC_COMPLETED: 'sync:completed',
  SYNC_CONFLICT: 'sync:conflict',
  
  // UI events
  TOAST_SHOW: 'ui:toast-show',
  MODAL_OPEN: 'ui:modal-open',
  MODAL_CLOSE: 'ui:modal-close',
} as const

// Type for event payloads
export interface EventPayloads {
  [AppEvents.AUTH_LOGIN]: { userId: string }
  [AppEvents.AUTH_LOGOUT]: undefined
  [AppEvents.AUTH_PROFILE_UPDATED]: { userId: string }
  [AppEvents.PROJECT_CREATED]: { projectId: string }
  [AppEvents.PROJECT_UPDATED]: { projectId: string }
  [AppEvents.PROJECT_DELETED]: { projectId: string }
  [AppEvents.PROJECT_SELECTED]: { projectId: string }
  [AppEvents.DIAGRAM_LOADED]: { schemaId: string }
  [AppEvents.DIAGRAM_SAVED]: { schemaId: string }
  [AppEvents.DIAGRAM_MODIFIED]: { schemaId: string }
  [AppEvents.RESET_PROJECT_STORE]: undefined
  [AppEvents.RESET_DIAGRAM_STORE]: undefined
  [AppEvents.FETCH_FOLLOWING]: undefined
  [AppEvents.SYNC_REQUIRED]: { schemaId: string }
  [AppEvents.SYNC_COMPLETED]: { schemaId: string }
  [AppEvents.SYNC_CONFLICT]: { schemaId: string; conflictData: unknown }
  [AppEvents.TOAST_SHOW]: { message: string; type: 'success' | 'error' | 'warning' | 'info' }
  [AppEvents.MODAL_OPEN]: { modalId: string }
  [AppEvents.MODAL_CLOSE]: { modalId: string }
}

export default eventBus
