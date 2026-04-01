import { app, BrowserWindow, Tray, Menu, nativeImage } from 'electron'
import path from 'path'
import { setupIpcHandlers } from './ipc'
import { loadConfig, startAgent, stopAgent, setMainWindow, isPaired, reportShutdown } from './agent'
import { initUpdater, startUpdateChecker, stopUpdateChecker } from './updater'

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
let allowQuit = false

// Resolve asset paths — extraResources puts them outside the asar
function assetPath(filename: string): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'assets', filename)
  }
  return path.join(__dirname, '..', 'assets', filename)
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 820,
    height: 580,
    minWidth: 700,
    minHeight: 480,
    title: 'Operate1 Agent',
    frame: false,
    titleBarStyle: 'hidden',
    icon: assetPath('icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: false,
    backgroundColor: '#0f172a',
  })

  mainWindow.loadFile(path.join(__dirname, '..', 'ui', 'index.html'))

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
    setMainWindow(mainWindow!)

    // Start agent AFTER window is visible — don't block rendering
    const cfg = loadConfig()
    if (cfg && isPaired()) {
      startAgent()
      if (process.argv.includes('--hidden')) mainWindow?.hide()
    }

    // Initialize updater with window ref
    initUpdater(mainWindow!, (ch, data) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send(ch, data)
      }
    })
    startUpdateChecker()
  })

  // Minimize to tray instead of closing (unless quit is allowed)
  mainWindow.on('close', (e) => {
    if (!allowQuit) {
      e.preventDefault()
      mainWindow?.hide()
    }
  })
}

function createTray() {
  let trayIcon: Electron.NativeImage
  try {
    trayIcon = nativeImage.createFromPath(assetPath('icon.png'))
    if (trayIcon.isEmpty()) trayIcon = nativeImage.createFromPath(assetPath('icon.ico'))
  } catch {
    trayIcon = nativeImage.createEmpty()
  }

  tray = new Tray(trayIcon)
  tray.setToolTip('Operate1 Agent — Running')

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show Operate1 Agent',
      click: () => { mainWindow?.show(); mainWindow?.focus() },
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => { allowQuit = true; app.quit() },
    },
  ])

  tray.setContextMenu(contextMenu)
  tray.on('double-click', () => { mainWindow?.show(); mainWindow?.focus() })
}

// Allow quit when NSIS installer sends kill signal or user explicitly quits
app.on('before-quit', () => {
  allowQuit = true
  reportShutdown('graceful').catch(() => {})
  stopUpdateChecker()
  stopAgent()
})

app.whenReady().then(() => {
  createWindow()
  createTray()
  setupIpcHandlers()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Keep running in tray when all windows closed
app.on('window-all-closed', () => {
  // Do nothing — stay in tray
})
