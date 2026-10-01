// Regression test for the SSO-extension deadlock: Imprivata CE injects a second
// copy of the app into the same browser context, so another client can hold the
// browser-wide `lock:sb-<host>-auth-token` Web Lock first (the storage key has no
// port, so every localhost origin shares it). Any auth call that waits for that
// lock stalls for lockAcquireTimeout before failing. The local build therefore
// runs auth without the browser lock; this test proves it: with the lock held by
// a competitor from document-start, the app must not queue behind it and login
// must still work.
const { chromium } = require('playwright');
const BASE = 'http://localhost:8080';
const LOCK = 'lock:sb-localhost-auth-token';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // A competitor client grabs the lock before any page script runs.
  await page.addInitScript(name => {
    navigator.locks.request(name, { mode: 'exclusive' }, () => new Promise(() => {}));
  }, LOCK);

  await page.goto(BASE + '/auth/login');
  await page.waitForTimeout(500);
  const state = await page.evaluate(() =>
    navigator.locks.query().then(s => ({ held: s.held.map(l => l.name), pending: s.pending.map(l => l.name) }))
  );
  if (!state.held.includes(LOCK)) throw new Error(`test setup failed: held=${state.held}`);
  if (state.pending.length) throw new Error(`app queued behind ${LOCK}: pending=${state.pending}`);

  const tokens = [];
  page.on('request', r => r.url().includes('/auth/v1/token') && tokens.push(r.url()));

  await page.locator('#email').fill('manager@local.test');
  await page.locator('#password').fill(process.env.DEV_USER_PASSWORD);
  const started = Date.now();
  await page.getByRole('button', { name: 'Se connecter', exact: true }).click();

  let ok = true;
  try {
    await page.waitForURL(BASE + '/', { timeout: 8000 });
  } catch {
    ok = false;
  }
  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  await browser.close();

  if (!ok || !tokens.length) {
    console.log(`FAIL: login blocked for ${seconds}s (${tokens.length} /token requests) with ${LOCK} held by another client`);
    process.exit(1);
  }
  console.log(`PASS: login in ${seconds}s without waiting for ${LOCK}`);
})().catch(e => { console.error(e); process.exit(1); });
