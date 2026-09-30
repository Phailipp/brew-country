import { test, expect } from '@playwright/test';
import { stubNetwork, startDemo, jumpTo, MARIENPLATZ, tab } from './helpers';

test('brewery cockpit reports on the loaded pubs', async ({ page }) => {
  await stubNetwork(page);
  await startDemo(page);
  await jumpTo(page, MARIENPLATZ.lat, MARIENPLATZ.lon, 14.2);
  await page.waitForFunction(() => {
    const m = (window as unknown as { __bcMap: { queryRenderedFeatures: (o: object) => unknown[] } }).__bcMap;
    try { return m.queryRenderedFeatures({ layers: ['venue-dot'] }).length > 10; } catch { return false; }
  }, null, { timeout: 30_000 });
  const entry = page.getByRole('button', { name: /Brauerei-Cockpit/ });
  // Desktop opens the Explore panel by default; phones need the tab
  if (!(await entry.isVisible())) await tab(page, 'Entdecken').click();
  await entry.click();
  await expect(page.getByText('Kneipen regiert')).toBeVisible();
  await expect(page.getByText('Share of Voice')).toBeVisible();
  await expect(page.getByText('Ausschank ohne Fans')).toBeVisible();
});
