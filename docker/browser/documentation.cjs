const { chromium } = require('playwright');
const assert = require('node:assert/strict');

const BASE = process.env.DOCS_BASE || 'http://localhost:8080';
// Requests may only target the origin under test. On the host that is
// localhost:8080; from inside the Compose network it is envoy:8000.
const ALLOWED = new URL(BASE).hostname;

(async () => {
  const browser = await chromium.launch({ headless: true });
  const offOrigin = [];
  const consoleErrors = [];
  const page = await browser.newPage();

  page.on('request', r => {
    const u = new URL(r.url());
    if (u.hostname !== ALLOWED && u.hostname !== 'localhost' && u.hostname !== '127.0.0.1') {
      offOrigin.push(r.url());
    }
  });
  page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });

  const resp = await page.goto(`${BASE}/documentation/`, { waitUntil: 'networkidle' });
  assert.equal(resp.status(), 200, 'index should return 200');
  console.log('index: 200');

  // The landing page must actually be Sphinx, not the SPA fallback.
  assert.match(await page.title(), /MYPICU/, 'index title should mention MYPICU');
  console.log('title:', await page.title());

  // Navigation must be reachable. The body toctrees are :hidden: by design,
  // so the sidebar is where the page tree is exposed.
  const navLinks = await page.evaluate(() =>
    [...document.querySelectorAll('.wy-nav-side a.reference.internal')]
      .map(a => a.getAttribute('href')));
  assert.ok(navLinks.length >= 10, `expected a populated sidebar, got ${navLinks.length}`);
  for (const required of ['operations.html', 'deployment.html', 'backup-restore.html',
                          'architecture.html', 'services/sync-worker.html']) {
    assert.ok(navLinks.includes(required), `sidebar is missing ${required}`);
  }
  console.log('sidebar nav links:', navLinks.length);

  // A diagram page: Mermaid must load from this origin and paint an <svg>.
  await page.goto(`${BASE}/documentation/architecture.html`, { waitUntil: 'networkidle' });
  const archSvg = await page.evaluate(() => document.querySelectorAll('.mermaid svg').length);
  assert.equal(archSvg, 5, `architecture should have 5 rendered diagrams, got ${archSvg}`);
  console.log('architecture diagrams rendered:', archSvg);

  // A nested page: relative asset paths must still resolve.
  await page.goto(`${BASE}/documentation/services/sync-worker.html`, { waitUntil: 'networkidle' });
  assert.equal((await page.title()).includes('Sync worker'), true);
  console.log('nested page ok:', await page.title());

  // Backup/restore is the recovery runbook; it must be reachable.
  for (const p of ['/documentation/backup-restore.html',
                   '/documentation/deployment.html',
                   '/documentation/optibrain-module.html',
                   '/documentation/reference/tables.html']) {
    const r = await page.goto(`${BASE}${p}`, { waitUntil: 'domcontentloaded' });
    assert.equal(r.status(), 200, `${p} should return 200`);
  }
  console.log('all key pages 200');

  assert.deepEqual(offOrigin, [], `requests left the origin: ${offOrigin.join(', ')}`);
  assert.deepEqual(consoleErrors, [], `console errors: ${consoleErrors.join(' | ')}`);

  console.log(`OK  ${offOrigin.length} off-origin requests, ${consoleErrors.length} console errors`);
  await browser.close();
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });