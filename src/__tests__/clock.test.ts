import { describe, it, expect, afterEach } from 'vitest';
import { getNow, setMockTime, advanceMockTime, resetClock, isMockActive } from '../domain/clock';

afterEach(() => {
  resetClock();
});

describe('clock', () => {
  it('returns real time when no mock is set', () => {
    const before = Date.now();
    const now = getNow();
    const after = Date.now();
    expect(now).toBeGreaterThanOrEqual(before);
    expect(now).toBeLessThanOrEqual(after);
    expect(isMockActive()).toBe(false);
  });

  it('returns mock time when set', () => {
    setMockTime(1000000);
    expect(getNow()).toBe(1000000);
    expect(isMockActive()).toBe(true);
  });

  it('advances mock time', () => {
    setMockTime(1000000);
    advanceMockTime(5000);
    expect(getNow()).toBe(1005000);
  });

  it('advances from real time if mock not set', () => {
    const before = Date.now();
    advanceMockTime(10000);
    const result = getNow();
    expect(result).toBeGreaterThanOrEqual(before + 10000);
    expect(isMockActive()).toBe(true);
  });

  it('resets to real clock', () => {
    setMockTime(1000000);
    resetClock();
    expect(isMockActive()).toBe(false);
    const now = getNow();
    expect(Math.abs(now - Date.now())).toBeLessThan(100);
  });
});
