project = "MYPICU"
author = "MYPICU"
copyright = "Centre hospitalier de Sainte-Justine"

extensions = [
    "myst_parser",
    "sphinxcontrib.mermaid",
    "sphinx_copybutton",
]

myst_enable_extensions = [
    "colon_fence",
    "deflist",
    "fieldlist",
    "substitution",
    "tasklist",
]

source_suffix = {".md": "markdown", ".rst": "restructuredtext"}
master_doc = "index"
root_doc = "index"
language = "fr"

# Mounted behind Envoy at /documentation/ -- absolute asset URLs keep the
# generated _static/ bundle resolvable regardless of the serving sub-path.
html_baseurl = "/documentation/"

exclude_patterns = [
    "archive/**",
    "**/README.md",
    "**/_build/**",
]

html_theme = "sphinx_rtd_theme"
html_title = "MYPICU -- Documentation"
# The diagram assets are downloaded at image build time and served from
# _static. They must NOT come from a CDN: the host is an isolated hospital
# network with no internet egress, so a CDN diagram would silently fail to
# render in exactly the environment that needs the documentation most.
html_static_path = ["_static"]
# The wrapper re-exports the vendored UMD build as an ES module; see
# docs/_static/mermaid-esm-wrapper.js. The elk layout is disabled: it is an
# optional alternative to the default layout, and vendoring it would pull in
# another code-split bundle for no benefit.
mermaid_use_local = "/documentation/_static/mermaid-esm-wrapper.js"
mermaid_elk_use_local = ""
mermaid_include_elk = ""
d3_use_local = "/documentation/_static/d3.min.js"
html_show_sourcelink = False
html_last_updated_fmt = "%Y-%m-%d"

# Diagrams are emitted raw and rendered in the browser, so no Java, mmdc or
# headless browser is needed inside the builder.
mermaid_output_format = "raw"
mermaid_version = "11.4.1"
d3_version = "7.9.0"

nitpicky = False
suppress_warnings = ["myst.header"]