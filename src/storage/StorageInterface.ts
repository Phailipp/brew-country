import type { User, OnTheRoadVote, DrinkVote, Duel, DuelMessage, Team, DuelOutcome } from '../domain/types';

/**
 * Abstract storage interface for all game entities.
 * Implementations: IndexedDB (Dexie) and Firebase Firestore.
 */
export interface StorageInterface {
  // ── User ──────────────────────────────────────────────
  getUser(id: string): Promise<User | null>;
  saveUser(user: User): Promise<void>;
  getAllUsers(): Promise<User[]>;

  // ── On The Road Votes ─────────────────────────────────
  getOTRVotes(userId: string): Promise<OnTheRoadVote[]>;
  getAllOTRVotes(): Promise<OnTheRoadVote[]>;
  saveOTRVote(vote: OnTheRoadVote): Promise<void>;
  removeOTRVote(id: string): Promise<void>;
  removeExpiredOTRVotes(): Promise<number>;

  // ── Drink Votes (Check-ins) ──────────────────────────
  getDrinkVotes(userId: string): Promise<DrinkVote[]>;
  getAllDrinkVotes(): Promise<DrinkVote[]>;
  saveDrinkVote(vote: DrinkVote): Promise<void>;
  removeDrinkVote(id: string): Promise<void>;
  removeExpiredDrinkVotes(): Promise<number>;

  // ── Duels ─────────────────────────────────────────────
  getDuel(id: string): Promise<Duel | null>;
  getDuelsForUser(userId: string): Promise<Duel[]>;
  saveDuel(duel: Duel): Promise<void>;

  // ── Duel Messages ─────────────────────────────────────
  getDuelMessages(duelId: string): Promise<DuelMessage[]>;
  saveDuelMessage(msg: DuelMessage): Promise<void>;

  // ── Duel Outcomes ─────────────────────────────────────
  getDuelOutcomes(userId: string): Promise<DuelOutcome[]>;
  saveDuelOutcome(outcome: DuelOutcome): Promise<void>;
  removeExpiredOutcomes(): Promise<number>;

  // ── Teams ─────────────────────────────────────────────
  getTeam(beerId: string): Promise<Team | null>;
  saveTeam(team: Team): Promise<void>;
  getAllTeams(): Promise<Team[]>;
}
