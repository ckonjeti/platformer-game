// Warp through every screen of the current preview build and screenshot each.
import { chromium } from '@playwright/test';

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
});
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));

await page.goto('http://localhost:5173');
await page.waitForTimeout(600);
await page.evaluate(() => {
  localStorage.clear();
  localStorage.setItem(
    'lumen-save-v1',
    JSON.stringify({
      chapterUnlocked: 2,
      completedChapters: [1],
      reached: {},
      deaths: 0,
      motes: [],
      finished: false,
    }),
  );
});
await page.reload();
await page.waitForTimeout(800);

const state = () =>
  page.evaluate(() => globalThis.__game && { screen: globalThis.__game.screen, p: globalThis.__game.player });

async function enterChapter(stepsRight) {
  await page.keyboard.press('KeyZ'); // title → chapter select
  await page.waitForTimeout(700);
  for (let i = 0; i < stepsRight; i++) {
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(250);
  }
  await page.keyboard.press('KeyZ'); // chapter card
  await page.waitForTimeout(3400); // card is ~170 frames
}

async function shoot(id) {
  await page.evaluate((sid) => globalThis.__game.warp(sid), id);
  await page.waitForTimeout(400);
  await page.screenshot({ path: `/tmp/shots/screen-${id}.png` });
  console.log(id, JSON.stringify(await state()));
}

await enterChapter(0);
for (let i = 1; i <= 10; i++) await shoot(`1-${i}`);

// chapter 2 (preview: first two screens) with its own palette
await page.reload();
await page.waitForTimeout(800);
await enterChapter(1);
await shoot('2-1');
await shoot('2-2');

await browser.close();
console.log('done');
