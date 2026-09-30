/**
 * Internal tooling (admin panel, time controls, seeding) is compiled into
 * local dev builds only — or explicitly with VITE_ENABLE_ADMIN=true.
 * It must never ship in the public production bundle.
 */
export const ADMIN_ENABLED: boolean =
  import.meta.env.DEV || import.meta.env.VITE_ENABLE_ADMIN === 'true';
