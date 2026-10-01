---
title: Documentation
---

# MYPICU Documentation

Welcome to the MYPICU documentation. This site is built directly from the
Markdown files in the `docs/` directory of the repository, so the published
documentation and the repository documentation are always the same content.

## Start here

```{toctree}
:maxdepth: 2
:caption: Overview
:hidden:

operations
architecture
deployment
backup-restore
optibrain-module
```

```{toctree}
:maxdepth: 2
:caption: Services
:hidden:

services/frontend
services/gateway
services/database
services/authentication
services/realtime
services/sync-worker
services/optibrain
services/documentation
services/observability
```

```{toctree}
:maxdepth: 2
:caption: Reference
:hidden:

reference/environment
reference/api
reference/tables
```

## Who this is for

**Clinical and technical staff** should start with {doc}`operations` for day-to-day
use, {doc}`deployment` to install the stack, and {doc}`backup-restore` if something
has gone wrong. Every page is reachable from the application itself at
`/documentation`.

**Developers** will find {doc}`architecture` for how the pieces fit together and the
per-service pages under **Services** for the implementation detail of each container.

## Conventions used throughout

| Convention | Meaning |
|---|---|
| `sh scripts/stack.sh <cmd>` | Run a command against the local stack |
| `mypicu-local-<service>-1` | A running container, named by the Compose project |
| `—` | The value is genuinely not measured; never a substitute number |
| `Non évalué` / `Non mesuré` | Rendered when a measurement is unavailable |

:::{danger}
The stack currently serves **plain HTTP** on port 80 with no host firewall. Do not
use it for clinical work until TLS is configured. See {doc}`deployment` § TLS.
:::