---
title: Gateway
---

# Gateway (Envoy)

The single ingress point. Everything a browser reaches passes through here.

```{contents}
:local:
:depth: 2
```

## Identity

| | |
|---|---|
| Compose service | `envoy` |
| Image | `envoyproxy/envoy:v1.39.1` |
| Internal port | 8000 |
| Published | `80:8000` (all interfaces), `127.0.0.1:8080:8000` |
| Memory limit | 96 MiB |

## Configuration pipeline

Envoy does not mount `docker/envoy/envoy.yaml` directly. The template contains
`${ANON_KEY}` and `${SERVICE_ROLE_KEY}` placeholders, which would leak secrets
into the file.

```
docker/envoy/envoy.yaml  (template, tracked in git)
        │
        │  gateway-init  →  python render_gateway.py
        ▼
envoy-config volume  /generated/envoy.yaml
        │
        │  mounted read-only at /etc/envoy
        ▼
envoy  -c /etc/envoy/envoy.yaml
```

`gateway-init` is a one-shot container that must exit successfully before Envoy
starts. If `gateway-init` fails, Envoy never launches — by design.

## Routing table

Order matters: the first match wins.

| Match | Destination | Rewrite | Timeout |
|---|---|---|---|
| `/health` | direct 200 `healthy` | — | — |
| `/documentation*` | `docs` | none (prefix preserved) | 30 s |
| `/auth/v1/` | `auth` | `/` | 30 s |
| `/rest/v1/` | `rest` | `/` | 60 s |
| `/realtime/v1/websocket` | `realtime` | `/socket/websocket` | none |
| `/realtime/v1/` (anything else) | direct 404 | — | — |
| `/` | `web` | none | 30 s |

Notes:

- `/realtime/v1/websocket` gets `host_rewrite_literal: realtime-dev.supabase-realtime`
  and zero timeouts — long-lived sockets would otherwise be killed.
- `/documentation` is served with **no prefix rewrite**, so the Sphinx theme's
  relative asset paths keep resolving. See {doc}`documentation`.

## The apikey gate

An inline Lua filter rejects unauthorised API requests before they reach
PostgREST.

```
path matches /rest/v1/, /realtime/v1/ or /auth/v1/ ?
   │
   ├─ exempt:  /auth/v1/verify, /auth/v1/callback, /auth/v1/health
   │
   └─ key = header "apikey"  OR  ?apikey= query parameter
          │
          ├─ key != ANON_KEY and key != SERVICE_ROLE_KEY ──▶ 401 "Invalid API key"
          │
          └─ matches
                ├─ realtime → replace x-api-key with the key
                └─ otherwise, if no Authorization header
                     → add authorization: Bearer <key>
```

This is defence in depth. The real authorisation of *data* is Postgres row-level
security, keyed on the user JWT — see {doc}`database`.

## Access logging

Query strings are stripped from the log line:

```
[%START_TIME%] %REQ(:METHOD)% %REQ_WITHOUT_QUERY(:PATH)% %RESPONSE_CODE% ...
```

This matters because query strings here carry `apikey` values and patient
identifiers. Only paths are recorded.

## Changing the configuration

```sh
# edit docker/envoy/envoy.yaml
sh scripts/stack.sh up -d --force-recreate gateway-init envoy
sh scripts/stack.sh logs envoy --tail 20
```

Check that the generated file rendered correctly:

```sh
sh scripts/stack.sh exec -T envoy cat /etc/envoy/envoy.yaml | grep -c 'ANON_KEY'
# expect 0 -- all placeholders must be substituted
```

If that count is non-zero, `render_gateway.py` failed and the key would be
served in place of the real value.

## Publishing on port 80

```yaml
ports:
  - "80:8000"
  - "127.0.0.1:8080:8000"
```

The second binding is retained for local work. Port 80 is published on all
interfaces so the workstation can reach the app by hostname; loopback is not
reachable from a browser once the page is opened by name.

`dockerd` runs privileged, so publishing port 80 succeeds even though the
invoking user is not root. If your Docker installation is **rootless**, this
binding will fail — see {doc}`../deployment` § Port 80.

## Related

- {doc}`authentication` — what the gate does not cover
- {doc}`documentation` — the `/documentation` route
- {doc}`../architecture` — full network schematic