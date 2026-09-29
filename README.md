# Broadway Infosys Inventory

Internal inventory management system for **Broadway Infosys**, an IT training institute with 80+ staff.
It tracks IT assets from purchase to disposal: staff laptops and phones, training-lab desktops,
projectors and classroom displays, networking gear, peripherals, and spares.

Internal users only (Admin, IT Staff, Viewer). There are no public-facing pages.

## Status

The MVP is being built in order (full list in [CLAUDE.md](CLAUDE.md)):

| Step | Scope | State |
| --- | --- | --- |
| 1 | Scaffold + health check | ✅ Done (API and web) |
| 2 | Schema and migrations | ✅ Done |
| 3 | Auth (login, refresh, RBAC) | ✅ Done |
| 4–11 | Locations/departments/categories, staff, assets, assignments, search, dashboard, audit log, pilot | Not started |

What works today: an Express + TypeScript API with a health endpoint, validated configuration,
structured logging, a standard error envelope and security headers; and a Next.js dashboard shell
that reads that endpoint live through the shared zod contract. 108 automated tests, and CI.
There is **no database schema and no authentication yet**.

## Stack

| Layer | Choice |
| --- | --- |
| Frontend | Next.js 16 (App Router) + React 19 + Tailwind CSS 4 + shadcn/ui |
| Backend | Express 5 + TypeScript, REST |
| Database | PostgreSQL 17 (local via Docker) |
| Monorepo | pnpm workspaces |
| Validation | zod, shared between apps via `packages/shared` |
| Data fetching | Server Components, with TanStack Query for client interactivity |
| Tests | Vitest, Supertest (API), Testing Library (web) |

## Prerequisites

- **Node.js 24** (see [.nvmrc](.nvmrc); 22 or newer works)
- **pnpm 12**: `npm install -g pnpm`
- **Docker Desktop** with the WSL 2 backend (Windows) for the local database

## Getting started

```bash
pnpm install
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
pnpm db:up          # start Postgres in Docker and wait until it is healthy
pnpm dev            # API on :4000 and web on :3000
```

Open <http://localhost:3000> for the dashboard. It shows the API's live status, which is the
quickest way to confirm both halves are talking to each other.

Check the API directly:

```bash
curl http://localhost:4000/api/v1/health
```

```json
{
  "data": {
    "status": "ok",
    "uptimeSeconds": 1.053,
    "timestamp": "2026-09-21T13:16:32.247Z",
    "version": "1.0.0",
    "environment": "development"
  }
}
```

## Commands

| Command | What it does |
| --- | --- |
| `pnpm dev` | Run the API and the web app together, with reload on change |
| `pnpm --filter api dev` / `pnpm --filter web dev` | Run just one of them |
| `pnpm build` | Compile the packages and build the web app |
| `pnpm typecheck` | Type-check source and tests |
| `pnpm lint` | ESLint |
| `pnpm format` / `pnpm format:check` | Prettier write / check |
| `pnpm test` | Run all tests |
| `pnpm test:coverage` | Tests with coverage thresholds enforced |
| `pnpm db:up` | Start Postgres and wait until healthy |
| `pnpm db:down` | Stop Postgres (data is kept) |
| `pnpm db:migrate` / `pnpm db:migrate:down` | Apply migrations / roll the last one back |
| `pnpm db:seed` | Insert departments, locations and categories (safe to repeat) |
| `pnpm db:reset` | **Delete all local data** and start a fresh database |
| `pnpm db:logs` | Follow the Postgres logs |
| `pnpm db:psql` | Open a `psql` shell on the dev database |

## Local database

[docker-compose.yml](docker-compose.yml) runs `postgres:17-alpine` with two databases:

| Database | Used for | Connection string |
| --- | --- | --- |
| `inventory` | Development | `postgres://inventory:inventory@localhost:5432/inventory` |
| `inventory_test` | Integration tests | `postgres://inventory:inventory@localhost:5432/inventory_test` |

- The port is bound to `127.0.0.1` only, so the database is not reachable from your network.
- The server timezone is UTC. Dates are stored in UTC and shown in Asia/Kathmandu.
- The credentials are local development defaults. Never reuse them anywhere real.
- `inventory_test` is created by [docker/postgres/init](docker/postgres/init) the first time the
  data volume is created. If you change that script, run `pnpm db:reset`.
- Port 5432 already taken by another Postgres? Set `POSTGRES_PORT=5433` in your shell or a
  root `.env` file, and update the connection strings to match.

## Project layout

```
apps/api            Express API. Feature modules under src/modules/
  src/app.ts        Builds the app (no listen), used by the server and the tests
  src/server.ts     Binds the port, graceful shutdown
  src/config/       zod-validated environment
  src/middleware/   request id, logging, validation, 404, error handler
  src/modules/      one folder per feature: *.routes, *.controller, *.service, *.schema
  tests/            unit/ and integration/
apps/web            Next.js App Router frontend
  app/(dashboard)/  the signed-in shell and its pages
  app/globals.css   Tailwind 4 setup and design tokens (there is no JS config file)
  components/ui/    shadcn/ui primitives
  components/shared/ reusable pieces: page header, empty state, error state
  lib/api-client.ts the only place the app calls the API
  tests/            unit/ and components/
packages/shared     zod schemas and types used by both apps
packages/config     shared tsconfig, ESLint and Prettier config
docker/             Postgres init scripts
```

