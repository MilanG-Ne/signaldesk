import { expect, test } from '@playwright/test';

test('20,000 rows stay virtualized and keyboard navigation reaches the last request', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  const list = page.getByRole('listbox', { name: 'Requests' });
  await expect(list).toBeVisible();
  const rows = list.getByRole('option');
  await expect(rows.first()).toHaveAttribute('aria-setsize', '20000');
  expect(await rows.count()).toBeLessThan(60);
  await list.focus();
  await page.keyboard.press('End');
  await expect(page.locator('.request-id')).toHaveText('req_00000000');
  await expect(list.locator('[aria-posinset="20000"]')).toBeVisible();
  expect(await list.evaluate((el) => el.scrollTop)).toBeGreaterThan(1_000_000);
  expect(await rows.count()).toBeLessThan(60);
  expect(errors).toEqual([]);
});

test('filters compose, survive reload, and reset from an empty state', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Service', { exact: true }).selectOption('checkout');
  await page.getByLabel('Status', { exact: true }).selectOption('server');
  await page.getByRole('button', { name: 'Slow ≥ 800 ms' }).click();
  await page.getByLabel('Sort requests').selectOption('slowest');
  await expect(page.locator('.bar')).toHaveCount(60);
  await expect(page).toHaveURL(/service=checkout.*status=server.*slow=1.*sort=slowest/);
  await page.reload();
  await expect(page.getByLabel('Service', { exact: true })).toHaveValue('checkout');
  const list = page.getByRole('listbox', { name: 'Requests' });
  await expect(list.getByRole('option').first()).toContainText('503');
  await expect(list.getByRole('option').first()).toContainText('checkout');
  const search = page.getByLabel('Search requests');
  await search.fill('this-does-not-exist');
  await expect(page.getByRole('heading', { name: 'No requests in this view' })).toBeVisible();
  await page.getByRole('button', { name: 'Show all requests' }).click();
  await expect(list.getByRole('option').first()).toHaveAttribute('aria-setsize', '20000');
});

test('replay pauses on inspection and saved requests persist on this device', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Start replay' }).click();
  await expect(page.getByRole('button', { name: 'Pause replay' })).toBeVisible();
  await expect(page.locator('.app-footer')).toContainText(/[1-9]\d* replayed/);
  await page.getByRole('listbox', { name: 'Requests' }).hover({ position: { x: 60, y: 20 } });
  await page.getByRole('listbox', { name: 'Requests' }).getByRole('option').first().click();
  await expect(page.getByRole('button', { name: 'Start replay' })).toBeVisible();
  const id = await page.locator('.request-id').textContent();
  await page.getByRole('button', { name: 'Save request', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Saved on this device' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.reload();
  await page.getByRole('button', { name: /^Saved/ }).click();
  const rows = page.getByRole('listbox', { name: 'Requests' }).getByRole('option');
  await expect(rows).toHaveCount(1);
  await rows.first().click();
  await expect(page.locator('.request-id')).toHaveText(id!);
});

test('timeline has keyboard access and a minute selector for the same filter', async ({ page }) => {
  await page.goto('/');
  const first = page.getByRole('button', { name: /12:00 UTC:/ });
  await first.focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: /12:01 UTC:/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.getByLabel('Time window')).not.toHaveValue('all');
  await page.getByLabel('Time window').selectOption('all');
  await expect(page.getByRole('button', { name: /12:01 UTC:/ })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
});

test('mobile inspection, saving, and returning to the list avoid page overflow', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('listbox', { name: 'Requests' }).getByRole('option').first().click();
  await expect(page.getByRole('complementary', { name: 'Request inspector' })).toBeVisible();
  await page.getByRole('button', { name: 'Save request', exact: true }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.getByRole('button', { name: 'Back to requests', exact: true }).click();
  await expect(page.getByRole('listbox', { name: 'Requests' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});
