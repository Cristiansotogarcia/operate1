export interface ElectronAPI {
  createUser: (
    email: string,
    password: string,
    fullName: string,
    role: string
  ) => Promise<{ success: boolean; userId?: string; error?: string }>
  getAppVersion: () => Promise<string>
  platform: string
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI
  }
}
