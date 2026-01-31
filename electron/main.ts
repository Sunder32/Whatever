import { app, BrowserWindow, ipcMain, dialog, Menu } from 'electron'
import * as path from 'path'
import * as fs from 'fs-extra'
import { fileURLToPath } from 'url'
import Store from 'electron-store'
import { 
  initDatabase, 
  closeDatabase, 
  projectsRepository, 
  schemasRepository, 
  syncQueueRepository,
  settingsRepository 
} from './database.js'

// ESM __dirname polyfill
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const store = new Store()
let mainWindow: BrowserWindow | null = null

const isDev = !app.isPackaged

async function createWindow() {
  // Initialize SQLite database
  try {
    await initDatabase()
    console.log('SQLite database initialized')
  } catch (error) {
    console.error('Failed to initialize database:', error)
  }

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      // Use .mjs extension for ESM preload
      preload: path.join(__dirname, 'preload.mjs'),
      sandbox: false 
    },
    titleBarStyle: 'hiddenInset',
    show: false
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../index.html'))
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  createMenu()
}

function createMenu() {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'File',
      submenu: [
        {
          label: 'New',
          accelerator: 'CmdOrCtrl+N',
          click: () => mainWindow?.webContents.send('menu:new-file')
        },
        {
          label: 'Open',
          accelerator: 'CmdOrCtrl+O',
          click: () => handleOpenFile()
        },
        { type: 'separator' },
        {
          label: 'Save',
          accelerator: 'CmdOrCtrl+S',
          click: () => mainWindow?.webContents.send('menu:save')
        },
        {
          label: 'Save As',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: () => handleSaveAs()
        },
        { type: 'separator' },
        {
          label: 'Export',
          submenu: [
            { label: 'Export as PNG', click: () => mainWindow?.webContents.send('menu:export', 'png') },
            { label: 'Export as SVG', click: () => mainWindow?.webContents.send('menu:export', 'svg') },
            { label: 'Export as PDF', click: () => mainWindow?.webContents.send('menu:export', 'pdf') }
          ]
        },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        {
          label: 'Undo',
          accelerator: 'CmdOrCtrl+Z',
          click: () => mainWindow?.webContents.send('menu:undo')
        },
        {
          label: 'Redo',
          accelerator: 'CmdOrCtrl+Shift+Z',
          click: () => mainWindow?.webContents.send('menu:redo')
        },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'delete' },
        { type: 'separator' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Zoom In',
          accelerator: 'CmdOrCtrl+Plus',
          click: () => mainWindow?.webContents.send('menu:zoom-in')
        },
        {
          label: 'Zoom Out',
          accelerator: 'CmdOrCtrl+-',
          click: () => mainWindow?.webContents.send('menu:zoom-out')
        },
        {
          label: 'Reset Zoom',
          accelerator: 'CmdOrCtrl+0',
          click: () => mainWindow?.webContents.send('menu:zoom-reset')
        },
        { type: 'separator' },
        {
          label: 'Toggle Grid',
          accelerator: "CmdOrCtrl+'",
          click: () => mainWindow?.webContents.send('menu:toggle-grid')
        },
        { type: 'separator' },
        { role: 'toggleDevTools' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About',
          click: () => {
            dialog.showMessageBox({
              type: 'info',
              title: 'About Diagram App',
              message: 'Diagram App v1.0.0',
              detail: 'A cross-platform desktop application for creating diagrams and schemas.'
            })
          }
        }
      ]
    }
  ]

  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
}

