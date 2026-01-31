import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  file: {
    read: (path: string) => ipcRenderer.invoke('file:read', path),
    write: (path: string, content: string) => ipcRenderer.invoke('file:write', path, content),
    exists: (path: string) => ipcRenderer.invoke('file:exists', path),
  },
  
  dialog: {
    open: () => ipcRenderer.invoke('dialog:open'),
    save: () => ipcRenderer.invoke('dialog:save'),
  },
  
  store: {
    get: (key: string) => ipcRenderer.invoke('store:get', key),
    set: (key: string, value: unknown) => ipcRenderer.invoke('store:set', key, value),
  },
  
  // Local SQLite Database API
  db: {
    projects: {
      getAll: () => ipcRenderer.invoke('db:projects:getAll'),
      getById: (id: string) => ipcRenderer.invoke('db:projects:getById', id),
      create: (project: unknown) => ipcRenderer.invoke('db:projects:create', project),
      update: (id: string, data: unknown) => ipcRenderer.invoke('db:projects:update', id, data),
      delete: (id: string) => ipcRenderer.invoke('db:projects:delete', id),
    },
    schemas: {
      getByProjectId: (projectId: string) => ipcRenderer.invoke('db:schemas:getByProjectId', projectId),
      getById: (id: string) => ipcRenderer.invoke('db:schemas:getById', id),
      create: (schema: unknown) => ipcRenderer.invoke('db:schemas:create', schema),
      update: (id: string, data: unknown) => ipcRenderer.invoke('db:schemas:update', id, data),
      delete: (id: string) => ipcRenderer.invoke('db:schemas:delete', id),
    },
    syncQueue: {
      add: (item: unknown) => ipcRenderer.invoke('db:syncQueue:add', item),
      getPending: () => ipcRenderer.invoke('db:syncQueue:getPending'),
      markCompleted: (id: string) => ipcRenderer.invoke('db:syncQueue:markCompleted', id),
      markFailed: (id: string, errorMessage: string) => ipcRenderer.invoke('db:syncQueue:markFailed', id, errorMessage),
    },
    settings: {
      get: (key: string) => ipcRenderer.invoke('db:settings:get', key),
      set: (key: string, value: unknown) => ipcRenderer.invoke('db:settings:set', key, value),
    }
  },
  
  on: (channel: string, callback: (...args: unknown[]) => void) => {
    const subscription = (_: Electron.IpcRendererEvent, ...args: unknown[]) => callback(...args)
    ipcRenderer.on(channel, subscription)
    return () => ipcRenderer.removeListener(channel, subscription)
  }
})
