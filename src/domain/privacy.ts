/**
 * Location precision rules shared by client and Firestore rules
 * (see firestore.rules `onLattice`):
 *  - public home position: 1/50° ≈ 2 km lattice
 *  - check-in position:    1/200° ≈ 500 m lattice
 */
export const PUBLIC_HOME_STEPS = 50;
export const CHECKIN_STEPS = 200;

export function snapToLattice(value: number, steps: number): number {
  return Math.round(value * steps) / steps;
}
