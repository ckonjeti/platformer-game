// Scripted keyboard playthrough of the 2-screen preview: title → 1-1 → 1-2 → finale.
import { chromium } from '@playwright/test';

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
});
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));

const state = () => page.evaluate(() => globalThis.__game && {
  screen: globalThis.__game.screen,
  x: globalThis.__game.player.x,
  y: globalThis.__game.player.y,
  deaths: globalThis.__game.deaths,
});

await page.goto('http://localhost:5173');
await page.waitForTimeout(800);
// localStorage may hold progress from earlier runs; clear and reload for determinism
await page.evaluate(() => localStorage.clear());
await page.reload();
await page.waitForTimeout(800);

for (const _ of [1, 2, 3]) {
  await page.keyboard.press('KeyZ');
  await page.waitForTimeout(700);
}
console.log('start:', await state());

// Helper: hold right, jumping whenever player.x enters one of the given windows
async function runRight(jumpAt, untilScreen, timeoutMs = 20000) {
  await page.keyboard.down('ArrowRight');
  const deadline = Date.now() + timeoutMs;
  const pending = [...jumpAt];
  while (Date.now() < deadline) {
    const s = await state();
    if (!s) break;
    if (s.screen === untilScreen) break;
    if (pending.length && s.x >= pending[0]) {
      pending.shift();
      await page.keyboard.down('KeyZ');
      await page.waitForTimeout(260);
      await page.keyboard.up('KeyZ');
    }
    await page.waitForTimeout(30);
  }
  await page.keyboard.up('ArrowRight');
  return state();
}

// 1-1: jump up the step around x=200
let s = await runRight([196], '1-2');
console.log('after 1-1:', s);
await page.screenshot({ path: '/tmp/shots/p1-screen2.png' });

// 1-2: jump the two pits (pit 1 at x=96-135, pit 2 at x=192-239)
s = await runRight([84, 180], 'DONE');
console.log('after 1-2 run:', s);

// Walk to the beacon at col 36 (x≈288) — runRight stops when screen changes; check completion
await page.waitForTimeout(500);
await page.screenshot({ path: '/tmp/shots/p2-finale.png' });
await page.waitForTimeout(2500);
await page.screenshot({ path: '/tmp/shots/p3-after-complete.png' });

console.log('final:', await state());
await browser.close();
