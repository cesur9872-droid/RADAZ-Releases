// Start the development server on 5180 and tests/records-browser.mjs first.
// PLAYWRIGHT_MODULE may point to an existing Playwright installation.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ headless: true, channel: process.env.BROWSER_CHANNEL || 'msedge' });
const page = await browser.newPage();
// Built-preview QA can reuse the isolated API fixture without touching a real archive.
if (process.env.RADAZ_FIXTURE_URL) await page.route('**/local-archive-api/**', async route => {
  const request = route.request(), url = new URL(request.url());
  const response = await page.request.fetch(`${process.env.RADAZ_FIXTURE_URL}${url.pathname}${url.search}`, {
    method: request.method(), data: request.postData() || undefined,
  });
  await route.fulfill({ response });
});
const sizes = process.env.RADAZ_SMOKE ? [[853,480]] : [[1920,1080],[1366,680],[1280,650],[1024,650],[910,512],[853,480],[800,600],[640,480],[390,844]];
const errors = [];
page.on('pageerror', error => errors.push(error.message));
mkdirSync('outputs/responsive', { recursive: true });

async function checkHeader(route, width, height) {
  const result = await page.evaluate(() => {
    const header = document.querySelector('main>header');
    const h = header.getBoundingClientRect();
    const clipped = [...header.querySelectorAll('button,a,input,select,summary')].filter(element => {
      if (element.closest('details:not([open])') && !element.closest('summary')) return false;
      const r = element.getBoundingClientRect();
      if (!r.width || !r.height || getComputedStyle(element).visibility === 'hidden') return false;
      return r.left < -1 || r.right > innerWidth + 1 || r.top < h.top - 1 || r.bottom > h.bottom + 1;
    }).map(element => element.getAttribute('aria-label') || element.title || element.textContent);
    return { clipped, headerOverflow: header.scrollWidth > header.clientWidth + 1,
      pageOverflow: document.documentElement.scrollWidth > innerWidth + 1,
      footerBottom: document.querySelector('.records-status')?.getBoundingClientRect().bottom,
      archiveRows: [...document.querySelectorAll('.records-upper,.records-lower')].map(e => e.getBoundingClientRect().height) };
  });
  assert.deepEqual(result.clipped, [], `${route} ${width}x${height}: clipped controls`);
  assert.equal(result.headerOverflow, false, `${route} ${width}: header overflow`);
  assert.equal(result.pageOverflow, false, `${route} ${width}: page overflow`);
  if (route === '/archive' || route === '/pacs') {
    assert.ok(Math.abs(result.footerBottom - height) <= 1, `Status row must meet viewport bottom at ${route} ${width}: ${result.footerBottom}`);
  }
  {
    const help = page.getByRole('button', { name: 'Yardım və lisenziya', exact: true });
    assert.equal(await help.isVisible(), true, 'Help must exist and stay visible');
    const box = await help.boundingBox();
    assert.ok(box.y >= 0 && box.y + box.height <= height && box.x + box.width <= width);
  }
  if (route === '/archive') {
    assert.ok(result.archiveRows.every(value => value >= 65), `Archive rows collapsed at ${width}`);
  }
}

try {
  await page.request.get(`${process.env.RADAZ_FIXTURE_URL || process.env.RADAZ_TEST_URL || 'http://localhost:5186'}/test-reset`);
  for (const route of ['/', '/archive', '/pacs', '/mpr', '/3d']) {
    await page.goto(`${process.env.RADAZ_TEST_URL || 'http://localhost:5186'}${route}`);
    await page.locator('main>header').waitFor();
    if (route === '/archive') await page.getByRole('cell').filter({ hasText: 'Z SINAQ' }).first().waitFor();
    for (const [width, height] of sizes) {
      await page.setViewportSize({ width, height });
      await checkHeader(route, width, height);
      if ([1024, 853, 390].includes(width)) await page.screenshot({ path: `outputs/responsive/${route.replaceAll('/', '') || 'viewer'}-${width}.png` });
      if (route === '/archive') {
        await page.getByRole('button', { name: 'Qəbul ayarları', exact: true }).click();
        const dialog = page.getByRole('dialog', { name: 'Qəbul ayarları', exact: true });
        await dialog.waitFor();
        const bounds = await dialog.boundingBox();
        assert.ok(bounds.x >= 0 && bounds.y >= 0 && bounds.x + bounds.width <= width + 1 && bounds.y + bounds.height <= height + 1, 'Dialog must fit viewport');
        const footer = await dialog.getByRole('button', { name: 'Bağla', exact: true }).boundingBox();
        assert.ok(footer.y >= 0 && footer.y + footer.height <= height, 'Close button must stay visible');
        const port = dialog.getByRole('spinbutton', { name: 'Lokal arxiv DICOM port' });
        await port.fill('104');
        await dialog.getByRole('button', { name: 'Saxla və qəbulu başlat' }).click();
        await page.waitForFunction(() => document.querySelector('.receiver-destination dd strong:last-child') && document.querySelector('.receiver-summary')?.textContent.includes('Port: 104'));
        assert.equal(await dialog.locator('.receiver-destination dd').nth(2).innerText(), '104');
        if ([853, 390].includes(width)) await page.screenshot({ path: `outputs/responsive/receiver-${width}.png` });
        await port.fill('11113');
        await dialog.getByRole('button', { name: 'Saxla və qəbulu başlat' }).click();
        await dialog.getByText('CR-də 104 yazılıbsa, onu 11113 edin.', { exact: false }).waitFor();
        await dialog.getByRole('button', { name: 'Bağla', exact: true }).click();
      }
    }
    console.log(`${route}: ${sizes.length} viewport sizes passed`);
  }
  assert.deepEqual(errors, [], 'No browser runtime errors');
} finally { await browser.close(); }
