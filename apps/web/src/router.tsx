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
import { CompanyDetailPage } from './pages/companies/CompanyDetailPage'
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
// Phase 3
import { PublicPortalPage } from './pages/portal/PublicPortalPage'
import { AccountPage } from './pages/account/AccountPage'
// Phase 4 — Competitive features
import { TicketTemplatesPage } from './pages/templates/TicketTemplatesPage'
import { RolesPage } from './pages/roles/RolesPage'
import { CustomFieldsPage } from './pages/custom-fields/CustomFieldsPage'
import { EmailTemplatesPage } from './pages/email-templates/EmailTemplatesPage'
import { SlaEscalationPage } from './pages/sla/SlaEscalationPage'

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
    // Public ticket portal — no auth required
    path: '/portal',
    element: <PublicPortalPage />,
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
      { path: 'sla/escalation', element: <SlaEscalationPage /> },
      { path: 'templates', element: <TicketTemplatesPage /> },
      { path: 'knowledge', element: <KnowledgePage /> },
      // Clients
      { path: 'companies', element: <CompaniesPage /> },
      { path: 'companies/:id', element: <CompanyDetailPage /> },
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
      { path: 'roles', element: <RolesPage /> },
      { path: 'custom-fields', element: <CustomFieldsPage /> },
      { path: 'email-templates', element: <EmailTemplatesPage /> },
      { path: 'account', element: <AccountPage /> },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
])
