// Mermaid ships two browser builds: an ESM entry point that code-splits into
// sibling ./chunks/ files, and a self-contained UMD bundle. Vendoring the ESM
// entry into Sphinx's _static directory breaks it, because the chunk imports
// are relative and the chunks are not published alongside.
//
// sphinxcontrib-mermaid always emits `import mermaid from "<url>"`, so the file
// it is pointed at must be a real ES module. This wrapper imports the
// self-contained UMD build -- which defines the global -- and re-exports it.
//
// The asset is downloaded at image build time by docker/docs/Dockerfile; it is
// not committed here.
import "./mermaid.min.js";

export default globalThis.mermaid;