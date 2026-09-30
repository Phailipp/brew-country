/**
 * Internal tooling (admin panel, time controls, seeding) is compiled into
 * local dev builds only — or explicitly with VITE_ENABLE_ADMIN=true.
 * It must never ship in the public production bundle.
 */
export const ADMIN_ENABLED: boolean =
  import.meta.env.DEV || import.meta.env.VITE_ENABLE_ADMIN === 'true';

/**
 * Brewery logos are trademarks. They ship only once the breweries have
 * approved their use (see src/assets/logos/SOURCES.md). Until then the
 * production bundle shows monogram crests; dev builds show the logos.
 */
export const BRAND_LOGOS_ENABLED: boolean =
  import.meta.env.DEV || import.meta.env.VITE_BRAND_LOGOS === 'true';

/**
 * Legacy mechanics from the first prototype (duels, on-the-road flags,
 * teams, home-boost details, vote quests). Hidden for launch: one clear
 * game model (pubs) instead of five. Kept in code for experiments.
 */
export const LEGACY_FEATURES: boolean = import.meta.env.VITE_LEGACY_FEATURES === 'true';
