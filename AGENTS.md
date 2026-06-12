# AGENTS.md

3D satellite tracker ("Orbital") — a dark-themed static web app that renders ~10,000
satellites in real-time 3D and shows what is overhead at the user's GPS location from an
oblique camera angle.

- dev: https://satellite.dev.devtools.site / prd: https://satellite.devtools.site
- Stack: Vite + React + TypeScript, React Three Fiber + drei, satellite.js (SGP4), zustand
- Infra: Terraform (S3 + CloudFront + ACM + Route53), workspaces `dev`/`prd` matching the
  AWS profile names. State buckets are created with `make tf-bootstrap ENV=...`

## Rules

- NEVER: deploy to prd without green tests
- NEVER: hardcode secrets or API keys
- IMPORTANT: infra changes go through Terraform, not ad-hoc aws CLI mutations
- All runtimes are pinned in `mise.toml` (`mise install` after cloning; direnv loads it)
- Use root `make` targets as the entrypoint for everything (`make help`)

## Architecture notes

- Coordinate frame is Earth-fixed (ECF); the globe never rotates. The SGP4 worker
  (`src/workers/propagator.worker.ts`) converts ECI→ECF→scene units (1 unit = 1000 km,
  axis remap in `src/lib/geo.ts`). The main thread linearly extrapolates positions
  between worker snapshots — never propagate on the main thread.
- Never call React `setState` inside `useFrame`; live readouts poll on ≤4 Hz intervals.
- TLE data comes from CelesTrak via `src/lib/groups.ts`/`src/lib/tle.ts` with a 2 h
  localStorage cache. E2E tests intercept these URLs with fixtures — keep all CelesTrak
  fetches going through `tleUrl()` so interception keeps working.
- `window.__satDebug` is the E2E assertion surface (sat counts, selection, camera mode);
  update it when adding user-visible state.

## Testing

- `make test-unit` — vitest (happy-dom). Heavy logic lives in pure functions under
  `src/lib/` so it stays unit-testable.
- `make e2e-local` — builds the docker compose stack (nginx on :8080) and runs Playwright
  against it. `make e2e ENV=dev|prd` targets the deployed environments.
- E2E must stay deterministic: CelesTrak is route-intercepted with fixtures in
  `tests/fixtures/`, geolocation is mocked via Playwright context options.

## Deploy

- `make deploy ENV=dev` — build, S3 sync, CloudFront invalidation (profile = ENV)
- Order: unit green → e2e-local green → deploy dev → e2e dev green → manual check → prd
