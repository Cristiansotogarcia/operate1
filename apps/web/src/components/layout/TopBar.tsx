import { useAuth } from '@/hooks/useAuth'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { getInitials } from '@/lib/utils'
import { LogOut, Settings, Menu } from 'lucide-react'
import toast from 'react-hot-toast'

interface TopBarProps {
  onToggleSidebar: () => void
}

export function TopBar({ onToggleSidebar }: TopBarProps) {
  const { profile } = useAuth()
  const navigate = useNavigate()

  async function handleLogout() {
    await supabase.auth.signOut()
    toast.success('Signed out')
    navigate('/auth')
  }

  return (
    <header className="h-14 border-b border-white/10 bg-[#0f172a] flex items-center justify-between px-4 sm:px-6 shrink-0">
      <button
        type="button"
        onClick={onToggleSidebar}
        className="lg:hidden p-2 -ml-1 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
        aria-label="Toggle menu"
      >
        <Menu size={20} />
      </button>
      <div className="hidden lg:block" />
      <div className="flex items-center gap-2 sm:gap-3">
        <button
          onClick={() => navigate('/account')}
          className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
          title="Account settings"
        >
          <Settings size={18} />
        </button>
        <div className="w-px h-6 bg-white/10" />
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-cyan-600 flex items-center justify-center text-white text-xs font-semibold">
            {getInitials(profile?.full_name || profile?.username)}
          </div>
          <div className="hidden sm:block">
            <p className="text-sm font-medium text-slate-200 leading-tight">{profile?.full_name || profile?.username}</p>
            <p className="text-xs text-slate-500 leading-tight">{profile?.role}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="p-2 text-slate-400 hover:text-red-400 rounded-lg hover:bg-white/10 transition-colors"
          title="Sign out"
        >
          <LogOut size={18} />
        </button>
      </div>
    </header>
  )
}
