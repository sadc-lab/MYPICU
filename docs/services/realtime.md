---
title: Realtime
---

# Realtime

Push updates so an open page reflects new data without polling.

```{contents}
:local:
:depth: 2
```

## Identity

| | |
|---|---|
| Compose service | `realtime` |
| Image | `supabase/realtime:v2.134.10` |
| Port | 4000 (internal) |
| Reached via | Envoy `/realtime/v1/websocket` |
| Memory limit | 640 MiB |

## Routing

Only the WebSocket upgrade path is exposed:

| Request | Result |
|---|---|
| `/realtime/v1/websocket` | proxied to `realtime` `/socket/websocket` |
| `/realtime/v1/<anything else>` | **direct 404** from Envoy |

The websocket route carries `timeout: 0s` and `idle_timeout: 0s`; any other value
would close long-lived sockets on a timer. The `host_rewrite_literal` is
`realtime-dev.supabase-realtime`, the tenant name seeded by
`docker/db/realtime.sql`.

The Lua filter replaces `x-api-key` with the presented key on this path, since
the websocket handshake does not carry a normal `Authorization` header.

## Tenant

The stack runs a single tenant named `realtime-dev`, seeded by
`docker/db/realtime.sql` on first boot. Its `DB_ENC_KEY` is `supabaserealtime`
and `DNS_NODES` is `''`, which disables clustering — appropriate for one host.

:::{warning}
`docker/db/realtime.sql` only runs against an empty `db-data`. If realtime is
misconfigured after the first boot, the fix is to apply the file manually:

```sh
sh scripts/stack.sh exec -T db psql -U postgres -d postgres -f /migrations/99-realtime.sql
```
:::

## Health

The healthcheck authenticates with the anon key:

```
curl -sf -H "Authorization: Bearer $ANON_KEY" \
  http://localhost:4000/api/tenants/realtime-dev/health
```

If that returns 401, the tenant is missing or the key has drifted from
`JWT_SECRET`.

## What is actually subscribed

The v1 patient pages read patient data on navigation and on sync completion
rather than holding a live subscription to high-frequency vitals. Subscribing to
`patient_vitals` would push thousands of rows a second per patient. Realtime is
used for low-frequency change notification only.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Socket connects then closes | timeout applied | confirm the zero-timeout route is intact |
| 404 on `/realtime/v1/…` | not the websocket path | use the exact websocket URL |
| Healthcheck 401 | tenant missing or key drift | re-apply `realtime.sql`, check `JWT_SECRET` |
| No live updates in the page | by design | re-navigate to refresh |

## Related

- {doc}`gateway` — the websocket route
- {doc}`database` — the `_realtime` schema