import { describe, it, expect } from 'vitest';
import { roundToPlaceKey } from '../domain/placeKey';

describe('roundToPlaceKey', () => {
  it('returns same key for points ~50m apart', () => {
    // ~50m north (0.00045° lat ≈ 50m)
    const key1 = roundToPlaceKey(48.1370, 11.5753);
    const key2 = roundToPlaceKey(48.1374, 11.5753);
    expect(key1).toBe(key2);
  });

  it('returns different keys for points ~300m apart', () => {
    // ~300m north (0.0027° lat ≈ 300m)
    const key1 = roundToPlaceKey(48.1370, 11.5753);
    const key2 = roundToPlaceKey(48.1400, 11.5753);
    expect(key1).not.toBe(key2);
  });

  it('returns same key for same input', () => {
    const key1 = roundToPlaceKey(48.1370, 11.5753);
    const key2 = roundToPlaceKey(48.1370, 11.5753);
    expect(key1).toBe(key2);
  });

  it('returns string in expected format', () => {
    const key = roundToPlaceKey(48.1370, 11.5753);
    expect(key).toMatch(/^\d+\.\d+_\d+\.\d+$/);
  });

  it('returns different keys for points ~300m apart in lon', () => {
    // At 48° lat, ~300m east (0.004° lon ≈ 300m)
    const key1 = roundToPlaceKey(48.1370, 11.5753);
    const key2 = roundToPlaceKey(48.1370, 11.5793);
    expect(key1).not.toBe(key2);
  });
});
