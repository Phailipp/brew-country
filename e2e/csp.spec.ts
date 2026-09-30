import { test, expect } from '@playwright/test';
import { stubNetwork } from './helpers';

// Runs only against `vite preview` of a production build (CSP is build-only):
//   npm run build && npx vite preview --port 5402 & CSP_CHECK=1 E2E_PORT=5402 npx playwright test e2e/csp.spec.ts
test('production build runs under its CSP', async ({ page }) => {
  test.skip(!process.env.CSP_CHECK, 'needs a production preview server');
  const violations: string[] = [];
  page.on('console', (m) => { if (/Content Security Policy|Refused to/.test(m.text())) violations.push(m.text()); });
  await stubNetwork(page);
  await page.goto('./');
  await page.evaluate(() => document.addEventListener('securitypolicyviolation', (e) => console.error('Refused to ' + e.violatedDirective + ' ' + e.blockedURI)));
  await page.getByRole('button', { name: /Demo ansehen/ }).click();
  await page.getByLabel('Geburtsdatum').fill('1990-05-17');
  await page.locator('.ob-check .ob-check-box').click();
  await page.getByRole('button', { name: 'Weiter', exact: true }).click();
  await page.getByRole('button', { name: /Koordinaten selbst eingeben/ }).click();
  await page.getByRole('button', { name: /Diesen Standort nehmen/ }).click();
  await page.getByRole('button', { name: /Weiter mit/ }).click();
  await page.getByRole('button', { name: /Los geht/ }).click();
  await expect(page.getByRole('button', { name: /Zu deinem Revier fliegen/ })).toBeVisible();
  await page.waitForTimeout(4000);
  await page.getByRole('button', { name: /Prost! Jetzt einchecken/ }).click();
  await expect(page.getByRole('list', { name: 'Kneipen in deiner Nähe' })).toBeVisible({ timeout: 30_000 });
  const fonts = await page.evaluate(() => [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family));
  console.log('fonts', [...new Set(fonts)].join(', '));
  expect(violations).toEqual([]);
});
