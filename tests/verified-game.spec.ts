import { expect, test, type Page } from '@playwright/test';

type Action = { p_action: string; p_mode?: string; p_round?: number; p_guess?: string };

async function mockVerifiedGame(page: Page, profileStatus = 'saved') {
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('test-initialized')) {
      sessionStorage.setItem('test-initialized', 'yes');
      sessionStorage.setItem('test-signed-in', 'yes');
    }
  });
  await page.route('https://fonts.googleapis.com/**', route => route.abort());
  await page.route('https://raw.githubusercontent.com/**', route => route.abort());
  const profileSyncs: { p_username: string | null }[] = [];
  await page.route('https://example.supabase.co/rest/v1/rpc/sync_profile', route => {
    expect(route.request().headers().authorization).toBe('Bearer test-session-token');
    profileSyncs.push(route.request().postDataJSON());
    return route.fulfill({ json: { status: profileStatus, username: profileStatus === 'saved' ? 'trainer' : null } });
  });

  const requests: Action[] = [];
  let mode: string | undefined;
  let round = 1;
  let deadline: string | null = null;
  let outcome: string | null = null;
  let points: number | null = null;
  let score = 0;
  const results: { round: number; answer: string; outcome: string; points: number }[] = [];
  let failOnce = false;
  await page.route('https://example.supabase.co/rest/v1/rpc/play_verified_game', async route => {
    expect(route.request().headers().authorization).toBe('Bearer test-session-token');
    const request = route.request().postDataJSON() as Action;
    requests.push(request);
    if (request.p_action === 'start') mode ??= request.p_mode;
    if (request.p_action === 'open') deadline ??= new Date(Date.now() + 10_000).toISOString();
    if (request.p_action === 'next' && request.p_round === round) {
      round++;
      deadline = outcome = points = null;
    }
    const wrongHard = mode === 'hard' && request.p_action === 'guess' && request.p_guess !== 'Pikachu';
    if (!outcome && !wrongHard && ['guess', 'skip', 'status'].includes(request.p_action)) {
      outcome = request.p_action === 'guess' ? 'correct' : request.p_action === 'skip' ? 'skipped' : 'timeout';
      points = outcome === 'correct' ? 413 : 0;
      score += points;
      results.push({ round, answer: 'Pikachu', outcome, points });
    }
    if (failOnce && request.p_action === 'guess') {
      failOnce = false;
      await route.abort();
      return;
    }
    await route.fulfill({ json: {
      runId: 'test-run', mode, round, deadline, serverTime: new Date().toISOString(),
      spriteId: deadline ? 25 : null,
      choices: deadline && mode === 'regular' ? [25, 26, 1, 4] : null,
      outcome, roundPoints: points, score, answer: outcome ? 'Pikachu' : null,
      correctCount: results.filter(result => result.outcome === 'correct').length,
      feedback: wrongHard ? 'try_again' : null, completed: results.length === 5,
      results: results.length === 5 ? results : null,
    } });
  });
  await page.goto('/');
  return { requests, profileSyncs, failNextGuess: () => { failOnce = true; } };
}

test('Regular uses server points, retries a lost response and displays five saved rounds', async ({ page }) => {
  const mock = await mockVerifiedGame(page);
  await page.getByRole('button', { name: /START REGULAR/ }).click();
  for (let round = 1; round <= 5; round++) {
    await page.getByRole('button', { name: /START ROUND/ }).click();
    if (round === 1) mock.failNextGuess();
    await page.getByRole('button', { name: 'Pikachu', exact: true }).click();
    if (round === 1) await page.getByRole('button', { name: 'RETRY' }).click();
    await expect(page.locator('.reveal-panel')).toContainText('+413 POINTS');
    await page.getByRole('button', { name: round === 5 ? /VIEW RESULTS/ : /NEXT ROUND/ }).click();
  }
  await expect(page.getByText('VERIFIED RESULT SAVED', { exact: false })).toBeVisible();
  await expect(page.locator('.final-score')).toContainText('2,065');
  await expect(page.locator('.result-list > div')).toHaveCount(5);
  expect(mock.requests.filter(r => r.p_action === 'guess').map(r => r.p_round)).toEqual([1, 1, 2, 3, 4, 5]);
});

test('Hard keeps focus on a wrong guess, resumes after reload and exits on sign-out', async ({ page }) => {
  const { requests } = await mockVerifiedGame(page);
  await page.getByRole('button', { name: /HARD TYPE/ }).click();
  await page.getByRole('button', { name: /START HARD/ }).click();
  const input = page.getByRole('textbox', { name: 'YOUR GUESS' });
  await page.getByRole('button', { name: /TAP TO TYPE/ }).click();
  await expect(input).toBeFocused();
  await input.fill('Bulbasaur');
  await expect(page.getByRole('button', { name: 'GUESS ▶', exact: true })).toBeEnabled();
  await input.press('Enter');
  await expect(page.getByText('Not quite! Try again.')).toBeVisible();
  await expect(input).toBeFocused();

  await page.reload();
  await page.getByRole('button', { name: /START REGULAR/ }).click();
  await expect(page.locator('.status')).toContainText('HARD');
  await expect(page.getByRole('button', { name: /TAP TO TYPE/ })).toHaveCount(0);
  await input.fill('Pikachu');
  await input.press('Enter');
  await expect(page.locator('.reveal-panel')).toContainText('+413 POINTS');
  await page.getByRole('button', { name: /NEXT ROUND/ }).click();
  await page.getByRole('button', { name: /TAP TO TYPE/ }).click();
  await expect(page.getByRole('progressbar')).toBeVisible();
  await page.getByRole('button', { name: 'Test sign out' }).click();
  await expect(input).toHaveCount(0);
  await expect(page.getByRole('button', { name: /START REGULAR/ })).toBeVisible();
  const previous = requests.length;
  await page.getByRole('button', { name: /START REGULAR/ }).click();
  await expect(page.locator('.choice')).toHaveCount(4);
  expect(requests).toHaveLength(previous);
});

test('profile sync sends the Clerk username with the session token and stays quiet on success', async ({ page }) => {
  const { profileSyncs } = await mockVerifiedGame(page);
  await expect.poll(() => profileSyncs.length).toBeGreaterThan(0);
  expect(profileSyncs.every(body => body.p_username === 'trainer')).toBe(true);
  await expect(page.locator('.profile-status')).toHaveCount(0);
});

test('an unavailable username shows a quiet notice and verified play still works', async ({ page }) => {
  await mockVerifiedGame(page, 'username_taken');
  await expect(page.locator('.profile-status')).toContainText('USERNAME ISN’T ON YOUR PROFILE');
  await page.getByRole('button', { name: /START REGULAR/ }).click();
  await expect(page.getByRole('button', { name: /START ROUND/ })).toBeVisible();
});
