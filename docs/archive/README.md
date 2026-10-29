# Archived documentation

These files describe the deployment model that existed **before** the local
Docker stack rewrite. They are kept for historical reference only and are
**excluded from the published site** (`exclude_patterns` in `docs/conf.py`).

## Do not follow these documents

| Document | Superseded because |
|---|---|
| `ARCHITECTURE.pre-local-stack.md` | describes a cloud/Supabase-provisioned topology with no Optibrain module, no sync worker and no gateway |
| `DOCKER_DEPLOYMENT.pre-local-stack.md` | targets `docker-compose.dev.yml`, which described a bare `app` service with hardcoded `VITE_SUPABASE_URL` values |
| `BACKEND_INTEGRATION.pre-local-stack.md` | predates the batched ICCA extraction, the validity tables and autoregulation |

All three were last touched in **November–December 2025** and mention none of
the concepts the system has since gained: `sync-worker`, `patient_validity`,
`patient_autoregulation`, Envoy, or RLS scoping by ward.

## Current documentation

| Looking for | Read |
|---|---|
| Installing the stack | [`docs/deployment.md`](../deployment.md) |
| Recovering after a crash | [`docs/backup-restore.md`](../backup-restore.md) |
| How it fits together | [`docs/architecture.md`](../architecture.md) |
| Day-to-day running | [`docs/operations.md`](../operations.md) |
| Each container | [`docs/services/`](../services/) |

The historical versions are in git history if you need them:

```sh
git log --oneline --follow -- docs/archive/ARCHITECTURE.pre-local-stack.md
```