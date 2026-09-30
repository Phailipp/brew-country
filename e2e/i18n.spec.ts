import { test, expect, type Page } from '@playwright/test';
import { stubNetwork, startDemo } from './helpers';

// An English-speaking browser: the app starts in English
test.use({ locale: 'en-US' });

test.beforeEach(async ({ page }) => { await stubNetwork(page); });

const tabEn = (page: Page, name: 'Explore' | 'Crew' | 'Quests' | 'Profile') =>
  page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: new RegExp(`^${name}`) });

test('login is in English for an English browser', async ({ page }) => {
  await page.goto('./');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByRole('button', { name: /Try the demo/ })).toBeVisible();
  await expect(page.getByText('Which beer rules your neighbourhood?')).toBeVisible();
  await expect(page.getByRole('group', { name: 'Log in or sign up' })).toBeVisible();
  await expect(page.getByLabel('Password')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Privacy policy' })).toBeVisible();
});

test('English onboarding explains the age gate', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: /Try the demo/ }).click();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByText('Please enter your date of birth.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'terms of use' })).toBeVisible();
});

test('English legal pages say the German version is binding', async ({ page }) => {
  await page.goto('./#datenschutz');
  await expect(page.getByRole('heading', { name: 'Privacy policy', level: 1 })).toBeVisible();
  await expect(page.getByText('This translation is for convenience; the German version is legally binding.')).toBeVisible();
  await expect(page.getByText(/without your name or account ID/)).toBeVisible();
});

test('English demo reaches the map; switching to German re-renders at once and sticks', async ({ page }) => {
  // Onboarding, map start and a reload in one test (software WebGL is slow)
  test.slow();
  await startDemo(page, { lang: 'en' });
  await expect(page.getByText('Your turf')).toBeVisible();

  await tabEn(page, 'Profile').click();
  await expect(page.getByText('Your beer passport')).toBeVisible();
  const language = page.getByRole('group', { name: 'Language' });
  await expect(language.getByRole('button', { name: 'English' })).toHaveAttribute('aria-pressed', 'true');

  await language.getByRole('button', { name: 'Deutsch' }).click();
  await expect(page.getByText('Dein Bierpass')).toBeVisible();
  await expect(page.getByRole('group', { name: 'Sprache' }).getByRole('button', { name: 'Deutsch' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('html')).toHaveAttribute('lang', 'de');
  await expect(page.getByRole('navigation', { name: 'Hauptnavigation' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Zu deinem Revier fliegen/ })).toBeVisible();

  // The choice outlives a reload, although the browser still prefers English
  await page.reload();
  await expect(page.getByRole('button', { name: /Zu deinem Revier fliegen/ })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'de');
});
