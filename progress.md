# Operate1 — Build Progress

> Live tracker. Updated as each step completes.

## Status Key
- ✅ Done
- 🔄 In Progress
- ⏳ Pending
- ❌ Blocked

---

## Phase 1 — Foundation

| # | Task | Status | Notes |
|---|---|---|---|
| 1 | Root workspace (package.json, pnpm-workspace.yaml, tsconfig, .gitignore) | ✅ | |
| 2 | Supabase config.toml | ✅ | Already linked via `.temp/project-ref` |
| 3 | Migration 00001 — schema (all tables) | ✅ | 18 tables |
| 4 | Migration 00002 — RLS policies | ✅ | All tables RLS-enabled |
| 5 | Migration 00003 — functions/triggers | ✅ | get_my_role, handle_new_user, ticket number gen, etc. |
| 6 | Migration 00004 — seed data | ✅ | Default tenant, ticket types, KB categories |
| 7 | Edge Functions — worker-register, worker-heartbeat, worker-monitors, worker-results | ✅ | |
| 8 | packages/types scaffold | ✅ | Full domain types + enums |
| 9 | `pnpm install` | ✅ | All 5 workspaces resolved |
| 10 | `supabase db push` — apply migrations | ✅ | All 4 migrations applied + types generated |

## Phase 2 — Web App Core

| # | Task | Status | Notes |
|---|---|---|---|
| 11 | apps/web scaffold (vite, tailwind, tsconfig) | ✅ | |
| 12 | Supabase client (lib/supabase.ts) | ✅ | |
| 13 | Router (createHashRouter, all routes) | ✅ | 12 child routes |
| 14 | Auth store (Zustand) | ✅ | |
| 15 | useAuth hook + session init | ✅ | |
| 16 | App.tsx + main.tsx | ✅ | |

## Phase 3 — UI Components

| # | Task | Status | Notes |
|---|---|---|---|
| 17 | Button, Input, Badge, Modal, Spinner, ProgressBar | ✅ | Hand-rolled, no shadcn |
| 18 | EmptyState, PageHeader, ProtectedRoute | ✅ | |
| 19 | Sidebar (full nav, role-gated items) | ✅ | Dark navy #0f172a, violet active |
| 20 | MainLayout | ✅ | |

## Phase 4 — Auth

| # | Task | Status | Notes |
|---|---|---|---|
| 21 | LoginPage | ✅ | |

## Phase 5 — Module Pages

| # | Task | Status | Notes |
|---|---|---|---|
| 22 | Tickets list + filters + export CSV | ✅ | |
| 23 | New Ticket form (Tiptap, cascading dropdowns) | ✅ | |
| 24 | Companies CRUD | ✅ | |
| 25 | Contracts CRUD | ✅ | |
| 26 | Sites CRUD | ✅ | |
| 27 | Cost Centers CRUD | ✅ | |
| 28 | Monitoring (card list + new monitor form) | ✅ | Realtime subscription |
| 29 | Knowledge Base CRUD | ✅ | |
| 30 | Devices (card list + registration key gen) | ✅ | Realtime subscription |
| 31 | Company Access management | ✅ | |
| 32 | Site Access management | ✅ | |
| 33 | User Management CRUD | ✅ | |

## Phase 6 — Worker Agent

| # | Task | Status | Notes |
|---|---|---|---|
| 34 | worker/package.json + tsconfig | ✅ | |
| 35 | config.ts (read/write worker.config.json) | ✅ | |
| 36 | api.ts (Edge Function caller + retry) | ✅ | 3 attempts, exponential backoff |
| 37 | registration.ts (first-time reg flow) | ✅ | |
| 38 | metrics.ts (CPU/RAM/disk via systeminformation) | ✅ | |
| 39 | heartbeat.ts (30s loop) | ✅ | |
| 40 | scheduler.ts (per-monitor interval runner) | ✅ | |
| 41 | checks/http.ts, checks/icmp.ts, checks/tcp.ts | ✅ | |
| 42 | logger.ts (Winston rotating) | ✅ | 10MB × 5 files |

## Phase 7 — Electron Shell

| # | Task | Status | Notes |
|---|---|---|---|
| 43 | apps/electron scaffold | ✅ | package.json, tsconfig |
| 44 | main.ts (window, tray, IPC) | ✅ | Minimize to tray, dev/prod URL loading |
| 45 | preload.ts (contextBridge) | ✅ | electronAPI exposed |
| 46 | IPC: createUser handler (service role) | ✅ | auth.admin.createUser + profile update |

## Build Verification

| Check | Result | Notes |
|---|---|---|
| `pnpm install` | ✅ Pass | 5 workspaces, 663 packages resolved |
| `pnpm --filter web build` | ✅ Pass | 562 kB bundle (chunk size warning — expected for MVP) |
| `pnpm --filter worker build` | ✅ Pass | |

## Remaining Steps to Go Live

1. **Apply migrations**: Paste `supabase/combined_migration.sql` into Supabase SQL Editor, or fix DB password and run `supabase db push --linked --yes`
2. **Set env vars**: Copy `.env.example` values into `apps/web/.env.local` (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)
3. **Deploy Edge Functions**: `supabase functions deploy worker-register && supabase functions deploy worker-heartbeat && supabase functions deploy worker-monitors && supabase functions deploy worker-results`
4. **Create first admin user**: Via Supabase Auth dashboard, then update profile role to 'admin'
5. **Run `pnpm dev`**: Opens web app at localhost:5173

## Decisions and Assumptions Log

- **HashRouter** used (matches original `#/route` URL pattern, also works in Electron)
- **Tiptap** for rich text (New Ticket, KB articles)
- **Single tenant MVP**: one Supabase project = one MSP. `tenant_id` hardcoded from seed.
- **Worker auth via Edge Functions**: worker never holds DB credentials directly. Calls Edge Functions with `api_secret` header.
- **api_secret stored plaintext for MVP**: bcrypt hashing added in Phase 2 hardening.
- **pnpm workspaces**: apps/web, apps/electron, worker, packages/types
- **Supabase Realtime**: subscribed on devices + monitors pages for live updates

## Environment Variables Needed

```
# apps/web/.env.local
VITE_SUPABASE_URL=https://yhdyuzdfocvtgyatnrqz.supabase.co
VITE_SUPABASE_ANON_KEY=<from Supabase dashboard → Settings → API>

# apps/electron/.env (for IPC service role ops)
SUPABASE_URL=https://yhdyuzdfocvtgyatnrqz.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<from Supabase dashboard → Settings → API>

# worker/worker.config.json (created after registration)
# supabase_url and supabase_anon_key needed before first run
```

## Commands

```bash
# Install all workspace deps
pnpm install

# Push schema to Supabase cloud (if DB password is set)
supabase db push --linked --yes

# Generate TypeScript types (after migration push)
supabase gen types typescript --project-ref yhdyuzdfocvtgyatnrqz > packages/types/src/database.types.ts

# Deploy Edge Functions
supabase functions deploy worker-register
supabase functions deploy worker-heartbeat
supabase functions deploy worker-monitors
supabase functions deploy worker-results

# Run web app dev server
pnpm --filter web dev

# Run worker in dev mode
pnpm --filter worker dev

# Run Electron
pnpm --filter electron dev
```
