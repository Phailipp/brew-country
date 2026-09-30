/**
 * Brand logos: drop a file named `<beer-id>.svg|png|webp` into
 * src/assets/logos/ and it is picked up automatically (badges, pickers,
 * map crests). Beers without a file fall back to the monogram crest.
 *
 * Only add logos you are allowed to use (brand partner approval or a
 * licence that permits it) and record the source in
 * src/assets/logos/SOURCES.md.
 */
const files = import.meta.glob('../assets/logos/*.{svg,png,webp}', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

export const LOGO_URLS: Record<string, string> = Object.fromEntries(
  Object.entries(files).map(([path, url]) => [path.split('/').pop()!.replace(/\.(svg|png|webp)$/, ''), url]),
);
