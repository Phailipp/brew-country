/** localStorage that never throws (Safari private mode, blocked site data). */
export const safeStorage = {
  get(key: string): string | null {
    try { return localStorage.getItem(key); } catch { return null; }
  },
  set(key: string, value: string): void {
    try { localStorage.setItem(key, value); } catch { /* not persisted */ }
  },
  remove(key: string): void {
    try { localStorage.removeItem(key); } catch { /* nothing stored */ }
  },
};
