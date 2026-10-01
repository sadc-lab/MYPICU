// Counts DOM mutations the app produces (what extensions like Imprivata CE react to).
const { chromium } = require('playwright');
const BASE = 'http://localhost:8080';

const observe = page => page.evaluate(() => {
  window.__mut = 0;
  new MutationObserver(r => { window.__mut += r.length; })
    .observe(document, { subtree: true, childList: true, attributes: true, characterData: true });
});
const count = page => page.evaluate(() => window.__mut);

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(BASE + '/auth/login');
  await page.waitForTimeout(1500);
  await observe(page);
  await page.waitForTimeout(5000);
  console.log(`login page idle 5s: ${await count(page)} mutations`);

  await page.locator('#email').fill('manager@local.test');
  await page.locator('#password').fill(process.env.DEV_USER_PASSWORD);
  await page.getByRole('button', { name: 'Se connecter', exact: true }).click();
  await page.waitForURL(BASE + '/');
  await observe(page);
  await page.waitForTimeout(5000);
  console.log(`dashboard first 5s after login: ${await count(page)} mutations`);
  await observe(page);
  await page.waitForTimeout(5000);
  console.log(`dashboard idle 5s: ${await count(page)} mutations`);

  await observe(page);
  console.log('READY_FOR_BURST');
  await page.waitForTimeout(12000);
  const toasts = await page.locator('[data-sonner-toast]').count();
  console.log(`dashboard during realtime burst 12s: ${await count(page)} mutations, ${toasts} toasts visible`);
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
