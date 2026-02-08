/**
 * Mockable clock for testability and admin time-travel.
 * All TTL/expiry checks should use getNow() instead of Date.now().
 */
let mockTime: number | null = null;

/** Returns current timestamp (ms). Uses mock time if set. */
export function getNow(): number {
  return mockTime ?? Date.now();
}

/** Set a fixed mock time (ms epoch). Pass null to reset. */
export function setMockTime(time: number | null): void {
  mockTime = time;
}

/** Advance mock time by `deltaMs` milliseconds. Sets mock if not already set. */
export function advanceMockTime(deltaMs: number): void {
  mockTime = (mockTime ?? Date.now()) + deltaMs;
}

/** Reset to real clock. */
export function resetClock(): void {
  mockTime = null;
}

/** Check if mock clock is active. */
export function isMockActive(): boolean {
  return mockTime !== null;
}
