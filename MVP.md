# Operate1 — MVP Rebuild Plan

> Reconstructed from screenshot evidence of the Xatech Helpdesk product (`demo.operate1.xa-tech.com`).
> Target stack: Electron + React/Vite + Supabase + Node.js worker agent.
> Supabase project: `yhdyuzdfocvtgyatnrqz`

---

## Table of Contents

- [A. Product Summary](#a-product-summary)
- [B. Evidence-Based Feature Map](#b-evidence-based-feature-map)
- [C. MVP Scope — Phase 1](#c-mvp-scope--phase-1)
- [D. Phase 2 Scope](#d-phase-2-scope)
- [E. Architecture](#e-architecture)
- [F. Database Schema](#f-database-schema)
- [G. Auth, RBAC, and Multi-Tenancy](#g-auth-rbac-and-multi-tenancy)
- [H. Worker / Agent Design](#h-worker--agent-design)
- [I. Screen Reconstruction](#i-screen-reconstruction)
- [J. Repo Structure](#j-repo-structure)
- [K. Implementation Order](#k-implementation-order)
- [L. Setup Commands and Environment](#l-setup-commands-and-environment)
- [M. Testing and QA Checklist](#m-testing-and-qa-checklist)
- [N. Security and Production-Readiness](#n-security-and-production-readiness)
- [O. Market Gap Analysis](#o-market-gap-analysis)
- [P. Final Recommendation](#p-final-recommendation)

---

## A. Product Summary

**What it is:** Xatech Helpdesk (Operate1) is a multi-tenant IT Managed Service Provider (MSP) platform that combines a helpdesk ticketing system with lightweight Remote Monitoring and Management (RMM) capabilities. It replaces the need to run separate tools like Freshdesk + PRTG + a contracts tracker.

**Who it is for:** MSPs and internal IT teams managing multiple client companies. The MSP operator (admin) manages companies, contracts, sites, and technicians. End clients (helpdesk users) submit tickets and view their own data. An installed worker/agent runs on client hardware and reports back.

**Main workflows:**

1. Admin onboards a company → assigns contract → creates sites → assigns users
2. Technician receives ticket → works it → closes it
3. Client user submits ticket via New Ticket form (or email-to-ticket, inferred)
4. Worker agent installs on client device → auto-registers → sends heartbeats + CPU/RAM/disk metrics
5. Admin creates endpoint monitors (HTTP, ICMP, TCP) → worker checks them on interval → results shown as uptime/failures
6. Admin manages knowledge base articles for self-service
7. Admin controls which users can see which companies and sites (Company Access, Site Access)

---

## B. Evidence-Based Feature Map

### Confirmed from screenshots

| Module | Evidence |
|---|---|
| Auth: username/password login | Login screen, v1.0.0 footer |
| Auth: forgot password | Link visible on login screen |
| Two roles: user vs admin | Two demo accounts shown, different data visible |
| Tickets list | Table: Status, Email, Contact, Company, Site, Type, Subject, Actions |
| Ticket filters | Search, Status, Company, Site, Ticket Type |
| New ticket form | Email, Contact Name, Company, Site, Ticket Type, Subject, Description (rich text), Status |
| Ticket status: Pending | Confirmed in ticket list |
| Companies list (admin) | Company Name, Active Contract, Contract Type, Contract Status, Sites count, Actions |
| Companies list (user) | Empty — access scoped |
| Contracts list | Contract #, Name, Company, Type, Status, Period, Usage, Actions |
| Sites list (admin) | Name, Company, Cost Center, Actions; 4 sites across 2 companies |
| Cost Centers | Code (badge), Description, ID (UUID), Actions; search by code/description |
| Knowledge Base | Filters: Search, Type, Status, Company, Site, Category; empty state shown |
| Devices | Cards: name, computer name, Online badge, CPU bar, RAM bar, last IP, last seen |
| Device filters | Search, Company, Type, Status |
| Endpoint Monitoring | Cards: name, URL/host, Up badge, Uptime %, Avg Response ms, Failures, type, last checked |
| Monitoring filters | Search, Device, Company, Type, Status |
| User Management | Username, Email, Full Name, Status badge, Roles badge, Actions; Create User button |
| Company Access | Username, Email, Full Name, Status, Roles, Company Access badges, edit |
| Site Access | Username, Email, Full Name, Status, Companies, Sites, edit; prerequisite warning shown |
| SignalR / WebSockets | `signalr-D8YIDv-B.js` visible in network tab |
| Pinia state management | `pinia-S6fyjqZo.js` visible in network tab |
| Vue frontend | Confirmed from asset filenames |
| Access token in URL | `access?id=...&access_token=...` — worker registration handshake |
| Export CSV | Button visible on Tickets Management page |

### Inferred (strongly implied, not directly visible)

- Ticket detail/view screen (eye icon in Actions column)
- Ticket edit screen (pencil icon in Actions column)
- Email-to-ticket parsing (email field prominence implies it)
- Ticket type CRUD (inline "New" button implies create flow)
- Contract usage tracking (Usage column, likely ticket count or hours)
- Knowledge Base article create/edit/view
- Device detail screen with metric history
- Monitor detail with check history chart
- Worker auto-registration via API key (confirmed in notes)
- Worker heartbeat system (confirmed in notes)
- Worker HTTP/ICMP/TCP checks (confirmed in notes)
- Seeding mechanism for fresh deployments (confirmed in notes)
- Dashboard/home screen (likely exists, not captured)
- Realtime notifications (implied by SignalR usage)

### Uncertain areas

- Email integration (inbound parsing, SMTP outbound)
- SLA timers or escalation rules
- Ticket assignment to specific technicians
- Time tracking / billing per ticket
- File attachments on tickets
- Two-factor authentication
- API key management UI
- Audit log UI
- Whether Electron shell is for admin desktop only or also packages the worker installer

---

## C. MVP Scope — Phase 1

The smallest credible pilot that can be shown to a real client. Everything below is **required**. Nothing else.

### Must be in MVP

| Area | What to build |
|---|---|
| Auth | Email/password login, logout, password reset via Supabase Auth |
| RBAC | Two roles: `admin` and `user`. Enforced in UI and Supabase RLS |
| Multi-tenancy | Single tenant per deployment. `tenant_id` on all tables. RLS enforces isolation |
| Companies | List, create, edit, delete. Show linked contract status and site count |
| Sites | List, create, edit, delete. Linked to company and cost center |
| Cost Centers | List, create, edit, delete |
| Contracts | List, create, edit, delete. Contract number, name, company, type, status, date range |
| Tickets | List with filters, view detail, create (full form), edit status, delete |
| Ticket Types | Inline create from New Ticket form. Simple CRUD |
| User Management | List, create, edit role, activate/deactivate, delete |
| Company Access | Assign which companies each user can see |
| Site Access | Assign which sites each user can see (after company access) |
| Devices | Card list, register via worker, online/offline status, CPU/RAM/disk metrics |
| Worker Agent | Node.js process: register, heartbeat, metric reporting |
| Endpoint Monitoring | Card list, create monitor (URL/ICMP/TCP), worker executes checks, results stored |
| Knowledge Base | Article list, create, edit, delete. Basic category field |
| Electron Shell | Wraps the frontend SPA. IPC bridge for secure service role operations |
| Realtime | Supabase Realtime for device status and monitor result updates |

### Excluded from MVP

- Email-to-ticket inbound parsing
- SMTP outbound notifications
- SLA / escalation rules
- Ticket assignment to technicians
- Time tracking
- File attachments
- Two-factor authentication
- Dashboard with charts
- Audit log UI
- Billing / usage reports
- Mobile / responsive web priority
- Multi-instance / hosted SaaS multi-tenancy

---

## D. Phase 2 Scope

| Category | Feature |
|---|---|
| Communication | SMTP outbound (ticket event notifications), inbound email-to-ticket |
| Alerting | Monitor down email/webhook alerts |
| SLA | Policies per ticket type, breach alerts, escalation |
| Assignments | Assign ticket to technician, team queues |
| Time tracking | Log hours on tickets, bill against contract |
| Files | Attachment upload on tickets and KB articles (Supabase Storage) |
| Dashboard | Summary cards: open tickets, devices online, monitors up/down, contract status |
| Charts | Ticket volume, device uptime history, monitor response time graphs |
| Audit log | All mutations logged and viewable |
| Reporting | PDF/CSV exports for tickets, contracts, usage |
| 2FA | TOTP via Supabase Auth |
| Public portal | External ticket submission without login |
| Public status page | Read-only monitor status page for clients |
| API key management | UI to generate/revoke worker registration keys |
| Multi-SaaS | Hosted multi-tenant (one Supabase org, multiple schemas or projects) |
| Mobile | Responsive PWA or React Native wrapper |
| Integrations | Slack/Teams webhooks, outbound API |
| Advanced monitoring | Check history charts, downtime event log, alerting rules |
| Asset management | Serial numbers, warranty, assigned user per device |
| Remote access | RDP/VNC proxy through agent (long-term) |
| Patch management | OS/software update push via agent (long-term) |

---

## E. Architecture

### Stack

| Layer | Technology | Reason |
|---|---|---|
| Frontend SPA | React 18 + Vite + TypeScript | Fast, Electron-friendly, large ecosystem |
| UI components | shadcn/ui + Tailwind CSS | Rapid admin UI, matches screenshot aesthetic |
| Rich text | Tiptap (ProseMirror) | Matches toolbar visible in New Ticket screenshots |
| State | Zustand | Lightweight, no boilerplate |
| Realtime | Supabase Realtime channels | Replaces SignalR, equivalent push behavior |
| Auth | Supabase Auth | Email/password, JWT, RLS integration |
| Database | Supabase (PostgreSQL) | RLS, migrations, typed client |
| Storage | Supabase Storage | Phase 2 attachments |
| Electron shell | Electron 28+ | Wraps Vite SPA for desktop delivery |
| Worker agent | Node.js standalone process | Registers via API key, runs on client hardware |
| Worker metrics | `systeminformation` npm package | CPU, RAM, disk, IP |
| Worker checks | `axios` (HTTP), `net` (TCP), `child_process` ping (ICMP) |
| Worker scheduler | `setInterval` per check | No queue needed for MVP |
| Worker offline buffer | `better-sqlite3` | Queue failed writes locally |

### What lives where

**Supabase:**
- All persistent data (PostgreSQL)
- Auth (users, sessions, JWT)
- RLS policies (data isolation)
- Realtime channels (device presence, ticket updates, monitor results)
- Edge Functions: worker registration + heartbeat validation

**Electron main process:**
- Window management and system tray
- IPC handlers (service role key operations, no direct DB from renderer)
- Preload script via `contextBridge`
- Auto-updater (Phase 2)

**Electron renderer (React SPA):**
- All UI
- Supabase client over HTTPS (RLS-protected)
- Zustand stores

**Worker agent (separate Node.js process, installed on client machines):**
- Does NOT run inside the Electron app
- Communicates with Supabase REST API over internet
- Uses device-scoped api_secret obtained during registration
- Packaged as Windows Service (`node-windows`), Linux systemd, or macOS launchd

---

## F. Database Schema

All tables include `tenant_id uuid` for isolation. For MVP single-tenant deployment, all rows share the same `tenant_id`.

```sql
-- TENANTS
create table tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  created_at timestamptz default now()
);

-- PROFILES (extends Supabase auth.users)
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  tenant_id uuid not null references tenants(id),
  full_name text,
  username text,
  role text not null default 'user',   -- 'admin' | 'user'
  status text not null default 'active', -- 'active' | 'inactive'
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- COMPANIES
create table companies (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  name text not null,
  notes text,
  status text default 'active',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- COST CENTERS
create table cost_centers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  code text not null,
  description text,
  created_at timestamptz default now()
);

-- SITES
create table sites (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  company_id uuid not null references companies(id) on delete cascade,
  cost_center_id uuid references cost_centers(id),
  name text not null,
  address text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- CONTRACTS
create table contracts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  company_id uuid references companies(id),
  contract_number text unique not null,  -- e.g. IQ-C-0001
  name text not null,
  type text default 'custom',            -- 'custom' | 'standard' | 'hourly'
  status text default 'draft',           -- 'draft' | 'active' | 'expired' | 'cancelled'
  starts_at date,
  ends_at date,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- TICKET TYPES
create table ticket_types (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  name text not null,
  created_at timestamptz default now()
);

-- TICKETS
create table tickets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  ticket_number text unique not null,    -- auto-generated: TK-0001
  company_id uuid references companies(id),
  site_id uuid references sites(id),
  ticket_type_id uuid references ticket_types(id),
  contact_email text not null,
  contact_name text,
  subject text not null,
  description text,                      -- HTML from Tiptap
  status text not null default 'pending', -- 'pending' | 'open' | 'in_progress' | 'resolved' | 'closed'
  assigned_to uuid references profiles(id),
  created_by uuid references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- TICKET COMMENTS (table created in MVP, UI in Phase 2)
create table ticket_comments (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references tickets(id) on delete cascade,
  author_id uuid references profiles(id),
  body text not null,
  is_internal boolean default false,
  created_at timestamptz default now()
);

-- KB CATEGORIES
create table kb_categories (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  name text not null
);

-- KB ARTICLES
create table kb_articles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  title text not null,
  body text,
  type text default 'internal',     -- 'internal' | 'public'
  status text default 'draft',      -- 'draft' | 'published'
  category_id uuid references kb_categories(id),
  company_id uuid references companies(id),  -- null = shared
  site_id uuid references sites(id),
  author_id uuid references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- DEVICES (worker-registered)
create table devices (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  company_id uuid references companies(id),
  registration_key text unique not null,  -- one-time key admin gives to worker
  api_secret text not null,               -- bcrypt hash of token issued after registration
  name text not null,
  computer_name text,
  os text,
  status text default 'offline',          -- 'online' | 'offline'
  last_seen_at timestamptz,
  last_ip text,
  cpu_percent numeric,
  ram_percent numeric,
  disk_percent numeric,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- DEVICE HEARTBEATS
create table device_heartbeats (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references devices(id) on delete cascade,
  cpu_percent numeric,
  ram_percent numeric,
  disk_percent numeric,
  ip_address text,
  recorded_at timestamptz default now()
);

-- MONITORS (endpoint monitoring config)
create table monitors (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  device_id uuid references devices(id),   -- which worker runs this check
  company_id uuid references companies(id),
  name text not null,
  type text not null,                       -- 'http' | 'icmp' | 'tcp'
  target text not null,                     -- URL, hostname, or IP
  port integer,                             -- TCP checks only
  interval_seconds integer default 60,
  status text default 'active',             -- 'active' | 'paused'
  last_status text default 'unknown',       -- 'up' | 'down' | 'unknown'
  last_checked_at timestamptz,
  uptime_percent numeric default 0,
  avg_response_ms integer default 0,
  failure_count integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- MONITOR RESULTS
create table monitor_results (
  id uuid primary key default gen_random_uuid(),
  monitor_id uuid not null references monitors(id) on delete cascade,
  status text not null,   -- 'up' | 'down'
  response_ms integer,
  error_message text,
  checked_at timestamptz default now()
);

-- USER COMPANY ACCESS
create table user_company_access (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  company_id uuid not null references companies(id) on delete cascade,
  tenant_id uuid not null references tenants(id),
  unique(profile_id, company_id)
);

-- USER SITE ACCESS
create table user_site_access (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  site_id uuid not null references sites(id) on delete cascade,
  tenant_id uuid not null references tenants(id),
  unique(profile_id, site_id)
);
```

### Auto-incrementing ticket numbers

Use a Postgres sequence + trigger to generate `TK-0001`, `TK-0002`, etc. per tenant:

```sql
create sequence ticket_number_seq start 1;

create or replace function generate_ticket_number()
returns trigger as $$
begin
  new.ticket_number := 'TK-' || lpad(nextval('ticket_number_seq')::text, 4, '0');
  return new;
end;
$$ language plpgsql;

create trigger set_ticket_number
  before insert on tickets
  for each row execute function generate_ticket_number();
```

---

## G. Auth, RBAC, and Multi-Tenancy

### Authentication

Supabase Auth with email/password. On login, Supabase returns a JWT. The React app uses the Supabase client to manage sessions. The `profiles` table extends `auth.users` with role and tenant. Admin creates users via `supabase.auth.admin.createUser()` called from the Electron main process (using service role key) or from a Supabase Edge Function.

On first login, the app fetches the profile row to load `role` and `tenant_id` into the Zustand auth store.

### Role design

Two roles for MVP:

| Role | Access |
|---|---|
| `admin` | Full access to all data within the tenant. Manages users, companies, contracts, all tickets, all devices |
| `user` | Scoped access. Sees only companies/sites assigned via access tables. Can create and view own tickets. Cannot manage users or config |

> **Assumption:** The real product likely has a `technician` role separate from admin. MVP merges this into admin. Add `technician` in Phase 2.

### Row-Level Security policies

Example pattern applied to all tables:

```sql
alter table companies enable row level security;

-- Admin sees all in their tenant
create policy "admin_all" on companies
  for all using (
    tenant_id = (select tenant_id from profiles where id = auth.uid())
    and (select role from profiles where id = auth.uid()) = 'admin'
  );

-- User sees only companies they have been granted access to
create policy "user_scoped" on companies
  for select using (
    tenant_id = (select tenant_id from profiles where id = auth.uid())
    and id in (
      select company_id from user_company_access where profile_id = auth.uid()
    )
  );
```

The same pattern applies to `sites`, `tickets`, `devices`, `monitors`, `kb_articles`.

### Multi-tenancy for MVP

Single tenant per deployment: one Supabase project = one MSP instance. The `tenants` table has exactly one row. All `tenant_id` values match that row. The seeder inserts this row on first migration.

For Phase 2 multi-SaaS: promote `tenant_id` into a JWT custom claim via Supabase Auth hooks, then tighten all RLS policies to `(auth.jwt() ->> 'tenant_id')::uuid` for query performance.

---

## H. Worker / Agent Design

### Overview

The worker is a **standalone Node.js process** installed on the client machine being monitored. It is separate from the Electron app. The Electron app is the operator's desktop client. The worker communicates with Supabase over the internet via REST API.

For MVP: run as `node dist/index.js`. For deployment: package with `pkg` into a self-contained executable, then wrap as a Windows Service via `node-windows` or Linux systemd unit.

### Registration flow

```
1. Admin creates a Device record in the UI
   → system generates a unique registration_key (UUID)
   → admin copies this key to the client machine

2. Worker reads registration_key from worker.config.json on startup

3. Worker POSTs to Edge Function: POST /functions/v1/worker-register
   Body: { registration_key, computer_name, os, ip_address }

4. Edge Function:
   a. Finds device record by registration_key
   b. Verifies key has not already been used
   c. Generates api_secret (32-byte random hex)
   d. Stores bcrypt hash of api_secret in devices.api_secret
   e. Marks registration_key as consumed
   f. Returns { device_id, api_secret } to worker

5. Worker saves { device_id, api_secret } to worker.config.json (local disk)

6. All subsequent requests use header: Authorization: Bearer <api_secret>
   Edge Function validates: bcrypt.compare(api_secret, devices.api_secret)
```

> **Note:** The `access?id=...&access_token=...` URL pattern visible in the network tab is consistent with this handshake.

### Heartbeat loop

```typescript
// Every 30 seconds (configurable via HEARTBEAT_INTERVAL_MS env var)
async function heartbeat() {
  const metrics = await collectMetrics(); // via systeminformation

  // Write heartbeat record
  await apiPost('/rest/v1/device_heartbeats', {
    device_id: config.device_id,
    cpu_percent: metrics.cpu,
    ram_percent: metrics.ram,
    disk_percent: metrics.disk,
    ip_address: metrics.ip,
  });

  // Update device record (drives online/offline state in UI)
  await apiPatch(`/rest/v1/devices?id=eq.${config.device_id}`, {
    status: 'online',
    last_seen_at: new Date().toISOString(),
    last_ip: metrics.ip,
    cpu_percent: metrics.cpu,
    ram_percent: metrics.ram,
    disk_percent: metrics.disk,
  });
}
```

The server marks a device `offline` if `last_seen_at` is older than 2× the heartbeat interval. Implemented via a Postgres `pg_cron` job or lazily on read in the UI.

### Monitoring check execution

Each monitor record has its own `interval_seconds`. The worker fetches its assigned monitors on startup and runs each on an independent timer:

```typescript
// HTTP check
async function checkHttp(monitor: Monitor) {
  const start = Date.now();
  try {
    await axios.get(monitor.target, { timeout: 10000 });
    return { status: 'up', response_ms: Date.now() - start };
  } catch (e: any) {
    return { status: 'down', error_message: e.message, response_ms: null };
  }
}

// ICMP (ping) check — uses system ping binary
async function checkIcmp(monitor: Monitor) {
  const start = Date.now();
  return new Promise(resolve => {
    const args = process.platform === 'win32'
      ? ['-n', '1', '-w', '3000', monitor.target]
      : ['-c', '1', '-W', '3', monitor.target];
    const proc = spawn('ping', args);
    proc.on('close', code => {
      resolve({ status: code === 0 ? 'up' : 'down', response_ms: Date.now() - start });
    });
  });
}

// TCP port check
async function checkTcp(monitor: Monitor) {
  const start = Date.now();
  return new Promise(resolve => {
    const socket = new net.Socket();
    socket.setTimeout(5000);
    socket.connect(monitor.port!, monitor.target, () => {
      socket.destroy();
      resolve({ status: 'up', response_ms: Date.now() - start });
    });
    socket.on('error', e => resolve({ status: 'down', error_message: e.message }));
    socket.on('timeout', () => resolve({ status: 'down', error_message: 'timeout' }));
  });
}
```

After each check: POST result to `monitor_results`, PATCH `monitors` with updated `last_status`, `last_checked_at`, `uptime_percent`, `avg_response_ms`, `failure_count`.

### Retry and failure handling

- Failed Supabase REST calls: retry up to 3 times with exponential backoff (1s → 2s → 4s)
- If still failing: write to local SQLite buffer (`better-sqlite3`) and flush on next successful connection
- Logging: Winston with rotating file transport (max 10 MB × 5 files)
- If api_secret rejected (401): worker stops and logs "re-registration required"
- On crash: rely on systemd/Windows Service restart policy

---

## I. Screen Reconstruction

### Login (`/#/auth`)

| Element | Detail |
|---|---|
| Title | "Xatech Helpdesk" (purple) |
| Fields | Username (email), Password |
| Actions | Sign In button, Forgot your password? link |
| Footer | Version label ("Xatech Helpdesk v1.0.0") |
| On success | Redirect to Tickets |
| On failure | Inline error message |

---

### Tickets (`/#/tickets`)

| Element | Detail |
|---|---|
| Page title | "Tickets Management" |
| Table columns | Status (badge), Email, Contact, Company, Site, Type (badge), Subject, Actions |
| Filters | Search (email/name/subject), Status, Company, Site, Ticket Type |
| Actions bar | Export CSV (secondary), New Ticket (primary, top right) |
| Status badges | Pending (yellow), Open (blue), In Progress (purple), Resolved (green), Closed (gray) |
| RBAC | Admin sees all tickets; user sees only tickets for accessible companies/sites |
| Empty state | Mailbox illustration + "No tickets found" |

---

### New Ticket (`/#/tickets/create`)

| Element | Detail |
|---|---|
| Title | "Register New Ticket" |
| Fields | Email (required), Contact Name, Company (dropdown + inline New), Site (cascades from company + inline New), Ticket Type (dropdown + inline New), Subject (required), Description (Tiptap rich text), Status (dropdown, default: Pending) |
| Actions | Register Ticket (submit), Cancel |
| Notes | Admin view: centered modal overlay. User view: full page form |

---

### Companies (`/#/companies`)

| Element | Detail |
|---|---|
| Page title | "Companies Management" |
| Table columns (admin) | Company Name (link), Active Contract, Contract Type (badge), Contract Status (badge), Sites count, Actions |
| Table columns (user) | Empty — no access unless granted |
| Search | Text search by company name |
| Actions | New Company (top right) |

---

### Contracts (`/#/contracts`)

| Element | Detail |
|---|---|
| Page title | "Contracts Management" |
| Table columns | Contract # (link), Name, Company, Type (badge: Custom/Standard), Status (badge: Active/Draft/Expired), Period (two stacked dates), Usage, Actions |
| Filters | Search, Company, Type, Status |
| Actions | New Contract |
| Sample data | IQ-C-0001, InfiniQ Contract Tenant 1, Custom, Active, Mar 1 2026 – Mar 1 2027 |

---

### Monitoring (`/#/monitoring`)

| Element | Detail |
|---|---|
| Page title | "Endpoint Monitoring" |
| Card fields | Name, Up/Down badge, target URL/host, Uptime %, Avg Response ms, Failures count, type label (URL/ICMP), last checked time |
| Filters | Search (name/URL/IP), Device, Company, Type, Status |
| Actions | New Endpoint |
| New Endpoint form | Name, Type (HTTP/ICMP/TCP), Target, Port (TCP only), Device, Company, Interval (seconds) |
| Realtime | Badge and stats update live when worker posts results |

---

### Sites (`/#/sites`)

| Element | Detail |
|---|---|
| Page title | "Sites Management" |
| Table columns | Name, Company (link), Cost Center (code – description), Actions |
| Filters | Search by name, Company dropdown |
| Actions | New Site |
| Notes | Sites are company-scoped; cost center shown as "CC01 - CC01" format |

---

### Cost Centers (`/#/costcenters`)

| Element | Detail |
|---|---|
| Page title | "Cost Centers Management" |
| Table columns | Code (green badge), Description, ID (UUID), Actions |
| Search | By code or description |
| Actions | New Cost Center |

---

### Knowledge Base (`/#/knowledge`)

| Element | Detail |
|---|---|
| Page title | "Knowledge Base" |
| Filters | Search (title/content), Type (Internal/Public), Status (Draft/Published), Company, Site, Category |
| Actions | New Article |
| Article form | Title, Body (Tiptap), Type, Status, Category, Company, Site |
| Empty state | Mailbox illustration + "No articles found" |

---

### Devices (`/#/devices`)

| Element | Detail |
|---|---|
| Page title | "Devices Management" |
| Card fields | Device name, Computer name, Online/Offline badge, CPU progress bar + %, RAM progress bar + %, Last IP, Last seen |
| Filters | Search (name/computer name), Company, Type, Status |
| Actions | New Device |
| New Device | Generates registration key displayed to admin for copying to client machine |
| Realtime | Online/offline badge and metrics update via Supabase Realtime |

---

### Company Access (`/#/user-company-access`)

| Element | Detail |
|---|---|
| Page title | "User Company Access" |
| Table columns | Username, Email, Full Name, Status, Roles (badges), Company Access (company name badges), Actions (edit) |
| Search | By name or email |
| Edit action | Opens panel to multi-select companies for that user |

---

### Site Access (`/#/user-site-access`)

| Element | Detail |
|---|---|
| Page title | "User Site Access" |
| Table columns | Username, Email, Full Name, Status, Companies (badges), Sites (badges), Actions (edit) |
| Warning banner | "Users must have company access before assigning sites. Sites can only be assigned from companies the user already has access to." |
| Notes | Site options are filtered to only companies the user has company access to |

---

### User Management (`/#/user-management`)

| Element | Detail |
|---|---|
| Page title | "User Management" |
| Table columns | Username, Email, Full Name, Status (Active badge), Roles (badge), Actions (edit/deactivate/delete) |
| Search | By name or email |
| Actions | Create User |
| Create User form | Username, Email, Full Name, Password, Role |
| Pagination | Records per page selector (5, 10, 25) |

---

## J. Repo Structure

```
operate1/
├── apps/
│   ├── web/                          # React + Vite SPA
│   │   ├── src/
│   │   │   ├── components/
│   │   │   │   ├── ui/               # shadcn/ui primitives
│   │   │   │   ├── layout/           # Sidebar, TopBar, MainLayout
│   │   │   │   └── shared/           # DataTable, StatusBadge, EmptyState, ConfirmDialog
│   │   │   ├── pages/
│   │   │   │   ├── auth/
│   │   │   │   ├── tickets/
│   │   │   │   ├── companies/
│   │   │   │   ├── contracts/
│   │   │   │   ├── sites/
│   │   │   │   ├── cost-centers/
│   │   │   │   ├── monitoring/
│   │   │   │   ├── knowledge/
│   │   │   │   ├── devices/
│   │   │   │   ├── access/
│   │   │   │   └── users/
│   │   │   ├── stores/               # Zustand stores (one per domain)
│   │   │   ├── lib/
│   │   │   │   ├── supabase.ts       # Supabase client init
│   │   │   │   └── utils.ts
│   │   │   ├── hooks/                # useAuth, useProfile, useTenant
│   │   │   ├── types/                # Re-exports from packages/types
│   │   │   ├── App.tsx
│   │   │   ├── main.tsx
│   │   │   └── router.tsx            # React Router v6 routes + guards
│   │   ├── index.html
│   │   ├── vite.config.ts
│   │   ├── tailwind.config.ts
│   │   └── package.json
│   │
│   └── electron/                     # Electron shell
│       ├── src/
│       │   ├── main.ts               # Main process: window, tray, IPC
│       │   ├── preload.ts            # contextBridge API
│       │   └── ipc/
│       │       ├── auth.ts           # Service role key operations
│       │       └── device.ts         # Device registration key generation
│       ├── package.json
│       └── electron-builder.config.js
│
├── packages/
│   └── types/                        # Shared TypeScript types
│       ├── src/
│       │   ├── database.types.ts     # Generated: supabase gen types typescript
│       │   └── index.ts
│       └── package.json
│
├── worker/                           # Standalone monitoring agent
│   ├── src/
│   │   ├── index.ts                  # Entry: bootstrap all services
│   │   ├── config.ts                 # Read/write worker.config.json
│   │   ├── registration.ts           # First-time registration flow
│   │   ├── heartbeat.ts              # 30s heartbeat loop
│   │   ├── metrics.ts                # CPU/RAM/disk via systeminformation
│   │   ├── scheduler.ts              # Per-monitor independent interval scheduler
│   │   ├── checks/
│   │   │   ├── http.ts
│   │   │   ├── icmp.ts
│   │   │   └── tcp.ts
│   │   ├── api.ts                    # Supabase REST wrapper + retry logic
│   │   ├── buffer.ts                 # SQLite offline buffer
│   │   └── logger.ts                 # Winston rotating file logger
│   ├── worker.config.json.example
│   ├── package.json
│   └── tsconfig.json
│
├── supabase/
│   ├── migrations/
│   │   ├── 00001_initial_schema.sql
│   │   ├── 00002_rls_policies.sql
│   │   ├── 00003_functions.sql       # Ticket number sequence trigger
│   │   └── 00004_seed.sql            # Default tenant row
│   ├── functions/
│   │   ├── worker-register/          # Edge Function: validate key, issue secret
│   │   │   └── index.ts
│   │   └── worker-heartbeat/         # Edge Function: validate + write heartbeat
│   │       └── index.ts
│   └── config.toml
│
├── scripts/
│   ├── gen-types.sh                  # supabase gen types typescript
│   ├── seed-dev.ts                   # Insert dev seed data
│   └── build-worker.sh               # pkg build for worker binary
│
├── .env.example
├── .env.local                        # gitignored
├── package.json                      # Root pnpm workspace
├── pnpm-workspace.yaml
└── tsconfig.base.json
```

---

## K. Implementation Order

Work in this exact sequence. Each step is testable before moving to the next.

### Step 1 — Monorepo scaffold
- Init pnpm workspace with `pnpm-workspace.yaml`
- Create all top-level directories
- Add root TypeScript, ESLint, Prettier configs
- Scaffold `apps/web` with Vite (`pnpm create vite`)
- Install Tailwind + shadcn/ui base

### Step 2 — Supabase schema
- Write all four migration files
- `supabase db push --project-ref yhdyuzdfocvtgyatnrqz`
- `supabase gen types typescript` → `packages/types/src/database.types.ts`
- Verify tables in Supabase Studio

### Step 3 — React app scaffold
- `lib/supabase.ts`: Supabase client from env vars
- Sidebar layout (icon + label nav matching screenshots, purple/blue theme)
- `router.tsx`: all routes registered but pages are stubs
- Protected route wrapper

### Step 4 — Auth flow
- Login page
- `useAuth` hook
- Profile load after login (role + tenant_id into Zustand)
- Logout
- **Test:** login → role loaded → logout works

### Step 5 — User Management + RBAC
- User list, create user (via service role key in Electron IPC or Edge Function)
- Postgres trigger: `on insert to auth.users → insert profiles`
- Edit role, activate/deactivate, delete
- **Test:** create user, assign role, log in as that user, confirm role-gated nav

### Step 6 — Core CRUD modules
Build in this order (each takes ~2 hours):
1. **Cost Centers** (independent, no FK deps)
2. **Companies** (depends on tenant only)
3. **Sites** (depends on company + cost center)
4. **Contracts** (depends on company)
- **Test:** create company → site → contract, verify links shown in tables

### Step 7 — Company Access + Site Access
- Company Access page: multi-select companies per user
- Site Access page: multi-select sites, filtered by company access
- RLS: log in as user → confirm scoped data only
- **Test:** user sees only assigned companies on companies page

### Step 8 — Tickets
- Ticket Types: list + create
- Tickets list with all filters
- New Ticket form: cascading dropdowns, Tiptap editor, status select
- Ticket number trigger (TK-0001 sequence)
- View ticket detail (read-only for MVP)
- Status update action
- Export CSV (client-side from loaded data)
- **Test:** full create-to-view workflow, user scope enforcement

### Step 9 — Knowledge Base
- Article list with all filters
- Create/edit article with Tiptap
- Delete
- **Test:** create article → filter → verify company scoping

### Step 10 — Devices page + registration
- Device card list (CPU/RAM bars, Online/Offline badge)
- New Device: generate registration key, display to admin
- Supabase Realtime subscription to `devices` table
- **Test:** verify cards render, realtime subscription connects

### Step 11 — Worker agent (core)
- `config.ts`, `registration.ts`, `metrics.ts`, `api.ts`, `logger.ts`
- `heartbeat.ts`: 30s loop
- Supabase Edge Function `worker-register`
- **Test:** run worker → device goes Online → metrics appear in UI card

### Step 12 — Endpoint monitoring + worker checks
- Monitors card list
- New Monitor form
- `scheduler.ts`: fetch monitors for device, set independent intervals
- `checks/http.ts`, `checks/icmp.ts`, `checks/tcp.ts`
- POST results, PATCH monitor stats
- Supabase Realtime on `monitors` table
- **Test:** HTTP check runs → card updates live without refresh

### Step 13 — Electron wrapper
- Scaffold Electron app with `electron-vite` or manual setup
- Main process loads Vite dev server (dev) or built dist (prod)
- Preload: contextBridge for app version, platform
- IPC handler: `createUser` using service role key
- System tray icon
- `electron-builder` config → produce Windows installer
- **Test:** full app runs inside Electron window

### Step 14 — Polish + pilot tag
- Add all empty states (mailbox illustration)
- Add loading skeletons on all list pages
- Smoke test full workflow end-to-end
- Tag `v0.1.0-pilot`

---

## L. Setup Commands and Environment

### Prerequisites

```bash
npm install -g pnpm
node --version  # must be 20+
supabase --version  # already linked
```

### Bootstrap

```bash
cd "c:/Users/Hype Consultancy/Operate1"

# Init root workspace
pnpm init

# pnpm-workspace.yaml
cat > pnpm-workspace.yaml << 'EOF'
packages:
  - 'apps/*'
  - 'packages/*'
  - 'worker'
EOF

# Create structure
mkdir -p apps/electron packages/types scripts worker

# Scaffold web app
pnpm create vite apps/web --template react-ts

# Web dependencies
cd apps/web
pnpm add @supabase/supabase-js react-router-dom zustand
pnpm add @tiptap/react @tiptap/starter-kit @tiptap/extension-underline @tiptap/extension-text-align
pnpm add -D tailwindcss postcss autoprefixer @types/node
npx tailwindcss init -p
pnpm dlx shadcn-ui@latest init
cd ../..

# Worker dependencies
cd worker && pnpm init
pnpm add axios systeminformation better-sqlite3 winston bcryptjs
pnpm add -D typescript @types/node @types/bcryptjs ts-node nodemon
cd ..

# Electron
cd apps/electron && pnpm init
pnpm add electron
pnpm add -D electron-builder typescript ts-node
cd ../..
```

### Environment variables

**`apps/web/.env.local`** — gitignored:
```env
VITE_SUPABASE_URL=https://yhdyuzdfocvtgyatnrqz.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key-from-supabase-dashboard>
```

**`apps/electron/.env`** — gitignored:
```env
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
```

**`worker/.env`** — gitignored:
```env
SUPABASE_URL=https://yhdyuzdfocvtgyatnrqz.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
HEARTBEAT_INTERVAL_MS=30000
```

> **Never commit the service role key.** It grants full database access bypassing RLS.

### Supabase commands

```bash
# Push schema migrations to cloud project
supabase db push --project-ref yhdyuzdfocvtgyatnrqz

# Generate TypeScript types
supabase gen types typescript --project-ref yhdyuzdfocvtgyatnrqz \
  > packages/types/src/database.types.ts

# Deploy edge functions
supabase functions deploy worker-register --project-ref yhdyuzdfocvtgyatnrqz
supabase functions deploy worker-heartbeat --project-ref yhdyuzdfocvtgyatnrqz

# Open Studio
supabase studio --project-ref yhdyuzdfocvtgyatnrqz
```

### Dev run commands

```bash
# Web app only
pnpm --filter web dev

# Electron (loads web dev server)
pnpm --filter electron dev

# Worker (development)
cd worker && npx ts-node src/index.ts

# Regenerate types after schema change
bash scripts/gen-types.sh
```

---

## M. Testing and QA Checklist

### Auth
- [ ] Login with valid credentials → redirects to Tickets
- [ ] Login with wrong password → shows error, no redirect
- [ ] Unauthenticated access to protected route → redirects to login
- [ ] Logout → session cleared, redirects to login
- [ ] Admin → all nav items visible
- [ ] User → restricted nav items only

### Tenant and RBAC scoping
- [ ] User with no company access → Companies page shows 0 records
- [ ] User assigned Company A → sees only Company A in dropdowns and lists
- [ ] User cannot access Company B tickets via URL manipulation
- [ ] Site Access edit shows only sites from companies user has access to
- [ ] Admin bypass: admin sees all data regardless of access tables

### CRUD — per module
- [ ] Companies: create, rename, delete (with sites → confirm cascade behavior)
- [ ] Cost Centers: create, search returns correct result
- [ ] Sites: create linked to company + cost center, link shown in table
- [ ] Contracts: create with date range, status badge reflects status field
- [ ] Ticket Types: inline create from New Ticket form works
- [ ] Tickets: create → appears in list → status update → Export CSV file downloads
- [ ] New Ticket: Company dropdown shows only accessible companies for user role
- [ ] New Ticket: Site dropdown filters based on selected company
- [ ] Knowledge Base: create → filter by status → edit → delete
- [ ] Users: admin creates user → user can log in with those credentials

### Worker
- [ ] Worker starts with empty config → runs registration flow
- [ ] After registration → `worker.config.json` has `device_id` and `api_secret`
- [ ] Device card in UI shows Online badge after first heartbeat
- [ ] CPU and RAM values in card match what `systeminformation` reports
- [ ] Worker runs HTTP check on configured interval → result in `monitor_results`
- [ ] TCP check on closed port → status recorded as `down`
- [ ] Worker goes offline for 2+ minutes → device card shows Offline

### Monitoring and Realtime
- [ ] Create HTTP monitor → assign to device → result appears within one interval
- [ ] Monitor status 'up' → card shows Up badge
- [ ] Monitor status 'down' → failure count increments
- [ ] Open UI tab → worker posts result → card updates without page refresh
- [ ] Open two browser tabs → create ticket in one → other tab updates without refresh

---

## N. Security and Production-Readiness

### Auth safety
- [ ] RLS enabled on every table — no table left without policies
- [ ] Service role key only in Electron main process or Edge Functions — never in renderer or client bundle
- [ ] Anon key is safe in client (RLS limits what it can access)
- [ ] Password reset uses Supabase email flow (not custom)
- [ ] JWT expiry set appropriately (1h access token, 7d refresh token)

### Secrets
- [ ] `.env.local`, `worker/.env`, all key files listed in `.gitignore`
- [ ] `worker.config.json` (containing api_secret) has restricted file permissions (chmod 600 on Linux/macOS; ACL on Windows)
- [ ] `api_secret` stored as bcrypt hash in database — never plaintext
- [ ] Electron: `safeStorage` for session token persistence (Phase 2 hardening)

### Row-Level Security
- [ ] Every table: `alter table X enable row level security`
- [ ] Every table has at least one policy — tables with RLS and no policies block all access
- [ ] Policies tested explicitly: anon → blocked; user → scoped; admin → full tenant access
- [ ] `tenant_id` column present on every data table

### Input validation
- [ ] All forms use React Hook Form + Zod schema validation client-side
- [ ] Rich text output sanitized with DOMPurify before rendering with `dangerouslySetInnerHTML`
- [ ] Supabase RLS acts as server-side enforcement — client validation is not the only line of defense

### Worker security
- [ ] Registration key is single-use — Edge Function marks it consumed after first use
- [ ] Worker RLS or Edge Function validation ensures worker can only write to its own device record
- [ ] Worker does not have read access to other devices or tenant data

### Auditability
- [ ] `created_at` + `updated_at` on all tables
- [ ] `created_by` on tickets table
- [ ] Phase 2: `audit_log` table with triggers on all mutation operations

### Logging and failure handling
- [ ] Worker: Winston rotating file logs (10 MB × 5 files)
- [ ] Worker: SQLite offline buffer flushes on reconnect
- [ ] Web app: React ErrorBoundary catches render errors with user-facing message
- [ ] Supabase errors surface as toast notifications, not silent failures

### Least privilege
- [ ] Worker uses Edge Function proxy rather than direct service role key where possible
- [ ] Electron main process service role key not accessible to renderer via preload
- [ ] Dedicated Supabase database role for app (not the `postgres` superuser role)

---

## O. Market Gap Analysis

### Competitive landscape

| Competitor | Category | What they do better |
|---|---|---|
| Freshdesk / Zendesk | Pure helpdesk | Ticket automation, SLAs, email integration, reporting |
| ConnectWise Manage | MSP PSA | Contracts billing, time tracking, scheduling, integrations |
| NinjaRMM / Atera | RMM | Remote access, patch management, scripting, alerting |
| Freshservice | ITSM | Asset management, CMDB, change management, service catalog |
| HaloPSA | MSP all-in-one | Strongest feature parity to Operate1 concept |
| Betterstack / UptimeRobot | Uptime monitoring | Status pages, multi-location checks, alert channels |
| Zabbix / PRTG | Network monitoring | More check types, longer retention, dashboard depth |

### What competitors do better (today)

1. Ticket automation — auto-assign rules, SLA breach alerts, canned responses
2. Email-to-ticket inbound parsing
3. Remote access — click into device and get remote session
4. Patch management — push OS/software updates via agent
5. Monitor alerting — email/SMS/Slack when endpoint goes down
6. Time tracking + billing — log hours per ticket, generate invoice against contract
7. Public status page — clients see their own uptime dashboard
8. Multi-location monitoring — check from multiple geographic probe nodes
9. Reporting dashboards — ticket volume, SLA adherence, device health trends
10. API + webhook ecosystem — integrate with PSA, accounting, communication tools

### Fast wins that improve buyer appeal without delaying MVP

| Feature | Effort | Impact |
|---|---|---|
| Monitor down email alert | 1 day | Immediate enterprise credibility |
| Ticket email notifications (created/updated) | 2 days | Clients expect this as baseline |
| Dashboard home screen (counts only) | 0.5 days | First thing every user sees |
| Ticket assignment to technician | 1 hour | Technicians need it on day one |
| Public status page (read-only) | 1 day | Clients show this to their own clients |

All five above can be built in Phase 1.5 — after the core MVP is running but before calling it production-ready.

---

## P. Final Recommendation

### Build first — Week 1

**Goal: auth + core data + tickets working**

1. Run Supabase migrations (schema + RLS + seed)
2. Build React auth flow (login/logout/role load)
3. Build sidebar layout (clone nav from screenshots)
4. Build Companies, Cost Centers, Sites, Contracts CRUD
5. Build Company Access + Site Access
6. Build Tickets list + New Ticket form with Tiptap

**Checkpoint:** You now have a credible helpdesk to demo. Tenant scoping works. RBAC works. The core workflow — client submits ticket, admin sees it — is functional.

### Build next — Week 2

**Goal: devices + monitoring + worker live**

7. Build User Management CRUD
8. Build Knowledge Base
9. Build Devices page + registration key generation
10. Build Worker: registration, heartbeat, metrics reporting
11. Build Monitors page + New Monitor form
12. Add check execution to worker (HTTP, ICMP, TCP)
13. Add Supabase Realtime to Devices and Monitors pages
14. Wrap everything in the Electron shell

**Checkpoint:** Full MVP. Devices go online. Monitors report. Tickets are managed. You can install the worker on a client machine and show live CPU/RAM and endpoint uptime in the app. Tag `v0.1.0-pilot`.

### Immediately after MVP

Add **monitor-down email alerts** and a **dashboard home screen**. These are the two features that transform this from an interesting demo into something a client would actually pay for.

Then run it as a real pilot with one client for 30 days to identify what actually breaks and what they genuinely need before committing to Phase 2.

---

*The schema is the most critical artifact. Get it right before writing a single React component. Start with `supabase db push`.*
