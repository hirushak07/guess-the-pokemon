import { expect, test } from '@playwright/test';
import { POKEMON } from '../src/pokemon';

// Original two-frame red/blue GIF fixture; no third-party assets in tests.
const gif = Buffer.from([
  ...Buffer.from('GIF89a'), 1,0,1,0,128,0,0, 255,0,0, 0,0,255,
  ...[0x21,0xf9,4,0,10,0,0,0, 0x2c,0,0,0,0,1,0,1,0,0,2,2,0x44,1,0],
  ...[0x21,0xf9,4,0,10,0,0,0, 0x2c,0,0,0,0,1,0,1,0,0,2,2,0x4c,1,0], 0x3b,
]);

test.beforeEach(async ({ page }) => {
  await page.route('**/*.gif', route => route.fulfill({ contentType: 'image/gif', body: gif }));
  await page.goto('/');
});

test('loading and intro preserve the full timer; GIF keeps moving and pixelation progresses', async ({ page }) => {
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/*.gif', async route => { await gate; await route.fulfill({ contentType: 'image/gif', body: gif }); });
  await page.evaluate(() => {
    const original = CanvasRenderingContext2D.prototype.drawImage;
    (window as any).sampleSizes = [];
    CanvasRenderingContext2D.prototype.drawImage = function (...args: any[]) {
      if (this.canvas.width !== 220) (window as any).sampleSizes.push(this.canvas.width);
      return (original as any).apply(this, args);
    } as typeof original;
  });
  await page.getByRole('button', { name: /START REGULAR/ }).click();
  await expect(page.getByRole('status')).toHaveText('LOADING POKÉMON...');
  await expect(page.getByRole('button', { name: 'SKIP INTRO' })).toBeDisabled();
  await page.waitForTimeout(1100);
  await expect(page.locator('.status')).toContainText('10s');
  release();
  await expect(page.locator('.spawn-running')).toBeVisible();
  await page.waitForTimeout(700);
  await expect(page.locator('.status')).toContainText('10s');
  await expect(page.locator('.choice')).toHaveCount(0);
  await expect(page.locator('.choice')).toHaveCount(4);
  const frames = await page.locator('canvas').evaluate(async canvas => {
    const samples = new Set<string>();
    for (let i = 0; i < 12; i++) {
      samples.add((canvas as HTMLCanvasElement).toDataURL());
      await new Promise(resolve => setTimeout(resolve, 30));
    }
    return samples.size;
  });
  expect(frames).toBeGreaterThan(1);
  await page.waitForTimeout(1500);
  const sizes = await page.evaluate(() => (window as any).sampleSizes as number[]);
  expect(sizes).toContain(8);
  expect(Math.max(...sizes)).toBeGreaterThan(8);
});

test('skip intro, five rounds, results, replay, and remembered mute', async ({ page }) => {
  await page.getByRole('button', { name: 'Sound effects' }).click();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Sound effects' })).toHaveAttribute('aria-pressed', 'false');
  await page.getByRole('button', { name: /START REGULAR/ }).click();
  for (let round = 0; round < 5; round++) {
    await page.getByRole('button', { name: 'SKIP INTRO' }).click();
    await expect(page.locator('.status')).toContainText('10s');
    await page.locator('.choice').first().click();
    await expect(page.locator('.reveal-panel')).toBeVisible();
    await page.getByRole('button', { name: round === 4 ? /VIEW RESULTS/ : /NEXT ROUND/ }).click();
  }
  await expect(page.locator('.result-list > div')).toHaveCount(5);
  await page.getByRole('button', { name: /PLAY AGAIN/ }).click();
  await expect(page.locator('.spawn-effect')).toBeVisible();
});

test('hard mode focuses after reduced-motion intro and wrong guesses remain playable', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.getByRole('button', { name: /HARD TYPE/ }).click();
  await page.getByRole('button', { name: /START HARD/ }).click();
  await expect(page.getByLabel('YOUR GUESS')).toBeFocused();
  await page.getByLabel('YOUR GUESS').fill('not-a-pokemon');
  await page.getByRole('button', { name: 'GUESS ▶', exact: true }).click();
  await expect(page.getByText('Not quite! Try again.')).toBeVisible();
  await expect(page.getByLabel('YOUR GUESS')).toBeFocused();
  await expect(page.locator('.reveal-panel')).toBeVisible({ timeout: 12000 });
});

test('mobile layout fits and unavailable GIFs reach the static fallback', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route('**/*.gif', route => route.fulfill({ status: 404 }));
  await page.route('**/*.png', route => route.abort());
  await page.getByRole('button', { name: /START REGULAR/ }).click();
  await expect(page.getByRole('button', { name: 'SKIP INTRO' })).toBeEnabled();
  await page.getByRole('button', { name: 'SKIP INTRO' }).click();
  await expect(page.locator('.choice')).toHaveCount(4);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('original audio starts after interaction, mute stops it, and correct guesses score once', async ({ page }) => {
  let id = 0;
  await page.route('**/*.gif', route => {
    id = Number(route.request().url().match(/(\d+)\.gif/)![1]);
    return route.fulfill({ contentType: 'image/gif', body: gif });
  });
  await page.evaluate(() => {
    (window as any).sounds = { started: 0, stopped: 0 };
    const create = AudioContext.prototype.createOscillator;
    AudioContext.prototype.createOscillator = function () {
      const oscillator = create.call(this);
      const start = oscillator.start.bind(oscillator);
      const stop = oscillator.stop.bind(oscillator);
      oscillator.start = time => { (window as any).sounds.started++; start(time); };
      oscillator.stop = time => { (window as any).sounds.stopped++; stop(time); };
      return oscillator;
    };
  });
  await expect.poll(() => page.evaluate(() => (window as any).sounds.started)).toBe(0);
  await page.getByRole('button', { name: /START REGULAR/ }).click();
  await expect.poll(() => page.evaluate(() => (window as any).sounds.started)).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Sound effects' }).click();
  const starts = await page.evaluate(() => (window as any).sounds.started);
  await expect(page.locator('.choice')).toHaveCount(4);
  expect(await page.evaluate(() => (window as any).sounds.started)).toBe(starts);
  await page.getByRole('button', { name: 'Sound effects' }).click();
  await page.locator('.choice').filter({ hasText: POKEMON.find(p => p.id === id)!.name }).click();
  await expect(page.locator('.reveal-panel')).toContainText('+3 POINTS');
  await expect(page.locator('.status')).toContainText('SCORE 03');
  expect(await page.evaluate(() => (window as any).sounds.started)).toBeGreaterThan(starts);
});

test('PNG fallback stays on the pixelation canvas and unavailable audio is harmless', async ({ page }) => {
  const png = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 32;
    canvas.getContext('2d')!.fillRect(0, 0, 32, 32);
    return canvas.toDataURL().split(',')[1];
  });
  await page.route('**/*.gif', route => route.fulfill({ status: 404 }));
  await page.route('**/*.png', route => route.fulfill({ contentType: 'image/png', body: Buffer.from(png, 'base64') }));
  await page.evaluate(() => { (window as any).AudioContext = undefined; });
  await page.getByRole('button', { name: /START REGULAR/ }).click();
  await page.getByRole('button', { name: 'SKIP INTRO' }).click();
  await expect(page.getByRole('img', { name: 'Pixelated mystery Pokémon' })).toBeVisible();
  await expect(page.locator('.sprite-error')).toHaveCount(0);
  await page.locator('.choice').first().click();
  await expect(page.locator('.reveal-panel')).toBeVisible();
});
