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
  await page.route('https://fonts.googleapis.com/**', route => route.abort());
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
  await page.getByRole('button', { name: 'Music', exact: true }).click();
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
    const createSample = AudioContext.prototype.createBufferSource;
    AudioContext.prototype.createBufferSource = function () {
      const source = createSample.call(this);
      const start = source.start.bind(source);
      const stop = source.stop.bind(source);
      source.start = (...args) => { (window as any).sounds.started++; start(...args); };
      source.stop = (...args) => { (window as any).sounds.stopped++; stop(...args); };
      return source;
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
  await expect(page.locator('.reveal-panel')).toContainText(/\+[\d,]+ POINTS/);
  const awarded = (await page.locator('.reveal-panel p').innerText()).match(/[\d,]+/)![0];
  expect(Number(awarded.replaceAll(',', ''))).toBeGreaterThan(0);
  await expect(page.locator('.status')).toContainText(`SCORE ${awarded}`);
  expect(await page.evaluate(() => (window as any).sounds.started)).toBeGreaterThan(starts);
});

test('live points drain, submissions use exact elapsed time, and each round resets', async ({ page }) => {
  await page.clock.install();
  let id = 0;
  await page.route('**/*.gif', route => {
    id = Number(route.request().url().match(/(\d+)\.gif/)![1]);
    return route.fulfill({ contentType: 'image/gif', body: gif });
  });
  await page.getByRole('button', { name: /START REGULAR/ }).click();
  const bar = page.getByRole('progressbar', { name: 'Time remaining' });
  const points = page.locator('.timer-points b');
  const skipIntro = page.getByRole('button', { name: 'SKIP INTRO' });
  const next = page.getByRole('button', { name: /NEXT ROUND/ });
  const answer = () => page.getByRole('button', { name: POKEMON.find(p => p.id === id)!.name });
  await expect(skipIntro).toBeEnabled();
  await page.clock.pauseAt(new Date((await page.evaluate(() => Date.now())) + 200));
  await expect(bar).toHaveAttribute('aria-valuenow', '10');
  await expect(points).toHaveText('1,000');

  await skipIntro.dispatchEvent('click');
  await page.clock.runFor(1250);
  await expect(points).toHaveText('875');
  await answer().dispatchEvent('click');
  await expect(page.locator('.reveal-panel')).toContainText('+875 POINTS');

  await next.dispatchEvent('click');
  await expect(skipIntro).toBeEnabled();
  await expect(bar).toHaveAttribute('aria-valuenow', '10');
  await skipIntro.dispatchEvent('click');
  await page.clock.runFor(6750);
  await expect(points).toHaveText('325');
  await answer().dispatchEvent('click');
  await expect(page.locator('.reveal-panel')).toContainText('+325 POINTS');
  await expect(page.locator('.status')).toContainText('SCORE 1,200');

  await next.dispatchEvent('click');
  await expect(skipIntro).toBeEnabled();
  await skipIntro.dispatchEvent('click');
  // Move the submission clock beyond the deadline without running the interval.
  await answer().evaluate(button => {
    const now = performance.now.bind(performance);
    performance.now = () => now() + 10_001;
    (button as HTMLButtonElement).click();
  });
  await expect(page.locator('.reveal-panel')).toContainText('TIME UP');
  await expect(page.locator('.status')).toContainText('SCORE 1,200');
});

