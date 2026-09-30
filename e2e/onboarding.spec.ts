import { test, expect } from '@playwright/test';
import { stubNetwork, startDemo, tab } from './helpers';

test.beforeEach(async ({ page }) => { await stubNetwork(page); });

test('login screen offers the demo', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByRole('button', { name: /Demo ansehen/ })).toBeVisible();
});

test('age gate blocks without confirmation', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: /Demo ansehen/ }).click();
  await page.getByRole('button', { name: 'Weiter', exact: true }).click();
  await expect(page.getByText(/nur für Erwachsene/)).toBeVisible();
});

test('demo onboarding lands on the map with a home turf', async ({ page }) => {
  await startDemo(page);
  await expect(page.getByText('Dein Revier')).toBeVisible();
  await expect(page.locator('.status-chip-demo')).toHaveText('Demo');
});

test('demo session survives a reload', async ({ page }) => {
  await startDemo(page);
  await page.reload();
  await expect(page.getByRole('button', { name: /Zu deinem Revier fliegen/ })).toBeVisible();
});

test('ending the demo returns to the login', async ({ page }) => {
  await startDemo(page);
  await tab(page, 'Profil').click();
  await page.getByRole('button', { name: 'Demo beenden' }).click();
  await expect(page.getByRole('button', { name: /Demo ansehen/ })).toBeVisible();
});
