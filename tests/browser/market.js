const { chromium } = require('playwright');
const out = process.argv[2];
const ok = (c, m) => { console.log(c ? 'ok  ' : 'FAIL', m); if (!c) process.exitCode = 1; };
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const errs = [];
  p.on('pageerror', (e) => errs.push('PAGEERR ' + e));
  p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('http://localhost:8766/', { waitUntil: 'networkidle' });
  await p.waitForTimeout(600);
  ok((await p.textContent('[data-testid=program-chip]')).includes('Followset Original'), 'Today shows the Original program');
  // Discover
  await p.click('[data-testid=tab-discover]'); await p.waitForTimeout(500);
  ok(await p.isVisible('[data-testid=program-card]'), 'Discover lists programs');
  await p.screenshot({ path: out + '/x-discover.png' });
  await p.click('[data-testid=open-studio]'); await p.waitForTimeout(500);
  ok(await p.isVisible('[data-testid=studio]'), 'Studio opens from Discover');
  // profile
  await p.fill('[data-testid=me-name]', 'Coach Kay');
  await p.click('[data-testid=me-save]');
  // new program
  await p.click('[data-testid=new-program]'); await p.waitForTimeout(300);
  await p.fill('[data-testid=program-title]', 'Kay Upper Blast');
  await p.click('[data-testid=add-workout]');
  await p.fill('[data-testid=workout-name]', 'Upper A');
  await p.click('[data-testid=add-block-Superset]');
  await p.click('[data-testid=add-exercise]');
  await p.fill('[data-testid=vault-search]', 'lat pulldown');
  await p.click('[data-testid=vault-item] >> nth=0');
  await p.click('[data-testid=add-exercise]');
  await p.fill('[data-testid=vault-search]', 'flat db');
  await p.click('[data-testid=vault-item] >> nth=0');
  await p.click('[data-testid=add-exercise]');
  await p.fill('[data-testid=vault-search]', 'Landmine press');
  await p.click('[data-testid=custom-exercise]');
  ok((await p.locator('[data-testid=item]').count()) === 3, 'three exercises in the superset (2 vault + 1 custom)');
  await p.click('[data-testid=item] >> nth=0 >> .item-head');
  await p.fill('input[placeholder^="Slow on the way down"]', 'Squeeze at the bottom, slow up.');
  await p.screenshot({ path: out + '/x-editor.png', fullPage: true });
  await p.click('[data-testid=publish]');
  await p.waitForTimeout(200);
  ok((await p.textContent('[data-testid=editor]')).includes('Published'), 'program publishes');
  await p.click('[data-testid=try-program]'); await p.waitForTimeout(600);
  // Today is Tuesday in the container; the new program only has Monday → rest day. Go to Mon.
  // Tue has no logs → follows the new program (rest day). Mon keeps its logged Original session.
  await p.click('[data-testid=week-Tue]'); await p.waitForTimeout(300);
  ok((await p.textContent('[data-testid=program-chip]')).includes('Kay Upper Blast'), 'Today follows the new program on an unlogged day');
  ok(await p.isVisible('[data-testid=rest-day]'), 'new program has Tuesday as a rest day');
  await p.click('[data-testid=week-Mon]'); await p.waitForTimeout(300);
  ok((await p.textContent('[data-testid=program-chip]')).includes('Followset Original'), 'logged Monday keeps the program it was logged under');
  // add Tue workout via studio? Instead check Discover lists it with price/following
  await p.click('[data-testid=tab-discover]'); await p.waitForTimeout(400);
  ok((await p.textContent('[data-testid=discover]')).includes('Kay Upper Blast'), 'Discover lists the published program');
  // follow back the Original and run a workout with coach
  await p.click('[data-testid=program-card] >> nth=0'); await p.waitForTimeout(300);
  await p.click('[data-testid=follow]'); await p.waitForTimeout(400);
  ok((await p.textContent('[data-testid=program-chip]')).includes('Followset Original'), 'following the Original again');
  await p.click('[data-testid=week-Tue]'); await p.waitForTimeout(300);
  await p.click('[data-testid=start-workout]'); await p.waitForTimeout(400);
  for (let i = 0; i < 3; i++) await p.click('[data-testid=skip]');
  await p.click('[data-testid=run-coach]'); await p.waitForTimeout(300);
  await p.click('.chat .chip >> text=What weight?'); await p.waitForTimeout(300);
  const reply = await p.textContent('[data-testid=coach-reply] >> nth=-1');
  ok(/lat pulldown/i.test(reply), 'mid-set coach answers about the current lift: ' + reply.slice(0, 90));
  await p.screenshot({ path: out + '/x-runcoach.png' });
  await p.click('[aria-label=Close]');
  await p.click('[data-testid=minimize]');
  // Coach tab: food, labs, health import, ask
  await p.click('[data-testid=tab-coach]'); await p.waitForTimeout(400);
  await p.click('[data-testid=open-food]');
  await p.fill('[data-testid=food-name]', 'Chipotle bowl'); await p.fill('[data-testid=food-cal]', '520'); await p.fill('[data-testid=food-protein]', '44');
  await p.click('[data-testid=food-add]'); await p.click('[aria-label=Close]');
  await p.click('[data-testid=open-labs]');
  await p.fill('[data-testid=lab-name]', 'HDL'); await p.fill('[data-testid=lab-value]', '32'); await p.fill('[data-testid=lab-low]', '40');
  await p.click('[data-testid=lab-add]'); await p.click('[aria-label=Close]');
  const [fc] = await Promise.all([p.waitForEvent('filechooser'), p.click('[data-testid=import-health]')]);
  await fc.setFiles(require('path').join(__dirname, 'hae.json')); await p.waitForTimeout(400);
  ok((await p.textContent('[data-testid=coach]')).includes('181.6'), 'Health Auto Export import shows weight');
  await p.fill('[data-testid=coach-input]', 'How much protein is left today?'); await p.click('[data-testid=coach-send]'); await p.waitForTimeout(300);
  const r2 = await p.textContent('[data-testid=coach-reply] >> nth=-1');
  ok(/156 g protein to go/.test(r2), 'coach reads the food log: ' + r2.slice(0, 80));
  await p.fill('[data-testid=coach-input]', 'Any labs out of range?'); await p.click('[data-testid=coach-send]'); await p.waitForTimeout(300);
  ok(/HDL 32/.test(await p.textContent('[data-testid=coach-reply] >> nth=-1')), 'coach flags the low HDL');
  await p.fill('[data-testid=coach-input]', 'my knee hurts on leg extension'); await p.click('[data-testid=coach-send]'); await p.waitForTimeout(300);
  ok(/Stop the set/.test(await p.textContent('[data-testid=coach-reply] >> nth=-1')), 'coach handles pain safely');
  await p.screenshot({ path: out + '/x-coach.png' });
  // tablet + desktop
  for (const [w, h, n] of [[820, 1180, 'tablet'], [1440, 900, 'desktop']]) {
    await p.setViewportSize({ width: w, height: h });
    await p.click('[data-testid=tab-today]'); await p.waitForTimeout(700);
    await p.screenshot({ path: `${out}/x-${n}-today.png` });
    await p.click('[data-testid=tab-discover]'); await p.waitForTimeout(600);
    await p.screenshot({ path: `${out}/x-${n}-discover.png` });
    await p.click('[data-testid=tab-coach]'); await p.waitForTimeout(600);
    await p.screenshot({ path: `${out}/x-${n}-coach.png` });
  }
  await p.click('[data-testid=tab-today]'); await p.waitForTimeout(500);
  await p.click('[data-testid=start-workout]'); await p.waitForTimeout(800);
  await p.screenshot({ path: `${out}/x-desktop-run.png` });
  console.log(errs.join('\n') || 'no console errors');
  await b.close();
})();
