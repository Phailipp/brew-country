import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { stubNetwork, startDemo, tab } from './helpers';

// Measure the settled UI, not mid-fade frames (half-transparent text fails contrast)
test.use({ contextOptions: { reducedMotion: 'reduce' } });

const serious = (violations: { impact?: string | null; id: string; nodes: unknown[] }[]) =>
  violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => `${v.id}: ${v.nodes.map((n) => (n as { target: string[] }).target.join(' ')).join(', ')}`);

test('login screen has no serious accessibility violations', async ({ page }) => {
  await stubNetwork(page);
  await page.goto('./');
  await expect(page.getByRole('button', { name: /Demo ansehen/ })).toBeVisible();
  const r = await new AxeBuilder({ page }).analyze();
  expect(serious(r.violations)).toEqual([]);
});

test('how-to page has no serious accessibility violations', async ({ page }) => {
  await stubNetwork(page);
  await page.goto('./#anleitung');
  await expect(page.getByRole('heading', { name: 'So funktioniert’s', level: 1 })).toBeVisible();
  const r = await new AxeBuilder({ page }).analyze();
  expect(serious(r.violations)).toEqual([]);
});

test('game shell and profile have no serious accessibility violations', async ({ page }) => {
  await stubNetwork(page);
  await startDemo(page);
  const shell = await new AxeBuilder({ page }).exclude('.maplibregl-canvas').analyze();
  expect(serious(shell.violations)).toEqual([]);
  await tab(page, 'Profil').click();
  await expect(page.getByText('Dein Bierpass')).toBeVisible();
  const profile = await new AxeBuilder({ page }).exclude('.maplibregl-canvas').analyze();
  expect(serious(profile.violations)).toEqual([]);
});
