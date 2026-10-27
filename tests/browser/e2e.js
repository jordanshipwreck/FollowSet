const { chromium } = require('playwright');
const out = process.argv[2];
const ok = (c, m) => { if (!c) { console.log('FAIL', m); process.exitCode = 1; } else console.log('ok  ', m); };
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push('PAGEERR ' + e));
  p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('http://localhost:8766/', { waitUntil: 'networkidle' });
  await p.waitForTimeout(500);
  ok(await p.isVisible('text=Pull'), 'today shows #2 Pull');

  // Monday seed: review shows 27 sets
  await p.click('[data-testid=week-Mon]');
  ok((await p.textContent('[data-testid=hero]')).includes('27 sets'), 'Oct 26 seed shows 27 sets');
  await p.click('[data-testid=week-Tue]');

  await p.click('[data-testid=start-workout]');
  for (let i = 0; i < 3; i++) await p.click('[data-testid=skip]');
  await p.fill('[data-testid=weight]', '100');
  await p.click('[aria-label="More weight"]');
  ok((await p.inputValue('[data-testid=weight]')) === '105', 'stepper adds 5');
  await p.click('[data-testid=log-set]');
  ok(await p.isVisible('[data-testid=live-timer]'), 'rest overlay after logging');
  await p.click('[data-testid=skip-rest]');
  await p.fill('[data-testid=weight]', '40');
  await p.click('[data-testid=log-set]');
  await p.click('[data-testid=skip-rest]');

  // reload mid-run: runner restores at the same step with the clock running
  await p.reload({ waitUntil: 'networkidle' });
  await p.waitForTimeout(500);
  ok(await p.isVisible('[data-testid=runner]'), 'runner restored after reload');
  ok((await p.textContent('[data-testid=step-count]')).startsWith('6/'), 'same step after reload');
  ok((await p.inputValue('[data-testid=weight]')) === '105', 'weight prefilled from earlier set');

  // pause / resume
  await p.click('[data-testid=pause]');
  ok(await p.isVisible('[data-testid=paused]'), 'paused overlay');
  await p.click('text=Resume');

  // end workout
  await p.click('[data-testid=run-menu]');
  await p.click('[data-testid=confirm-end]');
  await p.waitForTimeout(400);
  ok(await p.isVisible('[data-testid=session-done]'), 'summary opens after end');
  await p.screenshot({ path: out + '/e-summary.png' });
  await p.fill('[data-testid=pump-lats]', '9');
  await p.click('[aria-label=Close]');
  ok((await p.textContent('[data-testid=hero]')).includes('2 sets'), 'hero shows done with 2 sets');

  // History edit
  await p.click('[data-testid=tab-progress]'); await p.click('.pilltabs >> text=History');
  await p.click('[data-testid=history-row] >> nth=0 >> .hist-head');
  await p.click('.set-chip >> nth=0');
  await p.fill('[data-testid=edit-reps]', '11');
  await p.click('text=Save');
  ok((await p.textContent('[data-testid=history-row] >> nth=0')).includes('105×11'), 'history edit saved');

  // Progress shows the rating
  await p.click('.pilltabs >> text=Progress');
  ok((await p.textContent('.mgrades')).includes('lats'), 'progress lists rated muscle');

  // Run again then discard restores the old logs
  await p.click('[data-testid=tab-today]');
  await p.click('text=Run it again');
  await p.click('[data-testid=run-menu]');
  await p.click('[data-testid=discard-workout]');
  await p.click('[data-testid=confirm-discard]');
  await p.waitForTimeout(300);
  ok((await p.textContent('[data-testid=hero]')).includes('2 sets'), 'discard keeps earlier logs');

  // next week navigation: program repeats
  await p.click('[aria-label="Next week"]');
  ok((await p.textContent('.week-label')).includes('Nov 2'), 'next week label');
  ok((await p.textContent('[data-testid=workout-title]')).startsWith('Pull'), 'program repeats next week');
  ok(await p.isDisabled('[data-testid=start-workout]'), 'future day cannot start');

  // offline: SW should serve the shell on the second load
  await p.waitForTimeout(1500);
  const sw = await p.evaluate(async () => !!(await navigator.serviceWorker.getRegistration()));
  ok(sw, 'service worker registered');
  await p.reload({ waitUntil: 'networkidle' });
  await p.waitForTimeout(800);
  await ctx.setOffline(true);
  await p.reload();
  await p.waitForTimeout(1500);
  ok(await p.isVisible('[data-testid=hero]'), 'app opens offline');
  await p.screenshot({ path: out + '/e-offline.png' });
  console.log(errs.filter((e) => !/ERR_INTERNET_DISCONNECTED|Failed to load resource/.test(e)).join('\n') || 'no console errors');
  await b.close();
})();
