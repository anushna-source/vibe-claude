# AGENTS.md

Context for AI coding agents working in this repository. Read this before writing code.

## Project

Internal inventory management system for **Broadway Infosys**, an IT training institute with 80+ staff.
It tracks IT assets from purchase to disposal: staff laptops and phones, training-lab desktops,
projectors and classroom displays, networking gear, peripherals, spares, and software licenses.

Roles are Admin, IT Staff, Viewer (MVP roles).

**Registration is open.** `/signup` and `/login` are public, and anyone who can reach the app can
create an account. New accounts are **Viewer and active immediately**, which means any visitor can
read the whole asset register and all staff records, including names, emails and phone numbers.
Everything else requires a session, and every write requires a role that permits it. If this app is
ever exposed beyond the office network, revisit that decision first.

## Stack

| Layer | Choice |
| --- | --- |
| Frontend | Next.js (App Router, latest) + TypeScript |
| Backend | Express + TypeScript, REST |
| Database | PostgreSQL |
| Monorepo | pnpm workspaces |
| Validation | zod (shared between apps via `packages/shared`) |
| Data fetching | TanStack Query in the web app |

TypeScript is `strict` everywhere. No `any` without an inline comment explaining why.

## Repository layout

```
apps/web      Next.js app (App Router). Route groups: (auth), (dashboard).
apps/api      Express API. Feature modules under src/modules/.
packages/shared   zod schemas + inferred types used by BOTH apps.
packages/config   eslint / tsconfig / prettier bases.
```

Each backend module is a folder with the same four files:
`*.routes.ts`, `*.controller.ts`, `*.service.ts`, `*.schema.ts`.
Controllers parse and respond. Services hold business logic and own transactions.
Routes only wire middleware. Do not put database queries in controllers.

## Commands

```bash
pnpm install
pnpm dev              # web + api together
pnpm --filter api dev
pnpm --filter web dev
pnpm db:migrate       # run migrations
pnpm db:seed          # departments, locations, categories, one admin user
pnpm test
pnpm lint
pnpm typecheck
```

Postgres runs locally via `docker-compose up -d`.

## Domain rules that must not be broken

1. **Asset tags are immutable.** Format `BI-<CATEGORY>-<NNNN>` (e.g. `BI-LAP-0042`). Generated server-side, never edited afterwards.
2. **One live assignment per asset.** A row in `assignments` with `returned_at IS NULL` is the live one. This is enforced by a partial unique index — do not work around it in application code.
3. **Assign / return / transfer are transactional.** Each writes the `assignments` row, updates `assets.status` and `assets.current_assignment_id`, and appends an `asset_events` row. All in one transaction, or none of it.
4. **`asset_events` is append-only.** Never UPDATE or DELETE a row there. It is the asset timeline and the basis of audits.
5. **Soft deletes only.** Every table has `deleted_at`, except the append-only ones (`asset_events`,
   `audit_logs`), where a soft delete would contradict rule 4. Queries must exclude soft-deleted rows
   by default, and unique indexes are partial (`WHERE deleted_at IS NULL`) so a deleted row frees its value.
6. **Assets can be assigned to a person OR a location**, not both. Lab desktops and projectors belong to rooms; laptops and phones belong to staff. `assignee_type` decides which FK is populated.
7. **Money is `numeric`, stored in NPR.** Never float. Dates stored UTC, displayed Asia/Kathmandu.
8. **Every mutation writes an audit log row** with actor, entity, before/after.
9. **License keys are encrypted at rest** and never returned in list endpoints.

## API conventions

- Base path `/api/v1`. JWT bearer auth; access + refresh tokens.
- Payloads are `camelCase`; database columns are `snake_case`. Mapping happens in the service layer.
- List endpoints accept `?page`, `?limit`, `?sort`, `?q` plus resource filters, and return
  `{ data, meta: { page, limit, total } }`.
- Single resources return `{ data }`. Errors return `{ error: { code, message, details? } }`.
- Validate every request body and query with zod at the route boundary. No unvalidated input reaches a service.
- RBAC is enforced in middleware on the server. UI hiding is not authorization.

## Frontend conventions

- Server Components by default; `"use client"` only where interactivity requires it.
- All API access goes through `lib/api-client.ts`. No raw `fetch` in components.
- Shared table, filter bar, and empty-state components live in `components/shared/` — reuse them rather than rebuilding per page.
- Forms use react-hook-form + the zod schema from `packages/shared`, so client and server validate identically.

## Testing

- Services get unit tests. Endpoints get integration tests against a test database.
- Mandatory test coverage for: assign/return/transfer transactions, the one-live-assignment constraint, RBAC denials, and asset tag generation under concurrency.
- Do not mock the database in integration tests; use a disposable Postgres instance.

## Before you finish a task

- `pnpm typecheck && pnpm lint && pnpm test` all pass.
- New tables or columns come with a migration; never edit an already-applied migration.
- If a change touches shared types, update `packages/shared` first and let both apps compile against it.
