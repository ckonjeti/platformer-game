// Quick visual check: boot, screenshot title, start a game, screenshot gameplay.
import { chromium } from '@playwright/test';

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
});
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
page.on('console', (m) => console.log('[console]', m.type(), m.text()));
page.on('pageerror', (e) => console.log('[pageerror]', e.message));

await page.goto('http://localhost:5173');
await page.waitForTimeout(1200);
await page.screenshot({ path: '/tmp/shots/01-title.png' });

// Title -> chapter select -> chapter card -> gameplay
await page.keyboard.press('KeyZ');
await page.waitForTimeout(400);
await page.screenshot({ path: '/tmp/shots/02-select.png' });
await page.keyboard.press('KeyZ');
await page.waitForTimeout(800);
await page.screenshot({ path: '/tmp/shots/03-card.png' });
await page.keyboard.press('KeyZ');
await page.waitForTimeout(600);
await page.screenshot({ path: '/tmp/shots/04-gameplay.png' });

// Walk right and jump
await page.keyboard.down('ArrowRight');
await page.waitForTimeout(900);
await page.keyboard.press('KeyZ');
await page.waitForTimeout(400);
await page.screenshot({ path: '/tmp/shots/05-jump.png' });
await page.keyboard.up('ArrowRight');

const state = await page.evaluate(() => JSON.stringify(globalThis.__game ? {
  screen: globalThis.__game.screen,
  player: globalThis.__game.player,
  deaths: globalThis.__game.deaths,
} : null));
console.log('STATE', state);

await browser.close();
