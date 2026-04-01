import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'

function fetchAndSetProfile(userId: string) {
  const { setProfile, setLoading } = useAuthStore.getState()
  supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()
    .then(({ data, error }) => {
      setProfile(error ? null : data ?? null)
      setLoading(false)
    })
}

export function useAuthInit() {
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        const store = useAuthStore.getState()

        if (event === 'SIGNED_OUT') {
          store.reset()
          return
        }

        if (session?.user) {
          store.setSession(session)
          store.setUser(session.user)

          // Fetch profile if needed (non-blocking, uses .then not await)
          if (!store.profile || store.profile.id !== session.user.id || event === 'SIGNED_IN' || event === 'USER_UPDATED') {
            fetchAndSetProfile(session.user.id)
          } else {
            // Profile already loaded, just stop loading
            store.setLoading(false)
          }
        } else if (event === 'INITIAL_SESSION') {
          // No session found on page load — go to login
          store.setLoading(false)
        }
      }
    )

    // Safety net
    const timeout = setTimeout(() => {
      const { loading } = useAuthStore.getState()
      if (loading) useAuthStore.getState().setLoading(false)
    }, 8000)

    return () => {
      clearTimeout(timeout)
      subscription.unsubscribe()
    }
  }, [])
}

export function useAuth() {
  return useAuthStore()
}
