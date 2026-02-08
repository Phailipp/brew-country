import type { Vote } from '../domain/types';

/**
 * Abstract vote storage interface.
 * Implementations can use localStorage, IndexedDB, SQLite, REST API, etc.
 */
export interface VoteStore {
  getAll(): Vote[];
  save(vote: Vote): void;
  remove(id: string): void;
  clear(): void;
  getCurrentUserId(): string;
}

const VOTES_KEY = 'brewcountry_votes';
const USER_ID_KEY = 'brewcountry_userid';

function generateUserId(): string {
  return 'user_' + Math.random().toString(36).substring(2, 10);
}

/**
 * localStorage-based implementation of VoteStore.
 */
export class LocalStorageVoteStore implements VoteStore {
  getAll(): Vote[] {
    try {
      const raw = localStorage.getItem(VOTES_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  save(vote: Vote): void {
    const votes = this.getAll();
    const idx = votes.findIndex((v) => v.id === vote.id);
    if (idx >= 0) {
      votes[idx] = vote;
    } else {
      votes.push(vote);
    }
    localStorage.setItem(VOTES_KEY, JSON.stringify(votes));
  }

  remove(id: string): void {
    const votes = this.getAll().filter((v) => v.id !== id);
    localStorage.setItem(VOTES_KEY, JSON.stringify(votes));
  }

  clear(): void {
    localStorage.setItem(VOTES_KEY, JSON.stringify([]));
  }

  getCurrentUserId(): string {
    let uid = localStorage.getItem(USER_ID_KEY);
    if (!uid) {
      uid = generateUserId();
      localStorage.setItem(USER_ID_KEY, uid);
    }
    return uid;
  }
}
