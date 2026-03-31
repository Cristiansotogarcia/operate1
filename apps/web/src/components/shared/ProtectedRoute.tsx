import { Navigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { PageLoader } from '@/components/ui/Spinner'

interface ProtectedRouteProps {
  children: React.ReactNode
  requireAdmin?: boolean
}

export function ProtectedRoute({ children, requireAdmin = false }: ProtectedRouteProps) {
  const { user, profile, loading } = useAuth()

  if (loading) return <PageLoader />
  if (!user) return <Navigate to="/auth" replace />
  if (requireAdmin && profile?.role !== 'admin') return <Navigate to="/tickets" replace />

  return <>{children}</>
}
