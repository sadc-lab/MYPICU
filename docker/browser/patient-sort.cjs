// Verifies the roster sort controls on the patient list: clicking the column
// NAME (not just the icon) must reorder the rows.
const { chromium, request } = require('playwright');
const assert = require('node:assert/strict');
const BASE = process.env.APP_BASE || 'http://localhost:8080';

// Bed labels in the database: "1".."6", "SIP.2".."SIP.33", and 25x "Sans lit".
// Displayed by formatBedLabel as "#01", "SIP.14", "Sans lit".
function bedNumber(text) {
  const m = String(text).match(/(\d+)/);
  return m ? Number(m[1]) : null;
}

const FIXTURES = [
  { id: '#990000001', name: 'ZZZ Fixture High', picu_id: 'SIP.7', pelod_score: 9, age: '5a', weight: '20kg', ward: 'pedA' },
  { id: '#990000002', name: 'ZZZ Fixture Low', picu_id: '3', pelod_score: 2, age: '6a', weight: '22kg', ward: 'pedA' },
  { id: '#990000003', name: 'ZZZ Fixture NoBed', picu_id: 'Sans lit', pelod_score: 5, age: '7a', weight: '24kg', ward: 'pedA' },
];

// Module scope so the failure path can clean up too: a thrown assertion must
// not leave fixtures in the clinical census.
let admin = null;
async function cleanup() {
  if (!admin) return;
  for (const f of FIXTURES) {
    await admin.delete('/rest/v1/patients?id=eq.' + encodeURIComponent(f.id)).catch(() => {});
  }
}

