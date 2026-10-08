// Mermaid ships two browser builds: an ESM entry point that code-splits into
// sibling ./chunks/ files, and a self-contained bundle. Vendoring the ESM
// entry into Sphinx's _static directory breaks it, because the chunk imports
// are relative and the chunks are not published alongside.
//
// sphinxcontrib-mermaid always emits `import mermaid from "<url>"`, so the file
// it is pointed at must be a real ES module. The bundle itself, however, is an
// esbuild IIFE whose closing line is
//     globalThis.mermaid = globalThis.__esbuild_esm_mermaid.default;
// and that only works when the file runs as a *classic* script: evaluated as a
// module, its top-level `var __esbuild_esm_mermaid` stays module-scoped, the
// last line throws "Cannot read properties of undefined (reading 'default')",
// and globalThis.mermaid is never set. Diagrams used to appear anyway because
// the bundle's own auto-start had already painted them -- which also meant the
// `startOnLoad:false` that the emitted `mermaid.initialize(...)` asks for was
// silently ignored.
//
// So load the bundle as a classic script. Top-level await delays the default
// export until the global exists, so every consumer gets a working object.
//
// The asset is downloaded at image build time by docker/docs/Dockerfile; it is
// not committed here.
await new Promise((resolve, reject) => {
  const script = document.createElement('script');
  script.src = new URL('./mermaid.min.js', import.meta.url).href;
  script.onload = resolve;
  script.onerror = () => reject(new Error('mermaid.min.js failed to load'));
  document.head.appendChild(script);
});

const mermaid = globalThis.mermaid;

// sphinxcontrib-mermaid emits `window.addEventListener("load", () => mermaid.run())`.
// That listener is registered by a module that waits on this one, so if the load
// event has already fired by the time the graph resolves the diagrams would never
// be painted -- especially now that startOnLoad:false actually takes effect. Run
// ourselves when that happens; mermaid.run() skips already-processed elements.
if (document.readyState === 'complete') mermaid.run();

export default mermaid;
