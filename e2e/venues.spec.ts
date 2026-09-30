import { test, expect } from '@playwright/test';
import { stubNetwork, startDemo, jumpTo, findRuledVenue, MARIENPLATZ, tab } from './helpers';

test('pubs load, open, check in once a day and land in the passport', async ({ page }) => {
  await stubNetwork(page);
  await startDemo(page);
  await jumpTo(page, MARIENPLATZ.lat, MARIENPLATZ.lon, 15.5);

  const venue = await findRuledVenue(page);
  await page.mouse.click(venue.x, venue.y);
  const card = page.locator('.venue');
  await expect(card.locator('.venue-name')).toHaveText(venue.name);
  await expect(card.getByText(/regiert hier/)).toBeVisible();

  await card.getByRole('button', { name: /Hier einchecken/ }).click();
  await expect(page.locator('.celebration')).toBeVisible();
  await expect(card.getByRole('button', { name: /Heute schon erledigt/ })).toBeDisabled();
  await expect(card.getByText(/Heute warst du schon hier/)).toBeVisible();

  await tab(page, 'Profil').click();
  await expect(page.getByRole('list', { name: 'Bierdeckel-Sammlung' }).getByRole('listitem')).toHaveCount(1);

  await tab(page, 'Quests').click();
  await expect(page.getByRole('list', { name: 'Wochenaufgaben' })).toBeVisible();
  await expect(page.getByText('1/3').first()).toBeVisible();
});

test('alcohol-free check-in is offered and counts', async ({ page }) => {
  await stubNetwork(page);
  await startDemo(page);
  await jumpTo(page, MARIENPLATZ.lat, MARIENPLATZ.lon, 15.5);
  const venue = await findRuledVenue(page);
  await page.mouse.click(venue.x, venue.y);
  await page.getByRole('button', { name: /ändern/ }).click();
  await page.getByRole('switch', { name: 'Alkoholfrei' }).click();
  await expect(page.getByText(/alkoholfrei/).first()).toBeVisible();
  await page.getByRole('button', { name: /Hier einchecken/ }).click();
  await tab(page, 'Profil').click();
  await expect(page.getByText(/1 × alkoholfrei/)).toBeVisible();
});

test('shows a retry when Overpass is down', async ({ page }) => {
  const net = await stubNetwork(page, { overpass: 'error' });
  await startDemo(page);
  await jumpTo(page, MARIENPLATZ.lat, MARIENPLATZ.lon, 15.5);
  await expect(page.getByText(/Kneipen nicht erreichbar/)).toBeVisible({ timeout: 30_000 });
  const before = net.overpassCalls();
  await page.getByRole('button', { name: 'Nochmal' }).click();
  await expect.poll(() => net.overpassCalls()).toBeGreaterThan(before);
});

test('zoomed out, the app hints to zoom in for pubs', async ({ page }) => {
  await stubNetwork(page);
  await startDemo(page);
  await jumpTo(page, MARIENPLATZ.lat, MARIENPLATZ.lon, 11.2);
  await expect(page.getByText(/Näher ranzoomen/)).toBeVisible();
});

test('Prost lists the pubs around the player and opens the chosen one', async ({ page }) => {
  await stubNetwork(page);
  await startDemo(page);
  await page.getByRole('button', { name: /Prost! Jetzt einchecken/ }).click();
  const list = page.getByRole('list', { name: 'Kneipen in deiner Nähe' });
  await expect(list.getByRole('button').first()).toBeVisible();
  const name = (await list.locator('.finder-name').first().textContent()) ?? '';
  await list.getByRole('button').first().click();
  await expect(page.locator('.venue .venue-name')).toHaveText(name);
});

test('Prost explains when the pub data is unreachable', async ({ page }) => {
  await stubNetwork(page, { overpass: 'error' });
  await startDemo(page);
  await page.getByRole('button', { name: /Prost! Jetzt einchecken/ }).click();
  await expect(page.getByText('Kneipen gerade nicht erreichbar')).toBeVisible({ timeout: 45_000 });
  await expect(page.getByRole('button', { name: 'Nochmal suchen' })).toBeVisible();
});
