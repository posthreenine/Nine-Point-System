# THREE NINE POS

A complete Point of Sale system foundation with user management, role management, and JWT authentication.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/pos run dev` — run the frontend (port 24730)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec

## Default Login

- **Username:** `admin`
- **Password:** `admin123`

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite + Tailwind CSS + wouter
- API: Express 5
- DB: SQLite (better-sqlite3) — stored at `artifacts/api-server/data/pos.db`
- Auth: JWT (jsonwebtoken) + bcrypt
- Validation: Zod, generated from OpenAPI spec

## Where things live

- `lib/api-spec/openapi.yaml` — OpenAPI contract (source of truth)
- `lib/api-client-react/src/generated/` — generated React Query hooks
- `lib/api-zod/src/generated/` — generated Zod schemas (used server-side)
- `artifacts/api-server/src/lib/database.ts` — SQLite setup + seeding
- `artifacts/api-server/src/lib/jwt.ts` — JWT sign/verify
- `artifacts/api-server/src/middlewares/auth.ts` — requireAuth middleware
- `artifacts/api-server/src/routes/` — auth, users, roles, dashboard routes
- `artifacts/pos/src/` — React frontend

## Architecture decisions

- SQLite with better-sqlite3 for zero-config persistence; DB file lives in `artifacts/api-server/data/`
- OpenAPI-first: all types generated from `lib/api-spec/openapi.yaml`, never handwritten
- JWT stored in localStorage under key `pos_token`; custom-fetch attaches Bearer header
- System roles (Owner, Manager, Cashier, Kitchen) are seeded and protected from deletion
- Express 5 with async route handlers; all inputs validated with generated Zod schemas

## Product

- **Login** — branded full-page login with JWT session
- **Dashboard** — stats overview: total/active users, roles, users-by-role breakdown
- **Users** — full CRUD: create, edit, delete, reset password; role badge + active/inactive status
- **Roles** — create/edit/delete custom roles; system roles are protected
- **Change Password** — secure self-service password change
- **Responsive** — collapsible sidebar for mobile/tablet, full sidebar on desktop

## Roles

| Role    | Description                                      |
|---------|--------------------------------------------------|
| Owner   | Full access to all features and settings         |
| Manager | Manage staff, view reports, configure operations |
| Cashier | Process transactions and handle customer orders  |
| Kitchen | View and update kitchen orders                   |

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Run `pnpm approve-builds` if better-sqlite3 native build is blocked after adding a new dev
- JWT secret is hardcoded for dev; set `JWT_SECRET` env var in production
- SQLite DB is not provisioned via Drizzle — it's initialized directly in `database.ts`

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