(async () => {
  // Live PELOD values are all NULL, so ordering by that column cannot be
  // observed without a fixture. Seed three rows with known, deliberately
  // non-alphabetical beds and distinct scores, then remove them afterwards.
  admin = await request.newContext({ baseURL: BASE, extraHTTPHeaders: {
    apikey: process.env.SERVICE_ROLE_KEY,
    Authorization: `Bearer ${process.env.SERVICE_ROLE_KEY}`,
  }});
  await cleanup();
  const seeded = await admin.post('/rest/v1/patients', { data: FIXTURES });
  assert.equal(seeded.status(), 201, `fixture insert failed: ${seeded.status()}`);
  console.log('seeded 3 fixtures: SIP.7(9), 3(2), Sans lit(5)');

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors = [];
  const offOrigin = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(String(e)));
  page.on('request', r => {
    const h = new URL(r.url()).hostname;
    if (h !== 'localhost' && h !== '127.0.0.1') offOrigin.push(r.url());
  });

  await page.goto(`${BASE}/auth/login`, { waitUntil: 'domcontentloaded' });
  await page.locator('#email').fill('manager@local.test');
  await page.locator('#password').fill(process.env.DEV_USER_PASSWORD);
  await page.getByRole('button', { name: 'Se connecter', exact: true }).click();
  await page.waitForURL(`${BASE}/`, { timeout: 30000 });

  // The desktop table is md:block, so sort it at a wide viewport.
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  await page.getByText('Liste des patients').waitFor({ timeout: 20000 });

  // The desktop table is md:block; force a wide viewport.
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.waitForTimeout(500);

  const header = page.getByRole('button', { name: /Trier par #D PICU/i });
  await header.waitFor({ timeout: 15000 });
  console.log('found the #D PICU sort control');

  // aria-sort lives on the <th>, and the click target must be the label text.
  const readRows = () => page.$$eval('table tbody tr', rows =>
    rows.map(r => {
      const cells = [...r.querySelectorAll('td')];
      return {
        bed: cells[2]?.innerText?.trim() ?? '',
        pelod: cells[3]?.innerText?.trim() ?? '',
      };
    }));

  const assertBedsSorted = (beds, dir) => {
    const numbered = beds.map(bedNumber).filter(n => n !== null);
    for (let i = 1; i < numbered.length; i++) {
      const prev = numbered[i - 1], cur = numbered[i];
      if (dir === 'asc') assert.ok(prev <= cur, `expected ascending, got ${prev} then ${cur}`);
      else assert.ok(prev >= cur, `expected descending, got ${prev} then ${cur}`);
    }
    // Unassigned beds must be last in BOTH directions.
    const firstUnassigned = beds.findIndex(b => bedNumber(b) === null);
    if (firstUnassigned !== -1) {
      for (let i = firstUnassigned; i < beds.length; i++) {
        assert.equal(bedNumber(beds[i]), null,
          `unassigned bed "${beds[i]}" should be in the trailing block`);
      }
    }
  };

  const ariaSort = () => page.$eval('th[aria-sort]', el => el.getAttribute('aria-sort'));

  // --- baseline: source order ---
  const baseline = (await readRows()).map(r => r.bed);
  assert.ok(baseline.length > 1, 'expected several patient rows');
  console.log('rows:', baseline.length, '| sample:', baseline.slice(0, 4).join(', '));

  // --- click 1: ascending ---
  await header.click();
  await page.waitForTimeout(400);
  const asc = (await readRows()).map(r => r.bed);
  assert.notDeepEqual(asc, baseline, 'ascending click should change row order');
  assertBedsSorted(asc, 'asc');
  console.log('asc  :', asc.slice(0, 5).join(', '), '...', asc.slice(-2).join(', '));

  // --- click 2: descending ---
  await header.click();
  await page.waitForTimeout(400);
  const desc = (await readRows()).map(r => r.bed);
  assert.notDeepEqual(desc, asc, 'second click should reverse');
  assertBedsSorted(desc, 'desc');
  console.log('desc :', desc.slice(0, 5).join(', '), '...', desc.slice(-2).join(', '));

  // --- click 3: back to source order ---
  await header.click();
  await page.waitForTimeout(400);
  const reset = (await readRows()).map(r => r.bed);
  assert.deepEqual(reset, baseline, 'third click should restore the original order');
  console.log('reset: restored source order');

  // --- aria-sort reflects state ---
  await header.click();
  await page.waitForTimeout(300);
  const ascSort = await page.$eval('th[aria-sort="ascending"]', el => el.innerText.trim());
  assert.match(ascSort, /#D PICU/);
  await header.click();
  await page.waitForTimeout(300);
  const descSort = await page.$eval('th[aria-sort="descending"]', el => el.innerText.trim());
  assert.match(descSort, /#D PICU/);
  console.log('aria-sort toggles ascending/descending on the <th>');

  // --- PELOD sorts numerically, verified against the fixture ---
  const pelod = page.getByRole('button', { name: /Trier par PELOD/i });
  await pelod.waitFor({ timeout: 10000 });
  await pelod.click();
  await page.waitForTimeout(400);
  const readFixture = async () => {
    // Re-read the table and pair each fixture name with its two columns.
    const cells = await page.$$eval('table tbody tr', trs => trs.map(tr => {
      const tds = [...tr.querySelectorAll('td')];
      return {
        name: tds[0]?.querySelector('.font-medium')?.textContent?.trim() ?? '',
        bed: tds[2]?.innerText?.trim() ?? '',
        pelod: tds[3]?.innerText?.trim() ?? '',
      };
    }));
    // Keep the order the table actually rendered, which is the whole point.
    const names = new Set(FIXTURES.map(f => f.name));
    return cells.filter(c => names.has(c.name)).map(c => ({
      name: c.name, bed: c.bed, pelod: c.pelod,
    }));
  };

  let fixtures = await readFixture();
  const scoresAsc = fixtures.map(f => Number(f.pelod));
  assert.deepEqual(scoresAsc, [2, 5, 9], `PELOD ascending should be 2,5,9 -- got ${scoresAsc}`);
  console.log('PELOD asc :', fixtures.map(f => `${f.bed}(${f.pelod})`).join(' '));

  await pelod.click();
  await page.waitForTimeout(400);
  fixtures = await readFixture();
  const scoresDesc = fixtures.map(f => Number(f.pelod));
  assert.deepEqual(scoresDesc, [9, 5, 2], `PELOD descending should be 9,5,2 -- got ${scoresDesc}`);
  console.log('PELOD desc:', fixtures.map(f => `${f.bed}(${f.pelod})`).join(' '));

  // Back to bed sorting; the fixture beds prove numeric (not text) ordering:
  // "3" and "SIP.7" would order the other way under a naive string compare.
  await header.click();
  await page.waitForTimeout(400);
  fixtures = await readFixture();
  assert.deepEqual(fixtures.map(f => f.bed), ['#03', 'SIP.7', 'Sans lit'],
    `bed ascending should be #03, SIP.7, Sans lit -- got ${fixtures.map(f => f.bed)}`);
  console.log('bed asc   :', fixtures.map(f => f.bed).join(' '));

  await header.click();
  await page.waitForTimeout(400);
  fixtures = await readFixture();
  assert.deepEqual(fixtures.map(f => f.bed), ['SIP.7', '#03', 'Sans lit'],
    `bed descending should keep Sans lit last -- got ${fixtures.map(f => f.bed)}`);
  console.log('bed desc  :', fixtures.map(f => f.bed).join(' '));

  // --- the label text itself must be the click target ---
  const box = await page.getByRole('button', { name: /Trier par #D PICU/i }).boundingBox();
  assert.ok(box && box.width > 40, `header button should be a real target, got ${JSON.stringify(box)}`);
  console.log('header click target:', `${Math.round(box.width)}x${Math.round(box.height)}px`);

  // --- the mobile card layout must reflect the sort chosen on desktop ---
  // There is no sort control in the mobile layout (the table headers live in
  // the md:block branch), so the sort is set at desktop width and the order is
  // then confirmed to carry over.
  // From "bed desc" a click resets to unsorted, so two clicks are needed to be
  // back at ascending.
  await header.click();          // -> unsorted
  await page.waitForTimeout(250);
  await header.click();          // -> ascending
  await page.waitForTimeout(400);
  await page.setViewportSize({ width: 420, height: 900 });
  await page.waitForTimeout(600);

  const readMobileBeds = () => page.$$eval('[data-guide="patient-table-mobile"] > div',
    cards => cards.map(c => {
      const m = c.innerText.match(/(#\d+|SIP\.\d+|Sans lit)/);
      return m ? m[1] : '';
    }).filter(Boolean));

  const mobileAsc = await readMobileBeds();
  assert.ok(mobileAsc.length > 1, `expected mobile cards, got ${mobileAsc.length}`);
  assertBedsSorted(mobileAsc, 'asc');
  console.log('mobile asc :', mobileAsc.slice(0, 5).join(', '), '...', mobileAsc.slice(-2).join(', '));

  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.waitForTimeout(400);
  await header.click();          // descending
  await page.waitForTimeout(400);
  await page.setViewportSize({ width: 420, height: 900 });
  await page.waitForTimeout(600);
  const mobileDesc = await readMobileBeds();
  assertBedsSorted(mobileDesc, 'desc');
  console.log('mobile desc:', mobileDesc.slice(0, 5).join(', '), '...', mobileDesc.slice(-2).join(', '));

  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.waitForTimeout(400);

  assert.deepEqual(offOrigin, [], `off-origin requests: ${offOrigin.join(', ')}`);
  assert.deepEqual(errors, [], `runtime errors: ${errors.join(' | ')}`);
  console.log(`OK  ${offOrigin.length} off-origin, ${errors.length} runtime errors`);

  await browser.close();
  // Cleanup must run while the request context is still alive: disposing it
  // first leaves the fixtures behind in the census.
  await cleanup();
  await admin.dispose();
  const left = await request.newContext({ baseURL: BASE, extraHTTPHeaders: {
    apikey: process.env.SERVICE_ROLE_KEY,
  }}).then(c => c.get('/rest/v1/patients?name=like.ZZZ*Fixture*&select=id'))
    .then(r => r.json());
  assert.equal(left.length, 0, `fixtures were left behind: ${left.map(r => r.id).join(', ')}`);
  console.log('fixtures removed:', FIXTURES.length);
})().catch(async e => {
  console.error('FAIL', e.message);
  await cleanup();
  process.exit(1);
});