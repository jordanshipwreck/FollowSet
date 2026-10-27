const { chromium } = require('playwright');
const out = process.argv[2];
(async () => {
  const b = await chromium.launch();
  const errs = [];
  for (const scheme of ['light', 'dark']) {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: scheme });
    const p = await ctx.newPage();
    p.on('pageerror', (e) => errs.push('PAGEERR ' + e));
    p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
    await p.goto('http://localhost:8766/', { waitUntil: 'networkidle' });
    await p.waitForTimeout(900);
    await p.screenshot({ path: `${out}/t-${scheme}-today.png` });
    await p.evaluate(() => window.scrollTo(0, 640)); await p.waitForTimeout(400);
    await p.screenshot({ path: `${out}/t-${scheme}-today2.png` });
    await p.evaluate(() => window.scrollTo(0, 0));
    await p.click('[data-testid=start-workout]');
    for (let i = 0; i < 3; i++) await p.click('[data-testid=skip]');
    await p.fill('[data-testid=weight]', '100'); await p.waitForTimeout(700);
    await p.screenshot({ path: `${out}/t-${scheme}-run.png` });
    await p.click('[data-testid=log-set]'); await p.waitForTimeout(1200);
    await p.screenshot({ path: `${out}/t-${scheme}-rest.png` });
    await p.click('[data-testid=skip-rest]');
    await p.click('[data-testid=run-menu]'); await p.click('[data-testid=confirm-end]'); await p.waitForTimeout(500);
    await p.fill('[data-testid=pump-lats]', '9'); await p.fill('[data-testid=pump-back]', '6');
    await p.screenshot({ path: `${out}/t-${scheme}-summary.png` });
    await p.click('[aria-label=Close]');
    for (const t of ['history', 'progress', 'me']) {
      if (t === 'history') { await p.click('[data-testid=tab-progress]'); await p.click('.pilltabs >> text=History'); }
      else { await p.click(`[data-testid=tab-${t}]`); if (t === 'progress') await p.click('.pilltabs >> text=Progress'); }
      await p.waitForTimeout(700);
      await p.screenshot({ path: `${out}/t-${scheme}-${t}.png` });
    }
    await ctx.close();
  }
  console.log(errs.join('\n') || 'no errors');
  await b.close();
})();
