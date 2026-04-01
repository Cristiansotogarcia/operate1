import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'

export function useAuthInit() {
  const { setUser, setSession, setProfile, setLoading, reset } = useAuthStore()

  useEffect(() => {
    // Get initial session — handles token refresh automatically
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchProfile(session.user.id).finally(() => setLoading(false))
      } else {
        setLoading(false)
      }
    })

    // Listen for all auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_OUT' || !session?.user) {
          reset()
          return
        }

        // Always keep session in sync — critical for token refreshes
        // Without this, RLS queries fail after the access token expires
        setSession(session)
        setUser(session.user)

        // Only refetch profile on actual identity changes or user updates
        const current = useAuthStore.getState()
        if (event === 'SIGNED_IN' || event === 'USER_UPDATED' || current.profile?.id !== session.user.id) {
          await fetchProfile(session.user.id)
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [])

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
