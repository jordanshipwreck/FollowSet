const { chromium } = require('playwright');
const out = process.argv[2];
const ok = (c, m) => console.log(c ? 'ok  ' : 'FAIL', m);
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await p.goto('http://localhost:8766/', { waitUntil: 'networkidle' });
  await p.waitForTimeout(800);
  // nav pill slides: sample transform mid-flight
  const pillX = () => p.evaluate(() => new DOMMatrix(getComputedStyle(document.querySelector('.nav-pill')).transform).m41);
  const x0 = await pillX();
  await p.click('[data-testid=tab-progress]');
  await p.waitForTimeout(90);
  const xMid = await pillX();
  await p.screenshot({ path: out + '/m-nav-mid.png', clip: { x: 0, y: 740, width: 390, height: 104 } });
  await p.waitForTimeout(900);
  const xEnd = await pillX();
  ok(xMid > x0 && xMid !== xEnd, `nav pill slides (${x0.toFixed(0)} → ${xMid.toFixed(0)} → ${xEnd.toFixed(0)})`);
  // week pill slides
  await p.click('[data-testid=tab-today]'); await p.waitForTimeout(700);
  const wX = () => p.evaluate(() => new DOMMatrix(getComputedStyle(document.querySelector('.week-pill')).transform).m41);
  const w0 = await wX();
  await p.click('[data-testid=week-Sat]'); await p.waitForTimeout(80);
  const wMid = await wX(); await p.waitForTimeout(800); const wEnd = await wX();
  ok(wMid > w0 && wMid < wEnd, `week pill slides (${w0.toFixed(0)} → ${wMid.toFixed(0)} → ${wEnd.toFixed(0)})`);
  // sheet swipe-down closes
  await p.click('[data-testid=week-Mon]'); await p.waitForTimeout(500);
  await p.click('[data-testid=review]'); await p.waitForTimeout(700);
  const head = await p.locator('.sheet-drag').boundingBox();
  await p.mouse.move(head.x + 60, head.y + 20); await p.mouse.down();
  for (let i = 1; i <= 10; i++) { await p.mouse.move(head.x + 60, head.y + 20 + i * 25); await p.waitForTimeout(16); }
  await p.screenshot({ path: out + '/m-sheet-drag.png' });
  await p.mouse.up(); await p.waitForTimeout(500);
  ok(!(await p.isVisible('.sheet')), 'sheet closes on swipe down');
  // small drag springs back
  await p.click('[data-testid=review]'); await p.waitForTimeout(700);
  const h2 = await p.locator('.sheet-drag').boundingBox();
  await p.mouse.move(h2.x + 60, h2.y + 20); await p.mouse.down();
  for (let i = 1; i <= 4; i++) { await p.mouse.move(h2.x + 60, h2.y + 20 + i * 10); await p.waitForTimeout(40); }
  await p.mouse.up(); await p.waitForTimeout(500);
  ok(await p.isVisible('.sheet'), 'short drag springs back open');
  await p.click('[aria-label=Close]'); await p.waitForTimeout(300);
  // workout: prefill uses last weight, suggestion button offered; stepper bump; step transition
  await p.click('[data-testid=week-Tue]'); await p.waitForTimeout(400);
  await p.click('[data-testid=start-workout]');
  for (let i = 0; i < 3; i++) await p.click('[data-testid=skip]');
  await p.click('[aria-label="More reps"]');
  const bump = await p.getAttribute('.stepper-val >> nth=1', 'data-bump');
  ok(bump === 'up1', `reps bump animates (data-bump=${bump})`);
  await p.click('[data-testid=log-set]'); await p.waitForTimeout(150);
  await p.screenshot({ path: out + '/m-rest-pop.png' });
  await p.click('[data-testid=skip-rest]'); await p.waitForTimeout(60);
  const op = await p.evaluate(() => getComputedStyle(document.querySelector('.run-body')).opacity);
  ok(Number(op) < 1, `next step eases in (opacity mid-flight ${Number(op).toFixed(2)})`);
  await b.close();
})();
