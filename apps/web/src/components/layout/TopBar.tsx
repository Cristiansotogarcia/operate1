import { useAuth } from '@/hooks/useAuth'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { getInitials } from '@/lib/utils'
import { LogOut, Bell, Settings } from 'lucide-react'
import toast from 'react-hot-toast'

export function TopBar() {
  const { profile } = useAuth()
  const navigate = useNavigate()

  async function handleLogout() {
    await supabase.auth.signOut()
    toast.success('Signed out')
    navigate('/auth')
  }

  return (
    <header className="h-14 border-b border-gray-200 bg-white flex items-center justify-between px-6 shrink-0">
      <div />
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/account')}
          className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
          title="Account settings"
        >
          <Settings size={18} />
        </button>
        <div className="w-px h-6 bg-gray-200" />
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-violet-600 flex items-center justify-center text-white text-xs font-semibold">
            {getInitials(profile?.full_name || profile?.username)}
          </div>
          <div className="hidden sm:block">
            <p className="text-sm font-medium text-gray-800 leading-tight">{profile?.full_name || profile?.username}</p>
            <p className="text-xs text-gray-400 leading-tight">{profile?.role}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="p-2 text-gray-400 hover:text-red-500 rounded-lg hover:bg-gray-100 transition-colors"
          title="Sign out"
        >
          <LogOut size={18} />
        </button>
      </div>
    </header>
  )
}
