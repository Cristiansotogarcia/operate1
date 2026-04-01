// Remote update checker — polls Supabase for newer agent versions

import { app, BrowserWindow, dialog, shell } from 'electron'
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config'

interface UpdateInfo {
  version: string
  download_url: string
  release_notes: string | null
  is_mandatory: boolean
}

let checkTimer: ReturnType<typeof setInterval> | null = null
let mainWin: BrowserWindow | null = null
let sendFn: (channel: string, data: unknown) => void = () => {}

export function initUpdater(win: BrowserWindow, send: (ch: string, data: unknown) => void) {
  mainWin = win
  sendFn = send
}

export function startUpdateChecker() {
  // Check on startup (after 10s delay) and then every 2 hours
  setTimeout(() => checkForUpdate(), 10000)
  checkTimer = setInterval(() => checkForUpdate(), 2 * 60 * 60 * 1000)
}

export function stopUpdateChecker() {
  if (checkTimer) { clearInterval(checkTimer); checkTimer = null }
}

export async function checkForUpdate(): Promise<UpdateInfo | null> {
  try {
    const currentVersion = app.getVersion()
    const platform = process.platform

    const resp = await fetch(
      `${SUPABASE_URL}/rest/v1/agent_updates?platform=eq.${platform}&order=published_at.desc&limit=1`,
      {
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        },
      }
    )

    if (!resp.ok) return null

    const rows = await resp.json() as UpdateInfo[]
    if (!rows.length) return null

    const latest = rows[0]
    if (!isNewer(latest.version, currentVersion)) return null

    // Notify renderer
    sendFn('update-available', {
      version: latest.version,
      release_notes: latest.release_notes,
      is_mandatory: latest.is_mandatory,
      download_url: latest.download_url,
    })

    // If mandatory, show a blocking dialog
    if (latest.is_mandatory && mainWin) {
      const result = await dialog.showMessageBox(mainWin, {
        type: 'warning',
        title: 'Update Required',
        message: `Operate1 Agent v${latest.version} is required.`,
        detail: latest.release_notes || 'Please update to continue.',
        buttons: ['Download Update', 'Later'],
        defaultId: 0,
      })
      if (result.response === 0) {
        shell.openExternal(latest.download_url)
      }
    }

    return latest
  } catch {
    return null
  }
}

function isNewer(remote: string, local: string): boolean {
  const r = remote.replace(/^v/, '').split('.').map(Number)
  const l = local.replace(/^v/, '').split('.').map(Number)
  for (let i = 0; i < 3; i++) {
    if ((r[i] || 0) > (l[i] || 0)) return true
    if ((r[i] || 0) < (l[i] || 0)) return false
  }
  return false
}
