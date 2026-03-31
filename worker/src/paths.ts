import path from 'path'

// When compiled with pkg, __dirname points to a virtual snapshot filesystem.
// Use the directory containing the executable instead.
export const APP_DIR = (process as any).pkg
  ? path.dirname(process.execPath)
  : path.join(__dirname, '..')
