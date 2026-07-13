import { expect, test } from '@playwright/test';

test.describe('ATLAS core flows', () => {
  test('landing page presents the value proposition and navigation', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('chief-of-staff');
    await expect(page.getByRole('link', { name: /Open Command Center/i })).toBeVisible();
  });

  test('command center hydrates live operational data', async ({ page }) => {
    await page.goto('/command-center');
    await expect(page.getByRole('heading', { name: /Operations Command Center/i })).toBeVisible();
    // The live density map renders once the snapshot loads.
    await expect(page.getByRole('img', { name: /crowd density map/i })).toBeVisible({
      timeout: 15_000,
    });
    // KPI tiles are present.
    await expect(page.getByText('In venue')).toBeVisible();
  });

  test('fan copilot answers a question with grounded context', async ({ page }) => {
    await page.goto('/copilot');
    await expect(page.getByRole('heading', { name: 'Fan Copilot' })).toBeVisible();
    await page.getByLabel('Ask the fan copilot').fill('Where is the nearest restroom?');
    await page.getByRole('button', { name: 'Send' }).click();
    // An assistant reply appears (offline simulator guarantees a response).
    await expect(page.getByText(/ATLAS/).first()).toBeVisible({ timeout: 15_000 });
  });
});
