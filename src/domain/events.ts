import type { AppEvent } from './types';

type Listener = (event: AppEvent) => void;

class EventBus {
  private listeners: Set<Listener> = new Set();

  on(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  emit(event: AppEvent): void {
    for (const fn of this.listeners) {
      try { fn(event); } catch (e) { console.error('[EventBus]', e); }
    }
  }
}

/** Singleton event bus for cross-component communication */
export const appEvents = new EventBus();
