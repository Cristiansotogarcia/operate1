import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  // Create a new user via service role (bypasses RLS)
  createUser: (email: string, password: string, fullName: string, role: string) =>
    ipcRenderer.invoke('create-user', { email, password, fullName, role }),

  // App info
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),

  // Platform
  platform: process.platform,
})
