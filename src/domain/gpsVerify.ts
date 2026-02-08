import { GAME } from '../config/constants';

export interface GpsSample {
  lat: number;
  lon: number;
  accuracyM: number;
  timestamp: number;
}

/**
 * Acquire GPS samples and return the best (most accurate) one.
 * Takes 1–2 readings depending on DRINK_GPS_SAMPLES config.
 */
export async function acquireGpsSamples(
  count: number = GAME.DRINK_GPS_SAMPLES
): Promise<GpsSample> {
  const samples: GpsSample[] = [];

  for (let i = 0; i < count; i++) {
    const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 15000,
      });
    });

    samples.push({
      lat: pos.coords.latitude,
      lon: pos.coords.longitude,
      accuracyM: pos.coords.accuracy,
      timestamp: pos.timestamp,
    });

    // Short delay between samples if taking multiple
    if (i < count - 1) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  // Return the most accurate sample
  samples.sort((a, b) => a.accuracyM - b.accuracyM);
  return samples[0];
}
