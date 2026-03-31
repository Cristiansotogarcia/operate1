import { NavLink } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import {
  Ticket, Plus, Building2, FileText, Activity, MapPin,
  Landmark, BookOpen, Monitor, Users, Shield, SlidersHorizontal,
  LayoutDashboard, Tag, Radio, ScrollText, Clock, Key, BarChart2,
  Webhook, UserCircle, ExternalLink
} from 'lucide-react'

interface NavItem {
  path: string
  label: string
  icon: React.ReactNode
  adminOnly?: boolean
}

interface NavSection {
  label: string
  items: NavItem[]
}

const navSections: NavSection[] = [
  {
    label: '',
    items: [
      { path: '/dashboard', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
    ],
  },
  {
    label: 'Helpdesk',
    items: [
      { path: '/tickets', label: 'Tickets', icon: <Ticket size={18} /> },
      { path: '/tickets/create', label: 'New Ticket', icon: <Plus size={18} /> },
      { path: '/ticket-types', label: 'Ticket Types', icon: <Tag size={18} />, adminOnly: true },
      { path: '/sla', label: 'SLA Policies', icon: <Clock size={18} />, adminOnly: true },
      { path: '/knowledge', label: 'Knowledge Base', icon: <BookOpen size={18} /> },
    ],
  },
  {
    label: 'Clients',
    items: [
      { path: '/companies', label: 'Companies', icon: <Building2 size={18} /> },
      { path: '/contracts', label: 'Contracts', icon: <FileText size={18} /> },
      { path: '/sites', label: 'Sites', icon: <MapPin size={18} /> },
      { path: '/costcenters', label: 'Cost Centers', icon: <Landmark size={18} /> },
    ],
  },
  {
    label: 'Infrastructure',
    items: [
      { path: '/monitoring', label: 'Monitoring', icon: <Activity size={18} /> },
      { path: '/devices', label: 'Devices', icon: <Monitor size={18} /> },
    ],
  },
  {
    label: 'Admin',
    items: [
      { path: '/reporting', label: 'Reporting', icon: <BarChart2 size={18} />, adminOnly: true },
      { path: '/audit', label: 'Audit Log', icon: <ScrollText size={18} />, adminOnly: true },
      { path: '/api-keys', label: 'API Keys', icon: <Key size={18} />, adminOnly: true },
      { path: '/integrations', label: 'Integrations', icon: <Webhook size={18} />, adminOnly: true },
      { path: '/user-company-access', label: 'Company Access', icon: <Shield size={18} />, adminOnly: true },
      { path: '/user-site-access', label: 'Site Access', icon: <SlidersHorizontal size={18} />, adminOnly: true },
      { path: '/user-management', label: 'Users', icon: <Users size={18} />, adminOnly: true },
    ],
  },
  {
    label: '',
    items: [
      { path: '/status', label: 'Status Page', icon: <Radio size={18} /> },
      { path: '/portal', label: 'Client Portal', icon: <ExternalLink size={18} /> },
      { path: '/account', label: 'My Account', icon: <UserCircle size={18} /> },
    ],
  },
]

export function Sidebar() {
  const { profile } = useAuth()
  const isAdmin = profile?.role === 'admin'

  return (
    <div className="flex flex-col h-full w-[220px] bg-[#0f172a] shrink-0">
      {/* Brand */}
      <div className="px-5 h-14 flex items-center border-b border-white/10">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-violet-600 flex items-center justify-center">
            <svg viewBox="0 0 32 32" fill="none" className="w-4 h-4">
              <path d="M8 16a8 8 0 1 1 16 0a8 8 0 0 1-16 0z" stroke="#fff" strokeWidth="3" fill="none"/>
              <path d="M16 10v6l4 2" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <span className="text-white font-semibold text-sm tracking-tight">Operate1</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 scrollbar-hide">
        {navSections.map((section, si) => {
          const visible = section.items.filter(item => !item.adminOnly || isAdmin)
          if (!visible.length) return null
          return (
            <div key={si} className={section.label ? 'mt-2' : ''}>
              {section.label && (
                <p className="px-5 pt-2 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">
                  {section.label}
                </p>
              )}
              {visible.map(item => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.path === '/tickets/create'}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-2.5 mx-2 px-3 py-[7px] text-[13px] rounded-md transition-colors',
                      isActive
                        ? 'bg-violet-600/20 text-violet-300 font-medium'
                        : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
                    )
                  }
                >
                  <span className="shrink-0 opacity-75">{item.icon}</span>
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </div>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-white/10">
        <p className="text-[10px] text-slate-600 text-center">Operate1 v1.1.5</p>
      </div>
    </div>
  )
}
