import { RouterProvider } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { router } from './router'
import { useAuthInit } from './hooks/useAuth'

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
  return <AppInner />
}
