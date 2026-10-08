---
title: Frontend
---

# Frontend (web)

The single-page application clinicians actually use.

```{contents}
:local:
:depth: 2
```

## Identity

| | |
|---|---|
| Compose service | `web` |
| Image | built from repository root via `docker/frontend/Dockerfile` |
| Listen port | 3000 (internal) |
| Reached via | Envoy `http://<host>/` |
| Memory limit | 96 MiB |

## Build

The Dockerfile is a multi-stage build:

1. `node` installs dependencies, patches the disposable build copy through
   `docker/frontend/configure.cjs`, and runs **`npx tsc --noEmit -p
   tsconfig.app.json`**. A type error fails the image build — this is
   deliberately a hard gate.
2. `vite build` produces the static bundle.
3. The final image installs `serve` and runs `serve -s dist -l 3000` as the
   `node` user. Nothing listens on port 80 inside this container; Envoy is the
   only ingress.

Because the typecheck runs in the builder, a TypeScript regression never reaches
a running container.

## Origin-relative API resolution

The bundle is built with `SUPABASE_API_URL` **empty by default**. The client then
derives the API base from `window.location.origin`. This is what allows the same
build to work on:

- `http://mypicu.miircic.hsj.rtss.qc.ca/` — the real hostname
- `http://localhost:8080/` — loopback
- any forwarded port

A hardcoded absolute URL would have broken two of those three.

## Session storage key

The storage key is derived from the hostname:

| Origin | Key |
|---|---|
| `mypicu.miircic.hsj.rtss.qc.ca` | `sb-mypicu-auth-token` |
| `localhost` / `127.0.0.1` | `sb-localhost-auth-token` |

This keeps the two origins from sharing or clobbering each other's session.

## Source layout

| Path | Purpose |
|---|---|
| `src/App.tsx` | route table (see below) |
| `src/pages/` | route components: `Dashboard`, `Optistate`, `Optibrain`, `AutoregStudy`, `Feedback`, `admin/ImportPatientData`, `auth/*` |
| `src/components/VitalSignsPanel.tsx` | Latest vitals, `—` for unmeasured |
| `src/services/patientFileData.service.ts` | Series, validity, label mappings |
| `src/services/patientAutoregulation.service.ts` | Reads stored autoregulation |
| `src/integrations/supabase/` | Typed REST client and generated types |

Routes, from `src/App.tsx`:

| Path | Page |
|---|---|
| `/` | dashboard and patient list |
| `/optistate` | organ state / indicator adherence |
| `/optibrain` | brain module |
| `/autoreg` | autoregulation study (file upload) |
| `/feedback`, `/admin/import` | feedback, admin import |
| `/optiheart`, `/optilungs`, `/optirenal`, `/optigastro` | redirect to `/optistate` |
| `/auth/login`, `/auth/signup`, `/auth/manager-signup`, `/auth/worker-signup`, `/auth/forgot-password`, `/auth/reset-password` | unauthenticated |
| `*` | 404 |

Everything except the `/auth/*` and redirect routes is wrapped in
`ProtectedRoute`, which sends unauthenticated visitors to `/auth/login`.

## Data-display rules

These are enforced in the components and are the reason the mock roster was
deleted:

- **No fallback numbers.** A missing channel renders `—`, never a plausible value.
- **No implied agreement.** Missing adherence returns `unknown`/null, never 100%.
- **No forced critical state.** A patient is only flagged critical on real values.
- **No narrative generation in the browser.** Clinical interpretation comes from
  Optibrain or is left blank.

`src/utils/patientData.ts`, which contained a hardcoded roster, has been removed.

## Autoregulation in the browser

The SPA **reads** `patient_autoregulation` and renders the stored curve. It does
not compute PRx or COx. `AutoregStudy` remains a TypeScript engine used only for
uploading and analysing study files offline — it is not on the live patient path.

The hardcoded allow-lists `AVAILABLE_AUTOREGULATION_PATIENTS` and
`NIRS_AUTOREGULATION_PATIENTS` were removed; results now come from the database.

## Rebuilding

```sh
sh scripts/stack.sh build web
sh scripts/stack.sh up -d web
```

Or force a clean build after a dependency change:

```sh
sh scripts/stack.sh build --no-cache web
```

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Image build fails on a type error | intentional hard gate | fix the TypeScript |
| Blank page, console 404 on assets | stale bundle | rebuild `web` |
| API calls hit the wrong host | `SUPABASE_API_URL` set at build time | rebuild with it empty |
| Session appears on the wrong origin | stale storage key | sign out, clear storage, sign in |

## Related

- {doc}`gateway` — how requests reach this container
- {doc}`../services/sync-worker` — where the displayed data originates