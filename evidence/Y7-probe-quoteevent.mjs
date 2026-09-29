// evidence/Y7-probe-quoteevent.mjs — task Y7: measure the actual DOM
// keydown fields Playwright's keyboard.press sends on this Mac (the e2e
// suites rely on `press('Quote')` for İ; the Y7 letters change switches the
// US `KeyI` event from I to İ, so the exact field values matter for the
// "e2e unaffected" claim).
//
// Run (repo root; dev server must already listen on the URL):
//   node evidence/Y7-probe-quoteevent.mjs http://127.0.0.1:5433
//   (log: evidence/logs/Y7-playwright-key-probe.log)
import { chromium } from '@playwright/test';

const url = process.argv[2] ?? 'http://127.0.0.1:5433';
const browser = await chromium.launch({ args: ['--mute-audio'] });
const page = await browser.newPage();
await page.addInitScript(() => {
  window.__y7KeyEvents = [];
  document.addEventListener(
    'keydown',
    (event) => {
      window.__y7KeyEvents.push({
        key: event.key,
        code: event.code,
        keyCode: event.keyCode,
        which: event.which,
        location: event.location,
        repeat: event.repeat,
        ctrlKey: event.ctrlKey,
      });
    },
    true,
  );
});
await page.goto(url);
await page.waitForFunction(() => typeof window.__game !== 'undefined');
for (const name of ['Quote', 'KeyI', 'Space', 'Enter', 'Backspace']) {
  await page.keyboard.press(name);
}
const events = await page.evaluate(() => window.__y7KeyEvents);
console.log(`url: ${url}`);
console.log(`playwright: ${JSON.stringify(await page.context().browser()?.version?.() ?? null)}`);
for (const [index, event] of events.entries()) {
  console.log(`press #${index}: ${JSON.stringify(event)}`);
}
await browser.close();
