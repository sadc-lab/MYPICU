const fs = require('fs');
const path = 'src/integrations/supabase/client.ts';
let source = fs.readFileSync(path, 'utf8');

// The stack serves the SPA and the API (auth/rest/realtime) from one origin, but
// the app is reached through whatever address the developer uses: the gateway
// port, a VS Code forwarded port, or a hostname. Hardcoding one of them sends
// every API call from the browser to that address on the *browser's* machine,
// where nothing is listening, and the login request hangs. supabase-js rejects
// relative URLs, so resolve the API origin from the page at runtime instead.
// SUPABASE_API_URL overrides this when the API is deliberately on another host.
const apiUrl = (process.env.SUPABASE_API_URL || '').trim();
if (!process.env.ANON_KEY) throw new Error('Missing build configuration for SUPABASE_PUBLISHABLE_KEY');
for (const [name, value] of Object.entries({
  // Raw JavaScript expressions, not string literals.
  SUPABASE_URL: apiUrl ? JSON.stringify(apiUrl) : 'window.location.origin',
  SUPABASE_PUBLISHABLE_KEY: JSON.stringify(process.env.ANON_KEY),
})) {
  const pattern = new RegExp(`const ${name} = "[^"]+";`, 'g');
  if ((source.match(pattern) || []).length !== 1) throw new Error(`Expected one ${name} declaration`);
  source = source.replace(pattern, `const ${name} = ${value};`);
}
// The hospital SSO extension (Imprivata CE) injects a second copy of this page
// into the same browser context, so supabase-js' browser-wide
// `lock:sb-<host>-auth-token` Web Lock is held by a client this tab cannot see.
// Every auth call (including initialize) waits on it and never sends a request:
// the login button stays disabled and nothing reaches GoTrue. Opt out of the
// browser lock; the lock only guards cross-tab token-refresh races, and this
// local stack is single-user.
const lockAnchor = '    autoRefreshToken: true,';
if ((source.match(/autoRefreshToken: true,/g) || []).length !== 1)
  throw new Error('Expected one autoRefreshToken declaration');
source = source.replace(
  lockAnchor,
  `${lockAnchor}
    lock: <R,>(_name: string, _acquireTimeout: number, fn: () => Promise<R>) => fn(),`
);

fs.writeFileSync(path, source);
