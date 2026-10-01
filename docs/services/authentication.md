---
title: Authentication
---

# Authentication (auth / GoTrue)

Session and identity management.

```{contents}
:local:
:depth: 2
```

## Identity

| | |
|---|---|
| Compose service | `auth` |
| Image | `supabase/gotrue:v2.196.0` |
| Port | 9999 (internal) |
| Reached via | Envoy `/auth/v1/` |
| Memory limit | 192 MiB |

## Configuration

| Variable | Value / purpose |
|---|---|
| `API_EXTERNAL_URL` | `${PUBLIC_URL}/auth/v1` — the URL clients are redirected to |
| `GOTRUE_SITE_URL` | `${PUBLIC_URL}` |
| `GOTRUE_URI_ALLOW_LIST` | `${PUBLIC_URL}/**` plus loopback, for email redirects |
| `GOTRUE_JWT_SECRET` | must equal the `JWT_SECRET` used by `rest` and `realtime` |
| `GOTRUE_JWT_AUD` | `authenticated` |
| `GOTRUE_JWT_EXP` | 3600 s |
| `GOTRUE_DISABLE_SIGNUP` | `false` — self-service signup is enabled |
| `GOTRUE_SMTP_HOST` | `mailpit` — all mail is captured locally |
| `GOTRUE_MAILER_AUTOCONFIRM` | `false` — confirmation required |

`PUBLIC_URL` drives every generated link. If it is wrong, confirmation emails
point somewhere unreachable. Mailpit on `127.0.0.1:8025` is where they land.

## Signup, confirmation, recovery

```{mermaid}
sequenceDiagram
    autonumber
    participant U as Clinician
    participant E as Envoy
    participant A as auth (GoTrue)
    participant M as mailpit
    participant P as db (auth.users)

    U->>E: POST /auth/v1/signup {email, password}
    E->>A: forward
    A->>P: insert auth.users
    A->>M: SMTP to <address>
    M-->>U: message in Mailpit inbox
    U->>A: GET /auth/v1/verify?token=...
    A->>P: confirm email
    A-->>U: session (access + refresh JWT)
    U->>P: queries carry the JWT; RLS applies user_wards
```

No real email is ever sent: SMTP points at Mailpit, which stores messages in
memory and exposes them at `http://127.0.0.1:8025`.

## The three keys

| Key | Holder | Purpose |
|---|---|---|
| `ANON_KEY` | browser bundle, Envoy template | unauthenticated PostgREST access, subject to RLS |
| `SERVICE_ROLE_KEY` | worker, Studio | bypasses RLS; treated as a credential |
| `SYNC_TOKEN` | worker → Optibrain, and Optibrain → worker | shared secret between the two services |

`services/local-env.py` generates all of these once and never overwrites an
existing installation. `ANON_KEY` and `SERVICE_ROLE_KEY` are HS256 JWTs signed
with `JWT_SECRET`, so they are structurally valid but only meaningful to this
deployment.

`JWT_SECRET` is shared by `auth`, `rest` and `realtime`. Changing it invalidates
every issued token, so users are signed out everywhere.

## Ward assignment

`user_wards` assigns each account to one or more wards. This is what RLS reads to
decide which patients a clinician may see. **A user with no ward assignment sees
no patients** — this is a configuration error that looks like a data outage.

```sh
sh scripts/stack.sh exec -T db psql -U postgres -d postgres -c "
  select u.email, w.ward from user_wards w
  join auth.users u on u.id = w.user_id order by u.email;"
```

To grant a ward:

```sql
insert into user_wards (user_id, ward)
select id, 'CHU' from auth.users where email = 'clinician@example.org'
on conflict do nothing;
```

## Creating the first user

Either self-serve through the app, or directly:

```sh
sh scripts/stack.sh exec -T db psql -U postgres -d postgres -c "
  create extension if not exists pgcrypto;
  select crypt('password', gen_salt('bf')) as bcrypt;"
```

then insert into `auth.users` following GoTrue's schema, or simpler — sign up via
the UI and read the confirmation link out of Mailpit.

## Common problems

| Symptom | Cause | Fix |
|---|---|---|
| No confirmation email | `PUBLIC_URL` wrong | correct it, recreate `auth` |
| 401 on every request | `JWT_SECRET` differs between `auth` and `rest` | make them identical |
| Logged in but no patients | no ward assigned | insert into `user_wards` |
| Redirect loop after verification | hostname missing from `GOTRUE_URI_ALLOW_LIST` | add the pattern, recreate `auth` |
| Session lost on the other origin | expected — different storage key | sign in on each origin |

## Related

- {doc}`gateway` — the apikey gate in front of this service
- {doc}`database` — RLS, which is what actually restricts data
- {doc}`../reference/environment` — every variable this service reads