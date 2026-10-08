# syntax=docker/dockerfile:1
# Builds the MYPICU documentation from the repository's Markdown sources and
# serves it with nginx at /documentation. Build context is the repository root
# because the sources live in docs/ while the container config lives here.

FROM python:3.12-slim AS builder

WORKDIR /build

COPY docker/docs/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY docs ./docs

# Mermaid renders in the browser, but the default is to pull the library from a
# CDN. This host sits on an isolated hospital network with no egress, so the
# assets are vendored here and served from the site itself. Versions are pinned
# to match docs/conf.py.
ARG MERMAID_VERSION=11.4.1
ARG D3_VERSION=7.9.0
RUN python - <<'PY'
import os, urllib.request
base = "https://cdn.jsdelivr.net/npm"
assets = {
    # Self-contained IIFE bundle, loaded as a classic script by the wrapper
    # (the ESM entry point code-splits into sibling ./chunks/ files).
    "mermaid.min.js": f"{base}/mermaid@{os.environ['MERMAID_VERSION']}/dist/mermaid.min.js",
    "d3.min.js": f"{base}/d3@{os.environ['D3_VERSION']}/dist/d3.min.js",
}
os.makedirs("docs/_static", exist_ok=True)
for name, url in assets.items():
    with urllib.request.urlopen(url, timeout=180) as r:
        body = r.read()
    if len(body) < 100_000:
        raise SystemExit(f"suspiciously small asset ({len(body)}B): {name}")
    with open(os.path.join("docs/_static", name), "wb") as f:
        f.write(body)
    print(f"{name}: {len(body)} bytes")
PY

# Fail the image build on a broken cross-reference or bad toctree path.
RUN sphinx-build -b html -W --keep-going docs /out

FROM nginx:1.27-alpine

COPY --from=builder /out /usr/share/nginx/html/documentation
COPY docker/docs/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

# Probe the explicit IPv4 loopback: nginx binds 0.0.0.0 only, and "localhost"
# can resolve to ::1 first, which yields a misleading connection refusal.
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://127.0.0.1/documentation/ \
      || exit 1