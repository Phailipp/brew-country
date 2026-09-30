import { describe, expect, it } from 'vitest';
import { ageInYears, minimumAge } from '../domain/age';

const NOW = new Date(Date.UTC(2026, 8, 30));

describe('age gate', () => {
  it('uses 18 by default and the higher drinking age where it applies', () => {
    expect(minimumAge('DE')).toBe(18);
    expect(minimumAge(null)).toBe(18);
    expect(minimumAge('US')).toBe(21);
    expect(minimumAge('JP')).toBe(20);
  });
  it('counts full years around the birthday', () => {
    expect(ageInYears('2008-09-30', NOW)).toBe(18);
    expect(ageInYears('2008-10-01', NOW)).toBe(17);
    expect(ageInYears('2008-09-29', NOW)).toBe(18);
    expect(ageInYears('2004-02-29', NOW)).toBe(22);
  });
  it('rejects invalid and future dates', () => {
    expect(ageInYears('2008-02-30', NOW)).toBeNull();
    expect(ageInYears('30.09.2008', NOW)).toBeNull();
    expect(ageInYears('2030-01-01', NOW)).toBeNull();
    expect(ageInYears('', NOW)).toBeNull();
  });
});
