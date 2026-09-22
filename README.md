# Broadway Infosys Inventory

Internal inventory management system for **Broadway Infosys**, an IT training institute with 80+ staff.
It tracks IT assets from purchase to disposal: staff laptops and phones, training-lab desktops,
projectors and classroom displays, networking gear, peripherals, and spares.

Internal users only (Admin, IT Staff, Viewer). There are no public-facing pages.

## Status

The MVP is being built in order (full list in [CLAUDE.md](CLAUDE.md)):

| Step | Scope | State |
| --- | --- | --- |
| 1 | Scaffold + health check | ✅ Done (API only) |
| 2 | Schema and migrations | Next. Local Postgres via Docker is ready |
| 3 | Auth (login, refresh, RBAC) | Not started |
| 4–11 | Locations/departments/categories, staff, assets, assignments, search, dashboard, audit log, pilot | Not started |

What works today: an Express + TypeScript API with a health endpoint, validated configuration,
structured logging, a standard error envelope, security headers, 68 automated tests, and CI.
There is **no web app, database schema, or authentication yet**.

## Stack

| Layer | Choice |
| --- | --- |
| Frontend | Next.js (App Router) + TypeScript (not scaffolded yet) |
| Backend | Express 5 + TypeScript, REST |
| Database | PostgreSQL 17 (local via Docker) |
| Monorepo | pnpm workspaces |
| Validation | zod, shared between apps via `packages/shared` |
| Tests | Vitest + Supertest |

## Prerequisites

- **Node.js 24** (see [.nvmrc](.nvmrc); 22 or newer works)
- **pnpm 12**: `npm install -g pnpm`
- **Docker Desktop** with the WSL 2 backend (Windows) for the local database

## Getting started

```bash
pnpm install
cp apps/api/.env.example apps/api/.env
pnpm db:up          # start Postgres in Docker and wait until it is healthy
pnpm dev            # API on http://localhost:4000
```

Check it is running:

```bash
curl http://localhost:4000/api/v1/health
```

```json
{
  "data": {
    "status": "ok",
    "uptimeSeconds": 1.053,
    "timestamp": "2026-09-21T13:16:32.247Z",
    "version": "0.1.0",
    "environment": "development"
  }
}
```

## Commands

| Command | What it does |
| --- | --- |
| `pnpm dev` | Run the API with reload on change |
| `pnpm build` | Compile all packages (`tsc -b`) |
| `pnpm typecheck` | Type-check source and tests |
| `pnpm lint` | ESLint |
| `pnpm format` / `pnpm format:check` | Prettier write / check |
| `pnpm test` | Run all tests |
| `pnpm test:coverage` | Tests with coverage thresholds enforced |
| `pnpm db:up` | Start Postgres and wait until healthy |
| `pnpm db:down` | Stop Postgres (data is kept) |
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
packages/shared     zod schemas and types used by both apps
packages/config     shared tsconfig, ESLint and Prettier config
docker/             Postgres init scripts
```

## API conventions

- Base path `/api/v1`.
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
