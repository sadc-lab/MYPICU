// Run in the Playwright container, with only temporary local DB fixtures.
const { chromium, request } = require('playwright');
const assert = require('node:assert/strict');
const BASE = 'http://localhost:8080';
const id = '#999900001';

(async () => {
  const admin = await request.newContext({baseURL: BASE, extraHTTPHeaders: {
    apikey: process.env.SERVICE_ROLE_KEY, Authorization: `Bearer ${process.env.SERVICE_ROLE_KEY}`,
  }});
  const browser = await chromium.launch({headless: true});
  const page = await browser.newPage();
  const external = [], errors = [];
  page.on('request', r => {if (new URL(r.url()).hostname.endsWith('.supabase.co')) external.push(r.url());});
  page.on('pageerror', e => errors.push(e.message));
  try {
    await page.goto(BASE + '/auth/login');
    await page.locator('#email').fill('manager@local.test');
    await page.locator('#password').fill(process.env.DEV_USER_PASSWORD);
    await page.getByRole('button', {name: 'Se connecter', exact: true}).click();
    await page.waitForURL(BASE + '/');
    await page.waitForTimeout(1000);
    // No database demos means no invented rows from the static fallback.
    assert.equal(await page.getByText('John Doe (M)', {exact:true}).count(), 0);
    const created = await admin.post('/rest/v1/patients', {data: {
      id, name: 'STACK TEST ONLY', age:'2y 0m 0d', weight:'12 kg', picu_id:'TEST', ward:'pedA', diagnosis:'',
    }});
    assert.equal(created.status(), 201);
    const rows = Array.from({length:145}, (_, i) => ({patient_id:id, variable_key:'Variable_PIC',
      charttime:new Date(Date.now()-(144-i)*600000).toISOString(), valeur:12+i%5}));
    const seeded = await admin.post('/rest/v1/patient_vitals', {data:rows});
    assert.equal(seeded.status(), 201);
    const loaded = page.waitForResponse(r => r.url().includes('/rest/v1/patient_vitals?') && r.url().includes('999900001') && r.status() === 200);
    await page.goto(BASE + '/optibrain?patient=' + encodeURIComponent(id));
    await loaded;
    await page.getByText('STACK TEST ONLY', {exact:false}).first().waitFor();
    await page.waitForTimeout(1500);
    assert.deepEqual(external, [], 'Browser called cloud Supabase');
    assert.deepEqual(errors, [], 'Browser runtime error');
    console.log('PASS: browser login, empty census without demo fallback, live-ID Optibrain data loading, no cloud Supabase calls or runtime errors');
  } finally {
    await browser.close();
    const cleanup = await admin.delete('/rest/v1/patients?id=eq.' + encodeURIComponent(id));
    assert.equal(cleanup.status(), 204, 'Fixture cleanup failed');
    await admin.dispose();
  }
})().catch(e => {console.error(e); process.exit(1);});
