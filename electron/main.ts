import { app, shell, BrowserWindow } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { registerStorageIpc } from './ipc/storage-ipc'
import { registerHSeriesIpc } from './ipc/hseries-ipc'
import { registerTUSeriesIpc } from './ipc/tuseries-ipc'
import { registerVXSeriesIpc } from './ipc/vxseries-ipc'
import { registerMCTRLIpc } from './ipc/mctrl-ipc'
import { registerVXProIpc } from './ipc/vxpro-ipc'
import { registerTaurusIpc } from './ipc/taurus-ipc'

/**
 * LEDECA — Electron Main Process
 * 
 * Responsibilities:
 *  - Window lifecycle management
 *  - IPC handler registration (one per module, isolated)
 *  - Node-level device access (TCP sockets, serial ports)
 *  - File system / storage access
 */

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    show: false,
    autoHideMenuBar: true,
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#0A0E1A',
      symbolColor: '#a0aec0',
      height: 32
    },
    backgroundColor: '#0A0E1A',
    icon: join(__dirname, '../renderer/assets/icon.png'),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      // SECURITY: contextIsolation MUST be true
      contextIsolation: true,
      // SECURITY: nodeIntegration MUST be false in renderer
      nodeIntegration: false,
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // Load the renderer
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  // Set app user model id for Windows
  electronApp.setAppUserModelId('com.ledeck.novastar')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // ── Register all IPC handlers ─────────────────────────────────────────────
  // Each module registers its own isolated handlers.
  // An error in one module's handler DOES NOT affect other modules.
  registerStorageIpc()
  registerHSeriesIpc()
  registerTUSeriesIpc()
  registerVXSeriesIpc()
  registerMCTRLIpc()
  registerVXProIpc()
  registerTaurusIpc()

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
