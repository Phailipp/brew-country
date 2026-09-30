import Dexie from 'dexie';
import type { User, OnTheRoadVote, DrinkVote, Duel, DuelMessage, Team, DuelOutcome } from '../domain/types';
import type { StorageInterface } from './StorageInterface';
import { nextVisitSlot, visitBlocker, visitBlockedError, type MyVisit, type Venue, type VenueCheckin } from '../domain/venues';
import { utcWeek, venuePlayerId } from '../domain/visitIds';
import { getNow } from '../domain/clock';

class BrewCountryDB extends Dexie {
  users!: Dexie.Table<User, string>;
  otrVotes!: Dexie.Table<OnTheRoadVote, string>;
  drinkVotes!: Dexie.Table<DrinkVote, string>;
  duels!: Dexie.Table<Duel, string>;
  duelMessages!: Dexie.Table<DuelMessage, string>;
  duelOutcomes!: Dexie.Table<DuelOutcome, string>;
  teams!: Dexie.Table<Team, string>;
  venueVisits!: Dexie.Table<VenueCheckin, string>;
  myVisits!: Dexie.Table<MyVisit, string>;

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
    this.version(3).stores({
      venueVisits: 'id, tile, createdAt',
      myVisits: 'id, createdAt',
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
  async joinTeam(beerId: string, userId: string): Promise<Team> {
    const existing = await this.getTeam(beerId);
    const team: Team = existing
      ? { ...existing, memberUserIds: existing.memberUserIds.includes(userId) ? existing.memberUserIds : [...existing.memberUserIds, userId] }
      : { id: `team_${beerId}`, beerId, memberUserIds: [userId] };
    await this.db.teams.put(team);
    return team;
  }
  async leaveTeam(beerId: string, userId: string): Promise<void> {
    const existing = await this.getTeam(beerId);
    if (!existing) return;
    await this.db.teams.put({ ...existing, memberUserIds: existing.memberUserIds.filter((id) => id !== userId) });
  }

  // ── Venue visits (demo sandbox) ───────────────────────
  async checkInAtVenue(userId: string, venue: Venue, beerId: string, alcoholFree: boolean): Promise<MyVisit> {
    const now = getNow();
    const mine = await this.getMyVisits();
    const blocked = visitBlocker(mine, venue.id, now);
    if (blocked) throw visitBlockedError(blocked);
    const slot = nextVisitSlot(mine, now);
    const id = `${userId}_${Math.floor(now / 86_400_000)}_${slot}`;
    const visit: MyVisit = { id, venueId: venue.id, venueName: venue.name, tile: venue.tile, beerId, alcoholFree, createdAt: now };
    // Hash first: a pending non-IndexedDB promise would auto-commit the transaction
    const player = await venuePlayerId(userId, venue.id, utcWeek(now));
    await this.db.transaction('rw', this.db.venueVisits, this.db.myVisits, async () => {
      await this.db.venueVisits.put({
        id, player, venueId: venue.id, tile: venue.tile, beerId, alcoholFree, createdAt: now,
      });
      await this.db.myVisits.put(visit);
    });
    return visit;
  }

  async getVenueCheckins(tiles: string[], sinceMs: number): Promise<VenueCheckin[]> {
    if (tiles.length === 0) return [];
    const rows = await this.db.venueVisits.where('tile').anyOf(tiles).toArray();
    return rows.filter((r) => r.createdAt >= sinceMs);
  }

  async getMyVisits(): Promise<MyVisit[]> {
    return this.db.myVisits.orderBy('createdAt').reverse().toArray();
  }

  /** Demo only: let a crowd of simulated regulars visit the given venues. */
  async simulateVenueCrowd(visits: VenueCheckin[]): Promise<void> {
    await this.db.venueVisits.bulkPut(visits);
  }

  async clearVenueCrowd(): Promise<void> {
    const mine = new Set((await this.db.myVisits.toArray()).map((v) => v.id));
    await this.db.venueVisits.filter((v) => !mine.has(v.id)).delete();
  }
}