async function handleOpenFile() {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openFile'],
    filters: [
      { name: 'WTV Files', extensions: ['wtv'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  })

  if (!result.canceled && result.filePaths.length > 0) {
    const filePath = result.filePaths[0]
    try {
      const content = await fs.readFile(filePath, 'utf-8')
      mainWindow?.webContents.send('file:opened', { path: filePath, content })
    } catch (error) {
      dialog.showErrorBox('Error', `Failed to open file: ${error}`)
    }
  }
}

async function handleSaveAs() {
  const result = await dialog.showSaveDialog(mainWindow!, {
    filters: [
      { name: 'WTV Files', extensions: ['wtv'] }
    ]
  })

  if (!result.canceled && result.filePath) {
    mainWindow?.webContents.send('file:save-as', { path: result.filePath })
  }
}

ipcMain.handle('file:read', async (_, filePath: string) => {
  try {
    const content = await fs.readFile(filePath, 'utf-8')
    return { success: true, content }
  } catch (error) {
    return { success: false, error: String(error) }
  }
})

ipcMain.handle('file:write', async (_, filePath: string, content: string) => {
  try {
    await fs.ensureDir(path.dirname(filePath))
    await fs.writeFile(filePath, content, 'utf-8')
    return { success: true }
  } catch (error) {
    return { success: false, error: String(error) }
  }
})

ipcMain.handle('file:exists', async (_, filePath: string) => {
  return fs.pathExists(filePath)
})

ipcMain.handle('dialog:open', async () => {
  return handleOpenFile()
})

ipcMain.handle('dialog:save', async () => {
  return handleSaveAs()
})

ipcMain.handle('store:get', (_, key: string) => {
  return store.get(key)
})

ipcMain.handle('store:set', (_, key: string, value: unknown) => {
  store.set(key, value)
})

// Database IPC handlers
// Projects
ipcMain.handle('db:projects:getAll', async () => {
  try {
    const projects = await projectsRepository.getAll()
    return { success: true, data: projects }
  } catch (error) {
    return { success: false, error: String(error) }
  }
})

ipcMain.handle('db:projects:getById', async (_, id: string) => {
  try {
    const project = await projectsRepository.getById(id)
    return { success: true, data: project }
  } catch (error) {
    return { success: false, error: String(error) }
  }
})

ipcMain.handle('db:projects:create', async (_, project) => {
  try {
    const created = await projectsRepository.create(project)
    return { success: true, data: created }
  } catch (error) {
    return { success: false, error: String(error) }
  }
})

ipcMain.handle('db:projects:update', async (_, id: string, data) => {
  try {
    const updated = await projectsRepository.update(id, data)
    return { success: true, data: updated }
  } catch (error) {
    return { success: false, error: String(error) }
  }
})

ipcMain.handle('db:projects:delete', async (_, id: string) => {
  try {
    await projectsRepository.delete(id)
    return { success: true }
  } catch (error) {
    return { success: false, error: String(error) }
  }
})

// Schemas
ipcMain.handle('db:schemas:getByProjectId', async (_, projectId: string) => {
  try {
    const schemas = await schemasRepository.getByProjectId(projectId)
    return { success: true, data: schemas }
  } catch (error) {
    return { success: false, error: String(error) }
  }
})

ipcMain.handle('db:schemas:getById', async (_, id: string) => {
  try {
    const schema = await schemasRepository.getById(id)
    return { success: true, data: schema }
  } catch (error) {
    return { success: false, error: String(error) }
  }
})

ipcMain.handle('db:schemas:create', async (_, schema) => {
  try {
    const created = await schemasRepository.create(schema)
    return { success: true, data: created }
  } catch (error) {
    return { success: false, error: String(error) }
  }
})

ipcMain.handle('db:schemas:update', async (_, id: string, data) => {
  try {
    const updated = await schemasRepository.update(id, data)
    return { success: true, data: updated }
  } catch (error) {
    return { success: false, error: String(error) }
  }
})

ipcMain.handle('db:schemas:delete', async (_, id: string) => {
  try {
    await schemasRepository.delete(id)
    return { success: true }
  } catch (error) {
    return { success: false, error: String(error) }
  }
})

// Sync Queue
ipcMain.handle('db:syncQueue:add', async (_, item) => {
  try {
    await syncQueueRepository.add(item)
    return { success: true }
  } catch (error) {
    return { success: false, error: String(error) }
  }
})

ipcMain.handle('db:syncQueue:getPending', async () => {
  try {
    const items = await syncQueueRepository.getPending()
    return { success: true, data: items }
  } catch (error) {
    return { success: false, error: String(error) }
  }
})

ipcMain.handle('db:syncQueue:markCompleted', async (_, id: string) => {
  try {
    await syncQueueRepository.markCompleted(id)
    return { success: true }
  } catch (error) {
    return { success: false, error: String(error) }
  }
})

ipcMain.handle('db:syncQueue:markFailed', async (_, id: string, errorMessage: string) => {
  try {
    await syncQueueRepository.markFailed(id, errorMessage)
    return { success: true }
  } catch (error) {
    return { success: false, error: String(error) }
  }
})

// Settings
ipcMain.handle('db:settings:get', async (_, key: string) => {
  try {
    const value = await settingsRepository.get(key)
    return { success: true, data: value }
  } catch (error) {
    return { success: false, error: String(error) }
  }
})

ipcMain.handle('db:settings:set', async (_, key: string, value: unknown) => {
  try {
    await settingsRepository.set(key, value)
    return { success: true }
  } catch (error) {
    return { success: false, error: String(error) }
  }
})

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    closeDatabase().then(() => {
      app.quit()
    })
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})
