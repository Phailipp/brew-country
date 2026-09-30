import { test, expect } from '@playwright/test';
import { stubNetwork, startDemo, tab } from './helpers';

test.beforeEach(async ({ page }) => { await stubNetwork(page); });

test('login screen offers the demo', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByRole('button', { name: /Demo ansehen/ })).toBeVisible();
});

test('age gate requires a birthdate, adulthood and consent', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: /Demo ansehen/ }).click();
  const next = page.getByRole('button', { name: 'Weiter', exact: true });
  await next.click();
  await expect(page.getByText('Bitte gib dein Geburtsdatum ein.')).toBeVisible();

  const minor = new Date();
  minor.setFullYear(minor.getFullYear() - 17);
  await page.getByLabel('Geburtsdatum').fill(minor.toISOString().slice(0, 10));
  await next.click();
  await expect(page.getByText(/nur für Erwachsene ab 18/)).toBeVisible();

  await page.getByLabel('Geburtsdatum').fill('1990-05-17');
  await next.click();
  await expect(page.getByText('Bitte stimme den Nutzungsbedingungen zu.')).toBeVisible();

  await page.locator('.ob-check .ob-check-box').click();
  await next.click();
  await expect(page.getByRole('heading', { name: 'Wo ist dein Zuhause?' })).toBeVisible();
});

test('legal pages open from the login and without an account', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('link', { name: 'Datenschutzerklärung' }).click();
  await expect(page.getByRole('heading', { name: 'Datenschutzerklärung', level: 1 })).toBeVisible();
  await expect(page.getByText(/ohne Namen oder Konto-Kennung/)).toBeVisible();
  await page.getByRole('button', { name: 'Zurück' }).click();
  await expect(page.getByRole('button', { name: /Demo ansehen/ })).toBeVisible();

  await page.goto('./#impressum');
  await expect(page.getByRole('heading', { name: 'Impressum', level: 1 })).toBeVisible();
});

test('how-to explains the rules with the real limits and closes again', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('link', { name: 'So funktioniert’s' }).click();
  await expect(page.getByRole('heading', { name: 'So funktioniert’s', level: 1 })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Vor Ort einchecken', level: 2 })).toBeVisible();
  await expect(page.getByText(/max\. 60 m\), einmal pro Kneipe und Tag und in höchstens 2 Kneipen/)).toBeVisible();
  await expect(page.getByText(/^Version /)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: /Demo ansehen/ })).toBeVisible();
  await expect(page).not.toHaveURL(/#anleitung/);
});

test('how-to from a deep link closes in place without leaving the app', async ({ page }) => {
  await page.goto('./#anleitung');
  await expect(page.getByRole('heading', { name: 'So funktioniert’s', level: 1 })).toBeVisible();
  await expect(page.getByText(/20 % mehr Einfluss/)).toBeVisible();
  await page.getByRole('button', { name: 'Zurück' }).click();
  await expect(page.getByRole('button', { name: /Demo ansehen/ })).toBeVisible();
  await expect(page).not.toHaveURL(/#/);
});

test('how-to from the profile: pages stack, back walks them, focus and sheet survive', async ({ page }) => {
  await startDemo(page);
  await tab(page, 'Profil').click();
  await expect(page.getByText('Dein Bierpass')).toBeVisible();
  const link = page.getByRole('navigation', { name: 'Hilfe & Rechtliches' }).getByRole('link', { name: 'So funktioniert’s' });
  await link.click();
  await expect(page.getByRole('heading', { name: 'So funktioniert’s', level: 1 })).toBeVisible();

  // How-to → privacy policy, then the browser back button returns to the how-to
  await page.getByRole('dialog', { name: 'So funktioniert’s' }).getByRole('link', { name: 'Datenschutzerklärung' }).click();
  await expect(page.getByRole('heading', { name: 'Datenschutzerklärung', level: 1 })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('heading', { name: 'So funktioniert’s', level: 1 })).toBeVisible();

  // Escape closes only the page on top: the profile sheet stays open, focus returns
  await page.keyboard.press('Escape');
  await expect(page.getByRole('heading', { name: 'So funktioniert’s', level: 1 })).toHaveCount(0);
  await expect(page.getByText('Dein Bierpass')).toBeVisible();
  await expect(page).not.toHaveURL(/#anleitung/);
  await expect(link).toBeFocused();
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

test('deleting the demo account wipes local data', async ({ page }) => {
  await startDemo(page);
  await tab(page, 'Profil').click();
  await page.getByRole('button', { name: 'Konto löschen' }).click();
  await page.getByRole('button', { name: 'Ja, endgültig löschen' }).click();
  await expect(page.getByRole('button', { name: /Demo ansehen/ })).toBeVisible();
  const dbs = await page.evaluate(async () => (await indexedDB.databases()).map((d) => d.name));
  expect(dbs).not.toContain('BrewCountryDB');
});
