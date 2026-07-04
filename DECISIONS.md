# DECISIONS.md — ambiguity resolutions (Spec Section 11.9)

Every choice not spelled out by the spec is logged here (simplest viable option), per the agent behaviour rule.

## Foundation (Lead/PM)
- **D-001 Monorepo tooling:** npm workspaces (not Nx/Turbo) for M1 — simplest that satisfies the `apps/*` + `packages/*` layout. Revisit if build orchestration grows.
- **D-002 `packages/shared-ui` deferred:** In M1 each Angular app keeps its own components; a shared component library is extracted later to avoid two agents contending on one package. The `admin-web` and `platform-web` apps each own their UI for now.
- **D-003 Two separate Angular apps** (`apps/admin-web`, `apps/platform-web`) rather than one Angular workspace with two projects — keeps agent workstreams in disjoint directories and matches the "separate domains/deployments" intent of the spec.
- **D-004 API contract as the sync point:** `docs/API_CONTRACT.M1.md` + `packages/shared-types` are frozen before web work fans out. Backend owns changes and announces them.
- **D-005 DB roles:** migrations run as owner (`tftsp`), the app connects as `tftsp_app` WITHOUT BYPASSRLS so RLS is always enforced (Spec Section 4.2).
- **D-006 Partial dates:** year-only birth/death stored as `YYYY-01-01` with a `*_precision` marker deferred to when the UI needs it; API accepts `YYYY` or full ISO.
