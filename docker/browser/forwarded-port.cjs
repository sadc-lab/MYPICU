// The stack is reached through different addresses: the gateway port, a VS Code
// forwarded port, or a hostname. The browser client must call the API on the
// origin that served the page, so this proxies the gateway on a second port
// (mimicking a port forward) and asserts login and the patient list work.
const http = require('http');
const { chromium } = require('playwright');

const GATEWAY = { host: '127.0.0.1', port: 8080 };
const FORWARD_PORT = 8099;
const BASE = `http://localhost:${FORWARD_PORT}`;

const proxy = http.createServer((req, res) => {
  const up = http.request({ ...GATEWAY, path: req.url, method: req.method, headers: req.headers }, r => {
    res.writeHead(r.statusCode, r.headers);
    r.pipe(res);
  });
  up.on('error', e => { res.writeHead(502); res.end(String(e)); });
  req.pipe(up);
});
// Forward WebSocket upgrades too, like a real port forward does.
proxy.on('upgrade', (req, socket, head) => {
  const up = http.request({ ...GATEWAY, path: req.url, method: req.method, headers: req.headers });
  up.end();
  up.on('upgrade', (r, upSocket, upHead) => {
    const lines = Object.entries(r.headers).map(([k, v]) => `${k}: ${v}`);
    socket.write(`HTTP/1.1 101 Switching Protocols\r\n${lines.join('\r\n')}\r\n\r\n`);
    if (upHead?.length) socket.unshift(upHead);
    upSocket.pipe(socket).pipe(upSocket);
  });
  up.on('error', () => socket.destroy());
});

(async () => {
  await new Promise(r => proxy.listen(FORWARD_PORT, '127.0.0.1', r));

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors = [];
  const offOrigin = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => m.type() === 'error' && errors.push(m.text()));
  page.on('request', r => {
    const u = new URL(r.url());
    if (/^https?:/.test(r.url()) && u.port !== String(FORWARD_PORT)) offOrigin.push(r.url());
  });

  await page.goto(BASE + '/auth/login');
  await page.locator('#email').fill('manager@local.test');
  await page.locator('#password').fill(process.env.DEV_USER_PASSWORD);
  const census = page.waitForResponse(r => r.url().includes('/rest/v1/patients?') && r.status() === 200, { timeout: 20000 });
  await page.getByRole('button', { name: 'Se connecter', exact: true }).click();

  let ok = true;
  try {
    await page.waitForURL(BASE + '/', { timeout: 15000 });
  } catch {
    ok = false;
  }

  let rows = 0;
  if (ok) {
    try {
      rows = (await (await census).json()).length;
      await page.getByText('Liste des patients').waitFor({ timeout: 20000 });
    } catch {
      rows = 0;
    }
  }
  await browser.close();
  await new Promise(r => proxy.close(r));
  proxy.closeAllConnections?.();

  if (!ok || !rows || offOrigin.length || errors.length) {
    console.log(`FAIL: loggedIn=${ok} rows=${rows} offOrigin=${offOrigin.length} errors=${errors.length}`);
    if (offOrigin.length) console.log('  off-origin requests: ' + [...new Set(offOrigin)].slice(0, 5).join(', '));
    if (errors.length) console.log('  errors: ' + [...new Set(errors)].slice(0, 5).join(' | '));
    process.exit(1);
  }
  console.log(`PASS: login and ${rows}-row census over forwarded port ${FORWARD_PORT}; every request stayed on that origin`);
})().catch(e => { console.error(e); process.exit(1); });
