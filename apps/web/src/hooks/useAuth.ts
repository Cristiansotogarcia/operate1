import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'

export function useAuthInit() {
  const { setUser, setSession, setProfile, setLoading, reset } = useAuthStore()

  useEffect(() => {
    // Supabase v2: onAuthStateChange fires INITIAL_SESSION first,
    // then TOKEN_REFRESHED if the access token was expired.
    // We use this as the single source of truth — NOT getSession().
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        // INITIAL_SESSION: first event on page load — session from localStorage
        // TOKEN_REFRESHED: access token was expired, new one obtained
        // SIGNED_IN: user just logged in
        // SIGNED_OUT: user logged out

        if (event === 'SIGNED_OUT' || (!session?.user && event !== 'INITIAL_SESSION')) {
          reset()
          return
        }

        if (session?.user) {
          setSession(session)
          setUser(session.user)

          const current = useAuthStore.getState()
          // Fetch profile if we don't have one or user changed
          if (!current.profile || current.profile.id !== session.user.id || event === 'USER_UPDATED') {
            try {
              const { data } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', session.user.id)
                .single()
              setProfile(data)
            } catch {
              setProfile(null)
            }
          }
          setLoading(false)
        } else if (event === 'INITIAL_SESSION') {
          // No session on initial load — not logged in
          setLoading(false)
        }
      }
    )

    // Safety net: if onAuthStateChange never fires (shouldn't happen), unblock after 8s
    const timeout = setTimeout(() => {
      const { loading } = useAuthStore.getState()
      if (loading) setLoading(false)
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
