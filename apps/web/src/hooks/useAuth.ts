import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'

export function useAuthInit() {
  const { setUser, setSession, setProfile, setLoading, reset } = useAuthStore()

  useEffect(() => {
    // Determine initial session once — loading starts true (authStore default).
    // setLoading(false) is called exactly once after this resolves, then never again.
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchProfile(session.user.id).finally(() => setLoading(false))
      } else {
        setLoading(false)
      }
    })

    // Auth state changes — only act on real sign-in/sign-out transitions.
    // TOKEN_REFRESHED and duplicate SIGNED_IN events (fired on tab focus)
    // must NOT update the store or they trigger cascading re-renders and
    // re-fetches that overwhelm the Supabase free-tier connection pool.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        const current = useAuthStore.getState()

        if (event === 'SIGNED_OUT' || !session?.user) {
          if (current.user) reset()
          return
        }

        // Only update session/user when the identity actually changes
        if (session.user.id !== current.user?.id) {
          setSession(session)
          setUser(session.user)
          await fetchProfile(session.user.id)
        }

        // USER_UPDATED — profile may have changed (e.g. after Account page save)
        if (event === 'USER_UPDATED') {
          await fetchProfile(session.user.id)
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  // fetchProfile never touches loading — the spinner is only the app's initial boot state.
  async function fetchProfile(userId: string) {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    setProfile(data)
  }
}

export function useAuth() {
  return useAuthStore()
}