## Routes

| Route | What it is |
| --- | --- |
| `/` | Landing page: what the system does, live API status, which modules exist, build progress |
| `/signup`, `/login` | **Public.** Anyone can create an account; new accounts are Viewer |
| `/dashboard` | Requires a session. Signed-out visitors are redirected to `/login` |

The app sets `robots: noindex, nofollow`. Both session tokens are held in `httpOnly` cookies on the
web app's own origin, so no page script can read them; middleware renews the short-lived access
token from the refresh cookie. Route protection in the browser is a convenience — **the API
enforces authentication and roles on every request**.

## Frontend conventions

- Server Components fetch data; `'use client'` only where interactivity requires it.
- All API access goes through `lib/api-client.ts`, which unwraps the `{ data }` envelope and turns
  `{ error }` into a typed `ApiError`. No raw `fetch` in components.
- Reuse `components/shared/` before building anything new; `components/ui/` holds shadcn primitives.
- Tailwind 4 is configured in `app/globals.css` with `@theme`, not in a JS config file. Add new
  design tokens there rather than hard-coding colours.
- Loading and empty states ship with the feature, not afterwards.

## Database

Migrations live in `apps/api/migrations` and run with Kysely. Each one ships an `up` **and** a
`down`; never edit one that has already been applied — add a new migration instead.

The domain rules in [AGENT.md](AGENT.md) are enforced by the database, not by application code:

- one live assignment per asset (a partial unique index);
- an assignment names a person **or** a location, never both (a CHECK constraint);
- `asset_tag` cannot be changed after insert (a trigger);
- `asset_events` and `audit_logs` reject `UPDATE` and `DELETE` (triggers);
- unique indexes ignore soft-deleted rows, so a deleted code or email can be reused;
- money is `numeric` and comes back as a string, so paisa never round-trip through a float.

Integration tests run against a real Postgres, never a mock. Each run creates its own schema and
drops it afterwards, so `pnpm db:up` must be running first.

## Accounts and access

**Registration is open.** Anyone who can reach the app can sign up, and a new account is a **Viewer,
active immediately** — which means read access to the whole asset register and to staff records,
including names, emails and phone numbers. Rethink this before exposing the app beyond the office
network. Roles are only changed by an Admin.

| Endpoint | Who |
| --- | --- |
| `POST /api/v1/auth/signup`, `POST /api/v1/auth/login` | Public, rate limited per IP |
| `POST /api/v1/auth/refresh`, `POST /api/v1/auth/logout` | Anyone holding the refresh cookie |
| `GET /api/v1/auth/me` | Any signed-in user |
| `GET /api/v1/users`, `PATCH /api/v1/users/:id` | **Admin only** |

- Access tokens are JWTs sent as `Authorization: Bearer`, valid 15 minutes.
- Refresh tokens are opaque, stored only as a hash, and delivered in an `httpOnly` cookie.
  Using one rotates it; **replaying a rotated token revokes every session for that user.**
- Roles are enforced by middleware on the server. Hiding a button is not authorization.
- Create the first Admin by setting `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD`, then `pnpm db:seed`.

## API conventions

- Base path `/api/v1`. `GET /health` reports liveness; `GET /health/ready` returns 503 when the
  database is unreachable, so a load balancer can drain the instance.
- Single resources return `{ data }`. Lists return `{ data, meta: { page, limit, total } }`.
- Errors return `{ error: { code, message, details?, requestId? } }`. Unexpected errors return a
  generic 500 and never expose stack traces or internal messages.
- Every response carries an `X-Request-Id` header, which also appears in the logs.
- Request bodies and queries are validated with zod before they reach a service.

## Contributing

Read these before writing code:

- [AGENT.md](AGENT.md): stack, domain rules, and conventions (the rules that must not be broken).
- [CLAUDE.md](CLAUDE.md): working agreement, build order, and the Git workflow.

In short: Gitflow with `main` as the deployment branch and `develop` for integration. Work on a
`feature/*` branch and merge through a pull request. A change is ready only when
`pnpm typecheck`, `pnpm lint`, and `pnpm test` all pass.

## Troubleshooting

**Docker says it cannot connect to `docker_engine`.** Docker Desktop is not running, or its
WSL 2 backend is missing. Check with `wsl --status`. If it errors (for example
`REGDB_E_CLASSNOTREG`), open PowerShell as Administrator, run `wsl --install --no-distribution`
(or `wsl --update`), restart Windows, then start Docker Desktop. Virtualization must be enabled
in the BIOS (Task Manager → Performance → CPU → Virtualization).

**`pnpm` is not recognised.** Install it with `npm install -g pnpm` and open a new terminal.
