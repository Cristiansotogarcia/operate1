import { createHashRouter, Navigate } from 'react-router-dom'
import { MainLayout } from './components/layout/MainLayout'
import { ProtectedRoute } from './components/shared/ProtectedRoute'
import { LoginPage } from './pages/auth/LoginPage'
import { ResetPasswordPage } from './pages/auth/ResetPasswordPage'
import { DashboardPage } from './pages/dashboard/DashboardPage'
import { TicketsPage } from './pages/tickets/TicketsPage'
import { NewTicketPage } from './pages/tickets/NewTicketPage'
import { TicketDetailPage } from './pages/tickets/TicketDetailPage'
import { TicketTypesPage } from './pages/ticket-types/TicketTypesPage'
import { CompaniesPage } from './pages/companies/CompaniesPage'
import { ContractsPage } from './pages/contracts/ContractsPage'
import { SitesPage } from './pages/sites/SitesPage'
import { CostCentersPage } from './pages/cost-centers/CostCentersPage'
import { MonitoringPage } from './pages/monitoring/MonitoringPage'
import { KnowledgePage } from './pages/knowledge/KnowledgePage'
import { DevicesPage } from './pages/devices/DevicesPage'
import { CompanyAccessPage } from './pages/access/CompanyAccessPage'
import { SiteAccessPage } from './pages/access/SiteAccessPage'
import { UserManagementPage } from './pages/users/UserManagementPage'
import { PublicStatusPage } from './pages/status/PublicStatusPage'
// Phase 2
import { AuditLogPage } from './pages/audit/AuditLogPage'
import { SLAPoliciesPage } from './pages/sla/SLAPoliciesPage'
import { ApiKeysPage } from './pages/api-keys/ApiKeysPage'
import { ReportingPage } from './pages/reporting/ReportingPage'
import { IntegrationsPage } from './pages/integrations/IntegrationsPage'

export const router = createHashRouter([
  {
    path: '/auth',
    element: <LoginPage />,
  },
  {
    path: '/auth/reset',
    element: <ResetPasswordPage />,
  },
  {
    // Public status page — no auth required
    path: '/status',
    element: <PublicStatusPage />,
  },
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <MainLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: 'dashboard', element: <DashboardPage /> },
      // Helpdesk
      { path: 'tickets', element: <TicketsPage /> },
      { path: 'tickets/create', element: <NewTicketPage /> },
      { path: 'tickets/:id', element: <TicketDetailPage /> },
      { path: 'ticket-types', element: <TicketTypesPage /> },
      { path: 'sla', element: <SLAPoliciesPage /> },
      { path: 'knowledge', element: <KnowledgePage /> },
      // Clients
      { path: 'companies', element: <CompaniesPage /> },
      { path: 'contracts', element: <ContractsPage /> },
      { path: 'sites', element: <SitesPage /> },
      { path: 'costcenters', element: <CostCentersPage /> },
      // Infrastructure
      { path: 'monitoring', element: <MonitoringPage /> },
      { path: 'devices', element: <DevicesPage /> },
      // Admin
      { path: 'reporting', element: <ReportingPage /> },
      { path: 'audit', element: <AuditLogPage /> },
      { path: 'api-keys', element: <ApiKeysPage /> },
      { path: 'integrations', element: <IntegrationsPage /> },
      { path: 'user-company-access', element: <CompanyAccessPage /> },
      { path: 'user-site-access', element: <SiteAccessPage /> },
      { path: 'user-management', element: <UserManagementPage /> },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
])
