import { RouterProvider } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { router } from './router'
import { useAuthInit } from './hooks/useAuth'
import { ErrorBoundary } from './components/shared/ErrorBoundary'

function AppInner() {
  useAuthInit()
  return (
    <>
      <RouterProvider router={router} />
      <Toaster position="top-right" toastOptions={{ duration: 4000 }} />
    </>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppInner />
    </ErrorBoundary>
  )
}
