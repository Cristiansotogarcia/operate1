import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('agent', {
  pair: (code: string) => ipcRenderer.invoke('agent:pair', code),
  unpair: () => ipcRenderer.invoke('agent:unpair'),
  isPaired: () => ipcRenderer.invoke('agent:is-paired'),
  start: () => ipcRenderer.invoke('agent:start'),
  getMetrics: () => ipcRenderer.invoke('agent:get-metrics'),
  getStatus: () => ipcRenderer.invoke('agent:get-status'),
  getConfig: () => ipcRenderer.invoke('agent:get-config'),
  minimize: () => ipcRenderer.invoke('window:minimize'),
  close: () => ipcRenderer.invoke('window:close'),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  onMetricsUpdate: (cb: (data: any) => void) => ipcRenderer.on('metrics-update', (_e, d) => cb(d)),
  onStatusUpdate: (cb: (data: any) => void) => ipcRenderer.on('status-update', (_e, d) => cb(d)),
  platform: process.platform,
})
