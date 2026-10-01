// Read-only live-data smoke check; no screenshots, payloads, or patient identifiers are logged.
const { chromium, request } = require('playwright');
const assert = require('node:assert/strict');
const BASE = 'http://localhost:8080';

(async () => {
  const api = await request.newContext({baseURL: BASE, extraHTTPHeaders: {apikey: process.env.ANON_KEY}});
  const browser = await chromium.launch({headless:true});
  try {
    const token = await api.post('/auth/v1/token?grant_type=password', {data: {
      email:'manager@local.test', password:process.env.DEV_USER_PASSWORD,
    }});
    assert.equal(token.status(), 200);
    const headers = {Authorization: 'Bearer ' + (await token.json()).access_token};
    const result = await api.get('/rest/v1/patient_vitals?select=patient_id&variable_key=eq.Variable_temperature&limit=1', {headers});
    assert.equal(result.status(), 200);
    const cached = await result.json();
    assert.ok(cached.length, 'No live temperature data is cached yet');
    const page = await browser.newPage();
    const errors = [], cloud = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('request', r => {if (new URL(r.url()).hostname.endsWith('.supabase.co')) cloud.push(true);});
    await page.goto(BASE+'/auth/login');
    await page.locator('#email').fill('manager@local.test');
    await page.locator('#password').fill(process.env.DEV_USER_PASSWORD);
    const census = page.waitForResponse(r => r.url().includes('/rest/v1/patients?') && r.status() === 200);
    await page.getByRole('button', {name:'Se connecter',exact:true}).click();
    await page.waitForURL(BASE+'/');
    const count = (await (await census).json()).length;
    assert.ok(count > 0, 'Live census is empty');
    const vitals = page.waitForResponse(r => r.url().includes('/rest/v1/patient_vitals?') && r.status() === 200);
    await page.goto(BASE+'/optibrain?patient='+encodeURIComponent(cached[0].patient_id));
    assert.ok((await (await vitals).json()).length > 0);
    await page.waitForTimeout(3000);
    assert.equal(errors.length, 0, 'Runtime errors while loading live data');
    assert.equal(cloud.length, 0, 'Unexpected cloud Supabase request');
    console.log(`PASS: browser displays live census (${count} rows) and loads cached Optibrain vitals without runtime errors or cloud Supabase calls`);
  } finally {
    await browser.close();
    await api.dispose();
  }
})().catch(e => {console.error(e.message); process.exit(1);});
