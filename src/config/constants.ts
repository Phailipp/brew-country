/**
 * All game balance constants in one place.
 * No Settings panel — tune here and redeploy.
 */
export const GAME = {
  // ── Grid (DACH region: ~1050 km N–S, ~850 km W–E) ────
  GRID_SIZE_KM: 1100,
  CELL_SIZE_METERS: 2000,            // fallback for full-DACH grid

  // ── Zoom-adaptive grid ──────────────────────────────
  /** Zoom → cell size mapping (meters). Interpolated for in-between zooms. */
  ZOOM_CELL_SIZES: {
    6:  4000,   // ganz DACH sichtbar — grob
    8:  2000,   // Bundesland
    10: 1000,   // Großraum / Stadt
    12:  500,   // Stadtviertel
    14:  200,   // Nachbarschaft — sehr fein
  } as Record<number, number>,
  /** Buffer around viewport to include votes that may influence visible cells */
  VIEWPORT_BUFFER_KM: 25,
  /** Debounce ms for viewport/zoom changes before recomputing */
  VIEWPORT_DEBOUNCE_MS: 300,
  /** Maximum grid cells before auto-coarsening */
  MAX_GRID_CELLS: 80_000,

  // ── Home Vote ─────────────────────────────────────────
  HOME_RADIUS_KM: 20,
  HOME_BOOST_INITIAL_DAYS: 3,
  HOME_BOOST_MAX: 2.0,
  HOME_BOOST_MIN: 1.0,
  DECAY_PER_MISSED_DAY: 0.2,

  // ── Stand Your Ground ─────────────────────────────────
  SYG_MULTIPLIER: 2.0,
  SYG_RADIUS_DIVISOR: 2.0,

  // ── On The Road ───────────────────────────────────────
  OTR_WEIGHT_SCALE: 0.5,
  OTR_RADIUS_KM: 20,
  OTR_EXPIRY_DAYS: 14,
  OTR_MAX_ACTIVE: 5,

  // ── Teams (Biergemeinschaft) ──────────────────────────
  TEAM_MAX_MEMBERS: 10,
  TEAM_BOOST_PER_OVERLAP: 0.1,
  TEAM_MAX_BOOST: 0.9,

  // ── Duels / Battle Mode ───────────────────────────────
  DUEL_MAX_ACTIVE: 5,
  DUEL_ACCEPT_TIMEOUT_HOURS: 5,
  DUEL_ROUND_TIMEOUT_HOURS: 5,
  DUEL_RESULT_DURATION_DAYS: 14,
  DUEL_WIN_BOOST: 0.3,
  DUEL_LONG_WIN_BONUS: 0.1,
  DUEL_LONG_WIN_TOTAL: 0.4,
  DUEL_LOSS_PENALTY: -0.1,
  DUEL_TIMEOUT_BOOST: 0.3,
  DUEL_DELTA_MIN: -0.3,
  DUEL_DELTA_MAX: 1.0,
  DUEL_LONG_THRESHOLD_HOURS: 24,
  DUEL_LONG_THRESHOLD_ROUNDS: 6,

  // ── Weight computation ────────────────────────────────
  WEIGHT_MIN: 0.2,

  // ── Display ───────────────────────────────────────────
  CLOSE_MARGIN_THRESHOLD: 0.10,
  CLOSE_MARGIN_MIN_WEIGHT: 5.0,
  SMOOTHING_ITERATIONS: 2,
  MERGE_ISLAND_SIZE: 8,
  BORDER_WIDTH: 2.5,

  // ── GPS ───────────────────────────────────────────────
  GPS_SAMPLE_COUNT: 2,
  GPS_SAMPLE_INTERVAL_MS: 15_000,
  GPS_MAX_ACCURACY_METERS: 50,
  GPS_MAX_JUMP_METERS: 200,

  // ── Drink Vote (Check-in) ────────────────────────────
  DRINK_WEIGHT: 0.75,
  DRINK_RADIUS_KM: 5,
  DRINK_TTL_HOURS: 24,
  DRINK_COOLDOWN_MIN: 15,
  DRINK_SAME_PLACE_BEER_WINDOW_H: 6,
  DRINK_DAILY_CAP: 12,
  DRINK_GPS_MAX_ACCURACY_M: 75,
  DRINK_GPS_SAMPLES: 2,

  // ── Photo / Duel TTL ──────────────────────────────────
  PHOTO_TTL_DAYS: 30,

  // ── Friends & Chat ──────────────────────────────────────
  MAX_FRIENDS: 50,
  MAX_CHAT_MESSAGE_LENGTH: 500,
  CHAT_PAGE_SIZE: 50,
  PRESENCE_HEARTBEAT_MS: 60_000,          // 1 min
  PRESENCE_ONLINE_THRESHOLD_MS: 300_000,  // 5 min
} as const;
