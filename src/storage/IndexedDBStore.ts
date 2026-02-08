import Dexie from 'dexie';
import type { User, OnTheRoadVote, DrinkVote, Duel, DuelMessage, Team, DuelOutcome } from '../domain/types';
import type { StorageInterface } from './StorageInterface';
import { getNow } from '../domain/clock';

class BrewCountryDB extends Dexie {
  users!: Dexie.Table<User, string>;
  otrVotes!: Dexie.Table<OnTheRoadVote, string>;
  drinkVotes!: Dexie.Table<DrinkVote, string>;
  duels!: Dexie.Table<Duel, string>;
  duelMessages!: Dexie.Table<DuelMessage, string>;
  duelOutcomes!: Dexie.Table<DuelOutcome, string>;
  teams!: Dexie.Table<Team, string>;

  constructor() {
    super('BrewCountryDB');
    this.version(1).stores({
      users: 'id',
      otrVotes: 'id, userId, expiresAt',
      duels: 'id, challengerUserId, defenderUserId, status',
      duelMessages: 'id, duelId, createdAt',
      duelOutcomes: '[duelId+userId], userId, expiresAt',
      teams: 'id, beerId',
    });
    this.version(2).stores({
      users: 'id',
      otrVotes: 'id, userId, expiresAt',
      drinkVotes: 'id, userId, expiresAt, placeKey, [userId+placeKey+beerId]',
      duels: 'id, challengerUserId, defenderUserId, status',
      duelMessages: 'id, duelId, createdAt',
      duelOutcomes: '[duelId+userId], userId, expiresAt',
      teams: 'id, beerId',
    });
  }
}

export class IndexedDBStore implements StorageInterface {
  private db: BrewCountryDB;

  constructor() {
    this.db = new BrewCountryDB();
  }

  // ── User ──────────────────────────────────────────────
  async getUser(id: string): Promise<User | null> {
    return (await this.db.users.get(id)) ?? null;
  }
  async saveUser(user: User): Promise<void> {
    await this.db.users.put(user);
  }
  async getAllUsers(): Promise<User[]> {
    return this.db.users.toArray();
  }

  // ── OTR Votes ─────────────────────────────────────────
  async getOTRVotes(userId: string): Promise<OnTheRoadVote[]> {
    return this.db.otrVotes.where('userId').equals(userId).toArray();
  }
  async getAllOTRVotes(): Promise<OnTheRoadVote[]> {
    return this.db.otrVotes.toArray();
  }
  async saveOTRVote(vote: OnTheRoadVote): Promise<void> {
    await this.db.otrVotes.put(vote);
  }
  async removeOTRVote(id: string): Promise<void> {
    await this.db.otrVotes.delete(id);
  }
  async removeExpiredOTRVotes(): Promise<number> {
    const now = getNow();
    const expired = await this.db.otrVotes.where('expiresAt').below(now).toArray();
    await this.db.otrVotes.bulkDelete(expired.map(v => v.id));
    return expired.length;
  }

  // ── Drink Votes (Check-ins) ─────────────────────────
  async getDrinkVotes(userId: string): Promise<DrinkVote[]> {
    return this.db.drinkVotes.where('userId').equals(userId).toArray();
  }
  async getAllDrinkVotes(): Promise<DrinkVote[]> {
    return this.db.drinkVotes.toArray();
  }
  async saveDrinkVote(vote: DrinkVote): Promise<void> {
    await this.db.drinkVotes.put(vote);
  }
  async removeDrinkVote(id: string): Promise<void> {
    await this.db.drinkVotes.delete(id);
  }
  async removeExpiredDrinkVotes(): Promise<number> {
    const now = getNow();
    const expired = await this.db.drinkVotes.where('expiresAt').below(now).toArray();
    await this.db.drinkVotes.bulkDelete(expired.map(v => v.id));
    return expired.length;
  }

  // ── Duels ─────────────────────────────────────────────
  async getDuel(id: string): Promise<Duel | null> {
    return (await this.db.duels.get(id)) ?? null;
  }
  async getDuelsForUser(userId: string): Promise<Duel[]> {
    const asChallenger = await this.db.duels.where('challengerUserId').equals(userId).toArray();
    const asDefender = await this.db.duels.where('defenderUserId').equals(userId).toArray();
    const map = new Map<string, Duel>();
    for (const d of [...asChallenger, ...asDefender]) map.set(d.id, d);
    return [...map.values()];
  }
  async saveDuel(duel: Duel): Promise<void> {
    await this.db.duels.put(duel);
  }

  // ── Duel Messages ─────────────────────────────────────
  async getDuelMessages(duelId: string): Promise<DuelMessage[]> {
    return this.db.duelMessages.where('duelId').equals(duelId).sortBy('createdAt');
  }
  async saveDuelMessage(msg: DuelMessage): Promise<void> {
    await this.db.duelMessages.put(msg);
  }

  // ── Duel Outcomes ─────────────────────────────────────
  async getDuelOutcomes(userId: string): Promise<DuelOutcome[]> {
    const now = getNow();
    return this.db.duelOutcomes
      .where('userId').equals(userId)
      .filter(o => o.expiresAt > now)
      .toArray();
  }
  async saveDuelOutcome(outcome: DuelOutcome): Promise<void> {
    await this.db.duelOutcomes.put(outcome);
  }
  async removeExpiredOutcomes(): Promise<number> {
    const now = getNow();
    const expired = await this.db.duelOutcomes.where('expiresAt').below(now).toArray();
    for (const o of expired) {
      await this.db.duelOutcomes
        .where('[duelId+userId]')
        .equals([o.duelId, o.userId])
        .delete();
    }
    return expired.length;
  }

  // ── Teams ─────────────────────────────────────────────
  async getTeam(beerId: string): Promise<Team | null> {
    return (await this.db.teams.where('beerId').equals(beerId).first()) ?? null;
  }
  async saveTeam(team: Team): Promise<void> {
    await this.db.teams.put(team);
  }
  async getAllTeams(): Promise<Team[]> {
    return this.db.teams.toArray();
  }
}
