import { ipcMain, app, BrowserWindow } from 'electron'
import {
  getMetrics, getStatus, getConfig, collectMetrics,
  pairWithCode, unpair, startAgent, isPaired,
} from './agent'
import { checkForUpdate } from './updater'

export function setupIpcHandlers() {
  ipcMain.handle('agent:get-metrics', async () => getMetrics() ?? await collectMetrics())
  ipcMain.handle('agent:get-status', () => getStatus())
  ipcMain.handle('agent:get-config', () => getConfig())
  ipcMain.handle('agent:is-paired', () => isPaired())
  ipcMain.handle('agent:pair', async (_e, code: string) => pairWithCode(code))
  ipcMain.handle('agent:unpair', () => { unpair(); return { success: true } })
  ipcMain.handle('agent:start', () => { startAgent(); return { success: true } })
  ipcMain.handle('agent:check-update', async () => checkForUpdate())
  ipcMain.handle('get-app-version', () => app.getVersion())
  ipcMain.handle('window:minimize', (e) => BrowserWindow.fromWebContents(e.sender)?.minimize())
  ipcMain.handle('window:close', (e) => BrowserWindow.fromWebContents(e.sender)?.hide())
}
