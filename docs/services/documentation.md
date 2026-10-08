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

`html_baseurl` records the prefix the site is mounted at; Sphinx uses it for the
`<link rel="canonical">` URL it writes on every page. It is **not** what makes
assets resolve — the theme emits `_static/...` links relative to the current
page (`../_static/` on nested pages), so the bundle resolves wherever the site
is mounted. Envoy forwards the path **without a prefix rewrite**, so
`/documentation/architecture.html` reaches nginx verbatim and maps to
`/usr/share/nginx/html/documentation/architecture.html`. A rewrite would produce
`//architecture.html` and break relative asset paths.

`archive/` is excluded — those files are superseded, and they should not be
reachable from the site.

## Nginx routing

`docker/docs/nginx.conf` is deliberately minimal:

```nginx
root /usr/share/nginx/html;    # parent dir: nginx appends the full request URI
add_header Cache-Control "no-store" always;

location /documentation/ { try_files $uri $uri/ $uri.html =404; }
location = /documentation { return 301 /documentation/; }
location /                 { return 301 /documentation/; }
location ~ /\.             { deny all; }
location ~* \.doctrees?$   { deny all; }
```

Note the `root`: it is the **parent** of the documentation directory, because
nginx appends the whole request path (`/documentation/x.html`) to `root`.

Three details worth knowing:

- **`Cache-Control: no-store`.** During an incident you need the *current*
  runbook, not a cached copy of the one that was accurate last week.
- **`.doctrees` and dotfiles denied.** Sphinx leaves build artefacts behind on
  some builds; they must not be served.
- **gzip** is on for text, CSS, JavaScript and SVG, with a 1 KiB floor.

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

Two authoring rules, both learned from diagrams that silently rendered as a
red *Syntax error in text* box:

- **No `;` inside sequence-diagram text.** Mermaid treats it as a statement
  terminator, so `Note over A: 19 indicators; failures…` breaks the diagram.
  Use a comma or start a new line. The `;` in an HTML entity counts too:
  `&mdash;` and `&lt;jwt&gt;` end on a semicolon, so write a literal `—` or
  plain words instead of entities in `sequenceDiagram` bodies. Entities are
  fine inside `flowchart` labels.
- **In a flowchart, `class` takes `class nodeId className`.** `class S,s`
  fails to parse — the comma-separated form is reserved for a node list
  (`class VAL,AUTO d`). `class S s` is the node/class pair.
```

Without a toctree entry — and without `orphan: true` to say the omission is
deliberate — Sphinx emits a warning, and with `-W` that fails the build, which
is intentional. A page nobody links to is a page nobody finds.

## Testing a change

```sh
# build only, no running container changed yet
sh scripts/stack.sh build docs

# replace the running container with the new image, then check it serves
sh scripts/stack.sh up -d docs
curl -sS -o /dev/null -w '%{http_code}\n' http://localhost/documentation/
curl -sS -o /dev/null -w '%{http_code}\n' \
  http://localhost/documentation/backup-restore.html
```

Do not call `docker compose -f docker/compose.local.yml build docs` directly:
compose evaluates the whole file first, and `services.db.environment` carries
`${POSTGRES_PASSWORD:?…}`, which aborts without `.env.stack.local`. The
`scripts/stack.sh` wrapper always passes `--env-file`.

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