for (const viewport of [{ width: 320, height: 568 }, { width: 390, height: 844 }]) {
  test.describe(`touch at ${viewport.width}×${viewport.height}`, () => {
    test.use({ viewport, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });

    test('Regular choices fit and register a tap', async ({ page }) => {
      await page.getByRole('button', { name: /START REGULAR/ }).tap();
      const choices = page.locator('.choice');
      await expect(choices).toHaveCount(4);
      for (const choice of await choices.all()) {
        await expect(choice).toBeInViewport({ ratio: 1 });
        expect((await choice.boundingBox())!.height).toBeGreaterThanOrEqual(44);
        expect(await choice.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(viewport.width);
      await choices.first().tap();
      await expect(page.locator('.reveal-panel')).toBeVisible();
    });

    test('Hard waits for a typing tap, then supports keyboard submission and retry', async ({ page }) => {
      let id = 0;
      await page.route('**/*.gif', route => {
        id = Number(route.request().url().match(/(\d+)\.gif/)![1]);
        return route.fulfill({ contentType: 'image/gif', body: gif });
      });
      await page.getByRole('button', { name: /HARD TYPE/ }).tap();
      await page.getByRole('button', { name: /START HARD/ }).tap();
      const startTyping = page.getByRole('button', { name: /TAP TO TYPE/ });
      const input = page.getByRole('textbox', { name: 'YOUR GUESS' });
      await expect(startTyping).toBeVisible();
      await expect(input).toHaveCount(0);
      await page.waitForTimeout(1050);
      await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '10');
      await startTyping.tap();
      await expect(input).toBeFocused();
      await expect(input).toHaveAttribute('enterkeyhint', 'go');
      // Emulate a shorter viewport with the software keyboard open.
      await page.setViewportSize({ width: viewport.width, height: 350 });
      await expect(input).toBeInViewport({ ratio: 1 });
      await input.fill('not-a-pokemon');
      await input.press('Enter');
      await expect(page.getByText('Not quite! Try again.')).toBeVisible();
      await expect(input).toBeFocused();
      await expect(input).toHaveValue('');
      await input.fill(POKEMON.find(p => p.id === id)!.name);
      await input.press('Enter');
      await expect(page.locator('.reveal-panel')).toContainText('CORRECT ANSWER');
      await expect(input).toHaveCount(0);
      await page.setViewportSize(viewport);
      await page.getByRole('button', { name: /NEXT ROUND/ }).tap();
      await expect(startTyping).toBeVisible();
      await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '10');
    });
  });
}

test('music plays on home, through results and hidden tabs, and remembers mute', async ({ page }) => {
  await page.evaluate(() => {
    (window as any).musicNotes = 0;
    const create = AudioContext.prototype.createOscillator;
    AudioContext.prototype.createOscillator = function () {
      const voice = create.call(this);
      const start = voice.start.bind(voice);
      voice.start = time => { if (voice.type === 'square') (window as any).musicNotes++; start(time); };
      return voice;
    };
  });
  expect(await page.evaluate(() => (window as any).musicNotes)).toBe(0);
  await page.getByRole('heading', { level: 1 }).click();
  await expect.poll(() => page.evaluate(() => (window as any).musicNotes)).toBeGreaterThan(0);
  await expect(page.getByRole('button', { name: /START REGULAR/ })).toBeVisible();
  await page.getByRole('button', { name: 'Sound effects' }).click();
  await page.getByRole('button', { name: 'Music', exact: true }).click();
  const muted = await page.evaluate(() => (window as any).musicNotes);
  await page.waitForTimeout(600);
  expect(await page.evaluate(() => (window as any).musicNotes)).toBe(muted);
  await page.getByRole('button', { name: 'Music', exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as any).musicNotes)).toBeGreaterThan(muted);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  const hidden = await page.evaluate(() => (window as any).musicNotes);
  await expect.poll(() => page.evaluate(() => (window as any).musicNotes)).toBeGreaterThan(hidden);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.getByRole('button', { name: /START REGULAR/ }).click();
  for (let round = 0; round < 5; round++) {
    await page.getByRole('button', { name: 'SKIP INTRO' }).click();
    await page.getByRole('button', { name: 'SKIP →', exact: true }).click();
    await page.getByRole('button', { name: round === 4 ? /VIEW RESULTS/ : /NEXT ROUND/ }).click();
  }
  const resultsNotes = await page.evaluate(() => (window as any).musicNotes);
  await expect.poll(() => page.evaluate(() => (window as any).musicNotes)).toBeGreaterThan(resultsNotes);
  await page.getByRole('button', { name: /CHANGE MODE/ }).click();
  const homeNotes = await page.evaluate(() => (window as any).musicNotes);
  await expect.poll(() => page.evaluate(() => (window as any).musicNotes)).toBeGreaterThan(homeNotes);
  await page.getByRole('button', { name: 'Music', exact: true }).click();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Music', exact: true })).toHaveAttribute('aria-pressed', 'false');
});

