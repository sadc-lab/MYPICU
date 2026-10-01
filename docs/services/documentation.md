---
title: Documentation
---

# Documentation (`docs`)

The Sphinx site serving this page, mounted at `/documentation`.

```{contents}
:local:
:depth: 2
```

## Identity

| | |
|---|---|
| Compose service | `docs` |
| Reached via | Envoy `/documentation` → `http://<host>/documentation/` |
| Memory limit | 96 MiB |

**One source of truth.** The Markdown in `docs/` is both the repository
documentation and the published site. There is no second copy to drift.

## Build

`docker/docs/Dockerfile` is a two-stage build:

1. **builder** — `python:3.12-slim`, installs `docker/docs/requirements.txt`,
   copies `docs/`, runs `sphinx-build`.
2. **runtime** — `nginx:alpine` serving the output.

The build runs with **`-W --keep-going`**, so a broken cross-reference or a bad
toctree path **fails the image build**. Documentation that references a page
which does not exist will not ship.

```sh
sh scripts/stack.sh build docs
sh scripts/stack.sh up -d docs
```

## Configuration

`docs/conf.py` sets the parts that matter for serving behind a prefix:

```python
html_baseurl = "/documentation/"
exclude_patterns = ["archive/**", "**/README.md", "**/_build/**"]
```

`html_baseurl` is what makes `_static/` assets resolve absolutely. Envoy
forwards the path **without a prefix rewrite**, so `/documentation/architecture.html`
reaches nginx verbatim and maps to
`/usr/share/nginx/html/documentation/architecture.html`. A rewrite would produce
`//architecture.html` and break relative asset paths.

`archive/` is excluded — those files are superseded, and they should not be
reachable from the site.

## Nginx routing

`docker/docs/nginx.conf` is deliberately minimal:

```nginx
root /usr/share/nginx/html/documentation;

location /documentation/ { try_files $uri $uri/ $uri.html =404; }
location = /documentation { return 301 /documentation/; }
location /                 { return 301 /documentation/; }
location ~ /\.            { deny all; }
```

Two details worth knowing:

- **`Cache-Control: no-store`.** During an incident you need the *current*
  runbook, not a cached copy of the one that was accurate last week.
- **`.doctrees` and dotfiles denied.** Sphinx leaves build artefacts behind on
  some builds; they must not be served.

## Adding a page

1. Create the Markdown under `docs/`, with YAML front matter.
2. Add it to a toctree in `docs/index.md`.
3. Rebuild.

Front matter sets the title and, importantly, `orphan: true` for any page you
do **not** want in a toctree:

```markdown
---
title: My Page
---

# My Page
```

```{admonition} Diagrammatic content
:class: tip

`colon_fence` is enabled, so a directive is opened with a brace after the
backticks. A Mermaid diagram is written like this:

````{note}
Three backticks, then the directive name in braces. A **plain** ```` ```mermaid ````
fence does not work: the extension provides a *directive*, not a Pygments
lexer, so MyST must route the fence to it.
````

Mermaid renders in the browser, so the builder needs no Java, no `mmdc` and no
headless browser.
```

Without a toctree entry Sphinx emits a warning, and with `-W` that fails the
build — which is intentional. A page nobody links to is a page nobody finds.

## Testing a change

```sh
# build only, no container
docker compose --project-directory . -f docker/compose.local.yml build docs

# check it serves
curl -sS -o /dev/null -w '%{http_code}\n' http://localhost/documentation/
curl -sS -o /dev/null -w '%{http_code}\n' \
  http://localhost/documentation/backup-restore.html
```

A 404 here almost always means the page is in `archive/` or was never added to a
toctree.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Build fails, warning about a document | `-W` is on | fix the reference or add it to a toctree |
| 404 on a page | in `archive/`, or orphaned | remove `orphan: true`, add to toctree |
| Styles missing | `html_baseurl` changed | restore it to `/documentation/` |
| Mermaid diagrams blank | JS blocked | confirm `_static/` is loading |
| 301 loop | nginx `location` misconfigured | check the rewrite block |

## Related

- {doc}`../architecture` — where this service sits
- {doc}`../deployment` — the service is deployed with the rest of the stack