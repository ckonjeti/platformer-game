import { chromium } from '@playwright/test';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
await page.goto('http://localhost:5173');
await page.waitForTimeout(800);
await page.evaluate(() => localStorage.clear());
await page.reload();
await page.waitForTimeout(800);
for (const _ of [1,2,3]) { await page.keyboard.press('KeyZ'); await page.waitForTimeout(700); }
await page.evaluate(() => globalThis.__game.warp('1-2'));
await page.waitForTimeout(200);
await page.keyboard.down('ArrowRight');
await page.waitForTimeout(300);
await page.screenshot({ path: '/tmp/shots/e0-beacon.png' });
// run until completion fade
await page.waitForTimeout(3200);
await page.keyboard.up('ArrowRight');
await page.screenshot({ path: '/tmp/shots/e1-fade.png' });
await page.waitForTimeout(6000);
await page.screenshot({ path: '/tmp/shots/e2-ending.png' });
await browser.close();
