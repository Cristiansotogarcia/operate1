import { app, BrowserWindow, Tray, Menu, nativeImage } from 'electron'
import path from 'path'
import { setupIpcHandlers } from './ipc'
import { loadConfig, startAgent, stopAgent, setMainWindow, isPaired, reportShutdown } from './agent'
import { initUpdater, startUpdateChecker, stopUpdateChecker } from './updater'

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 820,
    height: 580,
    minWidth: 700,
    minHeight: 480,
    title: 'Operate1 Agent',
    frame: false,
    titleBarStyle: 'hidden',
    icon: path.join(__dirname, '..', 'assets', 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: false,
    backgroundColor: '#0f172a',
    closable: false, // Prevent Alt+F4 closing
  })

  mainWindow.loadFile(path.join(__dirname, '..', 'ui', 'index.html'))

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
    setMainWindow(mainWindow!)

    // Initialize updater with window ref
    initUpdater(mainWindow!, (ch, data) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send(ch, data)
      }
    })
    startUpdateChecker()
  })

  // Always minimize to tray — never close
  mainWindow.on('close', (e) => {
    e.preventDefault()
    mainWindow?.hide()
  })
}

function createTray() {
  let trayIcon: Electron.NativeImage
  const iconPath = path.join(__dirname, '..', 'assets', 'icon.ico')
  try {
    trayIcon = nativeImage.createFromPath(iconPath)
  } catch {
    trayIcon = nativeImage.createEmpty()
  }

  tray = new Tray(trayIcon)
  tray.setToolTip('Operate1 Agent — Running')

  // No "Quit" option — only admins can uninstall via Control Panel
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show Operate1 Agent',
      click: () => { mainWindow?.show(); mainWindow?.focus() },
    },
    { type: 'separator' },
    {
      label: 'About',
      click: () => { mainWindow?.show(); mainWindow?.focus() },
    },
  ])

  tray.setContextMenu(contextMenu)
  tray.on('double-click', () => { mainWindow?.show(); mainWindow?.focus() })
}

// Prevent quitting — the app should always run
app.on('before-quit', async (e) => {
  // Only allow quit if explicitly forced (e.g., during uninstall)
  if (!process.env.OPERATE1_FORCE_QUIT) {
    e.preventDefault()
    mainWindow?.hide()
  } else {
    // Report graceful shutdown before quitting
    await reportShutdown('graceful')
    stopUpdateChecker()
  }
})

app.whenReady().then(() => {
  createWindow()
  createTray()
  setupIpcHandlers()

  // Auto-start agent if already paired
  const cfg = loadConfig()
  if (cfg && isPaired()) {
    startAgent()
    // If launched at boot with --hidden, stay in tray
    if (process.argv.includes('--hidden')) {
      mainWindow?.hide()
    }
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Prevent window-all-closed from quitting
app.on('window-all-closed', () => {
  // Do nothing — keep running in tray
})
