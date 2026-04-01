import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'

export function useAuthInit() {
  const { setUser, setSession, setProfile, setLoading, reset } = useAuthStore()

  useEffect(() => {
    let initialised = false

    // Get initial session — must ALWAYS call setLoading(false)
    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        if (initialised) return
        initialised = true
        setSession(session)
        setUser(session?.user ?? null)
        if (session?.user) {
          fetchProfile(session.user.id).finally(() => setLoading(false))
        } else {
          setLoading(false)
        }
      })
      .catch(() => {
        // Session restore failed (expired refresh token, network error, etc.)
        if (!initialised) {
          initialised = true
          reset() // clears everything and sets loading=false
        }
      })

    // Safety net: if nothing resolves within 5s, stop loading
    const timeout = setTimeout(() => {
      if (!initialised) {
        initialised = true
        reset()
      }
    }, 5000)

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        // Handle initial session event (Supabase v2 fires this)
        if (event === 'INITIAL_SESSION') {
          if (!initialised) {
            initialised = true
            setSession(session)
            setUser(session?.user ?? null)
            if (session?.user) {
              fetchProfile(session.user.id).finally(() => setLoading(false))
            } else {
              setLoading(false)
            }
          }
          return
        }

        if (event === 'SIGNED_OUT' || !session?.user) {
          reset()
          return
        }

        // Always keep session in sync for token refreshes
        setSession(session)
        setUser(session.user)

        // Refetch profile on sign-in, user update, or identity change
        const current = useAuthStore.getState()
        if (event === 'SIGNED_IN' || event === 'USER_UPDATED' || current.profile?.id !== session.user.id) {
          await fetchProfile(session.user.id)
        }
      }
    )

    return () => {
      clearTimeout(timeout)
      subscription.unsubscribe()
    }
  }, [])

  async function fetchProfile(userId: string) {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()
      setProfile(data)
    } catch {
      // Profile fetch failed — don't crash, just leave profile null
      setProfile(null)
    }
  }
}

export function useAuth() {
  return useAuthStore()
}
