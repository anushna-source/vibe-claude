# CLAUDE.md

Working agreement for Claude Code in this repository.
**Read `AGENTS.md` first** — it holds the stack, layout, domain rules, and conventions. This file covers how to work, not what the project is.

## Current state

MVP is being built in this order. Do not skip ahead; each step assumes the previous one works.

1. Scaffold + health check — **done** (API only; `apps/web` is not scaffolded yet)
2. Schema and migrations (MVP tables)
3. Auth end to end (login, refresh, RBAC)
4. Locations, departments, categories
5. Staff module + CSV import
6. Assets module (CRUD, tag generation, list, detail)
7. Assignments (assign / return / transfer + timeline)
8. Search and filters
9. Dashboard and reports
10. Audit log and hardening
11. Seed real data, pilot physical count

Keep this list updated as steps complete.

## Git workflow (Gitflow, PR-based)

Remote: `origin` → `https://github.com/anushna-source/vibe-claude.git`

| Branch | Purpose | Branches from | Merges into |
| --- | --- | --- | --- |
| `main` | Deployment branch. Always deployable; every commit is a release. | — | — |
| `develop` | Integration branch for ongoing development. | `main` | — |
| `feature/<step>-<slug>` | One module or feature (e.g. `feature/03-auth`, `feature/06-assets-crud`). | `develop` | `develop` |
| `release/<version>` | Release plan/stabilisation (e.g. `release/0.1.0`). Only fixes, version bump, and release notes. | `develop` | `main` and back into `develop` |
| `hotfix/<slug>` | Urgent production fix only. | `main` | `main` and back into `develop` |

Rules:

- **Everything merges through a pull request.** No direct pushes to `main` or `develop`, and no local merges pushed up.
- **PR targets:** feature → `develop`; release → `main` (then merge `main` back into `develop` via PR); hotfix → `main` (and `develop`).
- **Merge method:** squash-merge feature PRs into `develop` (one conventional commit per feature); use a merge commit for `release/*` and `hotfix/*` into `main` so history stays traceable.
- **Tag releases** on `main` after the release PR merges: `vX.Y.Z` (semver).
- **One feature branch per build step** in the "Current state" list; keep branches short-lived and rebase on `develop` before opening the PR.
- **A PR is ready only when** `pnpm typecheck`, `pnpm lint`, and `pnpm test` pass, and the description states what changed, what was tested, and what was not.
- **PRs that touch auth/RBAC, `asset_events`, the one-live-assignment invariant, or migrations** must say so explicitly in the description.
- **Claude never pushes, opens PRs, merges, or tags without being asked** in that session. Branch creation and local commits are fine.
- **GitHub branch protection** (to configure on the repo, not by Claude): require PR + 1 approval + passing checks on `main` and `develop`; block force-push and deletion.

## How to work here

- **Plan before large changes.** For anything touching more than three files, outline the plan and wait for confirmation.
- **Small, reviewable commits**, on a `feature/*` branch (never directly on `main` or `develop`). One feature or fix per commit. Conventional commit messages (`feat:`, `fix:`, `refactor:`, `chore:`).
- **Migrations are one-way.** Write a new migration; never edit an applied one. Include the down migration.
- **Ask rather than assume** on: adding a dependency, changing the data model, changing an API response shape, or introducing a new pattern that isn't already in the codebase.
- **Match what exists.** Before writing a new module, read an existing one and copy its shape. Consistency beats cleverness here.
- **Do not create files that weren't asked for** — no extra READMEs, no summary documents, no example files alongside a feature.

## When writing backend code

- Start from the zod schema, then the service, then the controller, then the route.
- Business logic belongs in the service. If a controller has an `if` about domain rules, it's in the wrong place.
- Anything that changes an asset's state goes through the assignment/asset service functions — don't write ad-hoc UPDATE statements against `assets`.
- Wrap multi-table writes in a transaction. Assign, return, transfer, and purchase-receive all qualify.

## When writing frontend code

- Check `components/shared/` and `components/ui/` before building a new component.
- Server Components fetch; Client Components interact. Don't make a page a Client Component to avoid a small refactor.
- Loading and empty states are part of the feature, not a follow-up.

## Verification before declaring done

Run and report the results of:

```bash
pnpm typecheck
pnpm lint
pnpm test
```

Then state plainly: what changed, what was tested, and what was not. If something is unfinished or uncertain, say so rather than describing it as complete.

## Things to flag rather than fix silently

- A change that would break the one-live-assignment invariant
- Anything that would drop or rewrite `asset_events` history
- Auth or RBAC changes
- Performance problems visible on asset lists (this will grow past 1,500 rows)
- Secrets, license keys, or staff PII appearing in logs or API responses
