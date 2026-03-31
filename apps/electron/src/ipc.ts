import { ipcMain, app } from 'electron'
import { createClient } from '@supabase/supabase-js'

// Service role client — only used in the main process for admin operations
function getServiceClient() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

  if (!url || !serviceKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables')
  }

  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export function setupIpcHandlers() {
  // Create a new auth user + profile using service role
  ipcMain.handle('create-user', async (_event, payload: {
    email: string
    password: string
    fullName: string
    role: string
  }) => {
    try {
      const supabase = getServiceClient()

      // 1. Create auth user
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: payload.email,
        password: payload.password,
        email_confirm: true,
        user_metadata: { full_name: payload.fullName },
      })

      if (authError) {
        return { success: false, error: authError.message }
      }

      // 2. Update profile with role (trigger creates the profile row)
      if (authData.user) {
        const { error: profileError } = await supabase
          .from('profiles')
          .update({
            full_name: payload.fullName,
            role: payload.role,
          })
          .eq('id', authData.user.id)

        if (profileError) {
          return { success: false, error: `User created but profile update failed: ${profileError.message}` }
        }
      }

      return { success: true, userId: authData.user?.id }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // Return app version
  ipcMain.handle('get-app-version', () => {
    return app.getVersion()
  })
}
