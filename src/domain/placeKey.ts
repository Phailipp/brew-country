/**
 * PlaceKey: Round lat/lon to a ~200m grid for rate-limiting.
 * Two check-ins within ~200m of each other get the same placeKey.
 *
 * At 48° latitude (center of DACH):
 * - 1° lat ≈ 111 km → 0.0018° ≈ 200m
 * - 1° lon ≈ 74 km  → 0.0027° ≈ 200m
 */
const LAT_STEP = 0.0018;
const LON_STEP = 0.0027;

/**
 * Round coordinates to a ~200m grid cell and return a string key.
 * Format: "lat_lon" with rounded values.
 */
export function roundToPlaceKey(lat: number, lon: number): string {
  const rLat = Math.round(lat / LAT_STEP) * LAT_STEP;
  const rLon = Math.round(lon / LON_STEP) * LON_STEP;
  return `${rLat.toFixed(4)}_${rLon.toFixed(4)}`;
}