test('Gen 3 throw leads the ball, release follows, and success uses the selected recording', async ({ page }) => {
  let id = 0;
  await page.route('**/*.gif', route => {
    id = Number(route.request().url().match(/(\d+)\.gif/)![1]);
    return route.fulfill({ contentType: 'image/gif', body: gif });
  });
  await page.evaluate(() => {
    (window as any).recordings = { decoded: 0, events: [], stops: 0 };
    const decode = AudioContext.prototype.decodeAudioData;
    AudioContext.prototype.decodeAudioData = function (...args: any[]) {
      const result = (decode as any).apply(this, args);
      result.then(() => { (window as any).recordings.decoded++; });
      return result;
    };
    const create = AudioContext.prototype.createBufferSource;
    AudioContext.prototype.createBufferSource = function () {
      const source = create.call(this);
      const start = source.start.bind(source);
      const stop = source.stop.bind(source);
      source.start = (...args) => {
        const ball = document.querySelector('.spawn-ball');
        (window as any).recordings.events.push({ duration: source.buffer?.duration, at: performance.now(), ballOpacity: ball ? getComputedStyle(ball).opacity : null });
        start(...args);
      };
      source.stop = (...args) => { (window as any).recordings.stops++; stop(...args); };
      return source;
    };
  });
  await page.getByRole('heading', { level: 1 }).click();
  await expect.poll(() => page.evaluate(() => (window as any).recordings.decoded)).toBe(3);
  await page.getByRole('button', { name: /START REGULAR/ }).click();
  await expect(page.locator('.choice')).toHaveCount(4);
  const events = await page.evaluate(() => (window as any).recordings.events);
  expect(events).toHaveLength(2);
  expect(events[0].ballOpacity).toBe('0');
  expect(events[0].duration).toBeCloseTo(.617, 1);
  expect(events[1].duration).toBeCloseTo(.604, 1);
  expect(events[1].at - events[0].at).toBeGreaterThan(650);
  expect(await page.evaluate(() => (window as any).recordings.stops)).toBe(0);
  await page.locator('.choice').filter({ hasText: POKEMON.find(p => p.id === id)!.name }).click();
  const success = await page.evaluate(() => (window as any).recordings.events[2]);
  expect(success.duration).toBeGreaterThan(.9);
  expect(success.duration).toBeLessThan(1.1);
  await page.getByRole('button', { name: /NEXT ROUND/ }).click();
  await expect.poll(() => page.evaluate(() => (window as any).recordings.events.length), { intervals: [25] }).toBe(5);
  const beforeMute = await page.evaluate(() => (window as any).recordings.stops);
  await page.getByRole('button', { name: 'Sound effects' }).click();
  expect(await page.evaluate(() => (window as any).recordings.stops)).toBe(beforeMute + 1);
  await expect(page.locator('.choice')).toHaveCount(4);
  await page.getByRole('button', { name: 'SKIP →', exact: true }).click();
  await page.getByRole('button', { name: 'Sound effects' }).click();
  await page.getByRole('button', { name: /NEXT ROUND/ }).click();
  await expect.poll(() => page.evaluate(() => (window as any).recordings.events.length), { intervals: [25] }).toBe(6);
  const beforeSkip = await page.evaluate(() => (window as any).recordings.stops);
  await page.getByRole('button', { name: 'SKIP INTRO' }).click();
  expect(await page.evaluate(() => (window as any).recordings.stops)).toBe(beforeSkip + 1);
  await page.waitForTimeout(900);
  expect(await page.evaluate(() => (window as any).recordings.events.length)).toBe(6);
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
