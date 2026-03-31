import { NavLink, useNavigate } from 'react-router-dom'
import { cn, getInitials } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'
import {
  Ticket, Plus, Building2, FileText, Activity, MapPin,
  Landmark, BookOpen, Monitor, Users, Shield, SlidersHorizontal, LogOut, LayoutDashboard, Tag, Radio
} from 'lucide-react'

interface NavItem {
  path: string
  label: string
  sub: string
  icon: React.ReactNode
  adminOnly?: boolean
}

const navItems: NavItem[] = [
  { path: '/dashboard', label: 'Dashboard', sub: 'Overview', icon: <LayoutDashboard size={18} /> },
  { path: '/tickets', label: 'Tickets', sub: 'Tickets management', icon: <Ticket size={18} /> },
  { path: '/tickets/create', label: 'New Ticket', sub: 'Create new ticket', icon: <Plus size={18} /> },
  { path: '/ticket-types', label: 'Ticket Types', sub: 'Manage ticket types', icon: <Tag size={18} />, adminOnly: true },
  { path: '/companies', label: 'Companies', sub: 'Companies management', icon: <Building2 size={18} /> },
  { path: '/contracts', label: 'Contracts', sub: 'Contracts management', icon: <FileText size={18} /> },
  { path: '/monitoring', label: 'Monitoring', sub: 'Monitoring', icon: <Activity size={18} /> },
  { path: '/sites', label: 'Sites', sub: 'Sites management', icon: <MapPin size={18} /> },
  { path: '/costcenters', label: 'Cost Centers', sub: 'Cost centers management', icon: <Landmark size={18} /> },
  { path: '/knowledge', label: 'Knowledge Base', sub: 'Knowledge base management', icon: <BookOpen size={18} /> },
  { path: '/devices', label: 'Devices', sub: 'Devices management', icon: <Monitor size={18} /> },
  { path: '/user-company-access', label: 'Company Access', sub: 'Company Access management', icon: <Shield size={18} />, adminOnly: true },
  { path: '/user-site-access', label: 'Site Access', sub: 'Site Access management', icon: <SlidersHorizontal size={18} />, adminOnly: true },
  { path: '/user-management', label: 'User Management', sub: 'User Management', icon: <Users size={18} />, adminOnly: true },
  { path: '/status', label: 'Status Page', sub: 'Public monitor status', icon: <Radio size={18} /> },
]

export function Sidebar() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const isAdmin = profile?.role === 'admin'

  async function handleLogout() {
    await supabase.auth.signOut()
    toast.success('Signed out')
    navigate('/auth')
  }

  const visibleItems = navItems.filter(item => !item.adminOnly || isAdmin)

  return (
    <div className="flex flex-col h-full w-56 bg-[#0f172a] text-gray-300 shrink-0">
      {/* Header */}
      <div className="px-4 py-4 border-b border-slate-700">
        <h1 className="text-white font-bold text-base tracking-tight">Xatech Helpdesk</h1>
      </div>

      {/* User info */}
      <div className="px-4 py-3 border-b border-slate-700 flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-violet-600 flex items-center justify-center text-white text-sm font-semibold shrink-0">
          {getInitials(profile?.full_name || profile?.username)}
        </div>
        <div className="min-w-0">
          <p className="text-white text-xs font-medium truncate">{profile?.full_name || profile?.username}</p>
          <p className="text-slate-400 text-xs truncate">{profile?.username}</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-2 scrollbar-hide">
        {visibleItems.map(item => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/tickets/create'}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-4 py-2.5 text-xs transition-colors group',
                isActive
                  ? 'bg-violet-700 text-white'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              )
            }
          >
            <span className="shrink-0">{item.icon}</span>
            <div className="min-w-0">
              <p className="font-medium leading-tight">{item.label}</p>
              <p className="text-[10px] text-slate-400 truncate group-[.active]:text-slate-200">{item.sub}</p>
            </div>
          </NavLink>
        ))}
      </nav>

      {/* Logout */}
      <div className="border-t border-slate-700 p-3">
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 w-full px-3 py-2 text-xs text-slate-400 hover:text-white hover:bg-slate-800 rounded-md transition-colors"
        >
          <LogOut size={15} />
          Sign out
        </button>
      </div>
    </div>
  )
}
