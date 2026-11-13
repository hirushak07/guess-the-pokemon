import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 320, height: 568 }, hasTouch: true, isMobile: true });

test('guests can switch leaderboard modes on a narrow screen', async ({ page }) => {
  await page.route('**/rest/v1/rpc/get_verified_leaderboard', async route => {
    const { p_mode } = route.request().postDataJSON();
    await route.fulfill({ json: p_mode === 'regular' ? [{ rank: 1, username: 'trainer', score: 2905 }] : [] });
  });

  await page.goto('/');
  await page.getByRole('button', { name: 'View leaderboard' }).tap();
  const board = page.getByRole('region', { name: 'Leaderboard' });
  await expect(board.getByRole('rowheader', { name: 'trainer' })).toBeVisible();
  await expect(board.getByRole('cell', { name: '2,905' })).toBeVisible();
  await expect(board.getByRole('button', { name: 'Publish my best scores' })).toHaveCount(0);
  await board.getByRole('button', { name: 'Hard' }).tap();
  await expect(board.getByRole('status')).toHaveText('No public scores in this mode yet.');
  await expect(board.getByRole('button', { name: 'Hard' })).toHaveAttribute('aria-pressed', 'true');
  expect(await board.evaluate(element => element.scrollWidth)).toBeLessThanOrEqual(320);
});

test('signed-in players can publish and hide scores', async ({ page }) => {
  let visible = false;
  await page.addInitScript(() => sessionStorage.setItem('test-signed-in', 'yes'));
  await page.route('**/rest/v1/rpc/sync_profile', route => route.fulfill({ json: { status: 'saved', username: 'trainer' } }));
  await page.route('**/rest/v1/rpc/leaderboard_visibility', async route => {
    const { p_visible } = route.request().postDataJSON();
    if (typeof p_visible === 'boolean') visible = p_visible;
    await route.fulfill({ json: visible });
  });
  await page.route('**/rest/v1/rpc/get_verified_leaderboard', route =>
    route.fulfill({ json: visible ? [{ rank: 1, username: 'trainer', score: 2905 }] : [] }));

  await page.goto('/');
  await page.getByRole('button', { name: 'View leaderboard' }).click();
  await page.getByRole('button', { name: 'Publish my best scores' }).click();
  await expect(page.getByRole('rowheader', { name: 'trainer' })).toBeVisible();
  await page.getByRole('button', { name: 'Hide my scores' }).click();
  await expect(page.getByText('No public scores in this mode yet.')).toBeVisible();
  expect(visible).toBe(false);
});
