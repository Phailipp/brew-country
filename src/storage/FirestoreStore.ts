import {
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import type {
  DrinkVote,
  Duel,
  DuelMessage,
  DuelOutcome,
  OnTheRoadVote,
  Team,
  User,
} from '../domain/types';
import { getNow } from '../domain/clock';
import { getFirestoreDb } from '../config/firestore';
import { getFirebaseAuth } from '../config/firebaseAuth';
import { CHECKIN_STEPS, PUBLIC_HOME_STEPS, snapToLattice } from '../domain/privacy';
import { GAME } from '../config/constants';
import type { StorageInterface } from './StorageInterface';

const COLLECTIONS = {
  users: 'bc_users',
  publicUsers: 'users',
  userStats: 'bc_userStats',
  otrVotes: 'bc_otrVotes',
  drinkVotes: 'bc_drinkVotes',
  duels: 'bc_duels',
  duelMessages: 'bc_duelMessages',
  duelOutcomes: 'bc_duelOutcomes',
  teams: 'bc_teams',
} as const;

function clean<T>(data: T): T {
  return JSON.parse(JSON.stringify(data));
}

function publicToUser(data: Record<string, unknown>): User {
  return {
    id: data.userId as string,
    phone: null,
    createdAt: (data.createdAt as number) ?? 0,
    lastActiveAt: (data.lastActiveAt as number) ?? 0,
    homeLat: (data.homeLat as number) ?? 0,
    homeLon: (data.homeLon as number) ?? 0,
    beerId: data.beerId as string,
    standYourGroundEnabled: (data.syg as boolean) ?? false,
    ageVerified: true,
  };
}

export class FirestoreStore implements StorageInterface {
  // ── User ──────────────────────────────────────────────
  /** Own user: full private record. Anyone else: the coarse public profile. */
  async getUser(id: string): Promise<User | null> {
    const db = getFirestoreDb();
    if (id === getFirebaseAuth().currentUser?.uid) {
      const snap = await getDoc(doc(db, COLLECTIONS.users, id));
      return snap.exists() ? (snap.data() as User) : null;
    }
    const snap = await getDoc(doc(db, COLLECTIONS.publicUsers, id));
    return snap.exists() ? publicToUser(snap.data()) : null;
  }

  async saveUser(user: User): Promise<void> {
    const db = getFirestoreDb();
    await setDoc(doc(db, COLLECTIONS.users, user.id), clean(user));
  }

  /** Public (coarse) profiles of all players — private records are owner-only. */
  async getAllUsers(): Promise<User[]> {
    const db = getFirestoreDb();
    const snapshot = await getDocs(collection(db, COLLECTIONS.publicUsers));
    return snapshot.docs.map((d) => publicToUser(d.data())).filter((u) => u.homeLat !== 0 || u.homeLon !== 0);
  }

  // ── On The Road Votes ─────────────────────────────────
  async getOTRVotes(userId: string): Promise<OnTheRoadVote[]> {
    const db = getFirestoreDb();
    const q = query(collection(db, COLLECTIONS.otrVotes), where('userId', '==', userId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => d.data() as OnTheRoadVote);
  }

  async getAllOTRVotes(): Promise<OnTheRoadVote[]> {
    const db = getFirestoreDb();
    const snapshot = await getDocs(collection(db, COLLECTIONS.otrVotes));
    return snapshot.docs.map((d) => d.data() as OnTheRoadVote);
  }

  /** Flags live in five fixed slots per player (enforced by the rules). */
  async saveOTRVote(vote: OnTheRoadVote): Promise<void> {
    const db = getFirestoreDb();
    const mine = await this.getOTRVotes(vote.userId);
    const now = Date.now();
    const taken = new Set(mine.filter((v) => v.expiresAt > now).map((v) => v.id));
    let slot = -1;
    for (let i = 0; i < GAME.OTR_MAX_ACTIVE; i++) {
      if (!taken.has(`${vote.userId}_otr_${i}`)) { slot = i; break; }
    }
    if (slot < 0) throw new Error('Alle Unterwegs-Flaggen sind gesetzt.');
    const id = `${vote.userId}_otr_${slot}`;
    await setDoc(doc(db, COLLECTIONS.otrVotes, id), clean({
      ...vote,
      id,
      lat: snapToLattice(vote.lat, PUBLIC_HOME_STEPS),
      lon: snapToLattice(vote.lon, PUBLIC_HOME_STEPS),
    }));
  }

  async removeOTRVote(id: string): Promise<void> {
    const db = getFirestoreDb();
    await deleteDoc(doc(db, COLLECTIONS.otrVotes, id));
  }

  async removeExpiredOTRVotes(): Promise<number> {
    const db = getFirestoreDb();
    const now = getNow();
    const q = query(collection(db, COLLECTIONS.otrVotes), where('expiresAt', '<', now));
    const snapshot = await getDocs(q);
    await Promise.all(snapshot.docs.map((d) => deleteDoc(d.ref)));
    return snapshot.size;
  }

  // ── Drink Votes (Check-ins) ──────────────────────────
  async getDrinkVotes(userId: string): Promise<DrinkVote[]> {
    const db = getFirestoreDb();
    const q = query(collection(db, COLLECTIONS.drinkVotes), where('userId', '==', userId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => d.data() as DrinkVote);
  }

  async getAllDrinkVotes(): Promise<DrinkVote[]> {
    const db = getFirestoreDb();
    const snapshot = await getDocs(collection(db, COLLECTIONS.drinkVotes));
    return snapshot.docs.map((d) => d.data() as DrinkVote);
  }

  /**
   * Check-in + rate-limit counter in one batch. The rules only accept a
   * check-in whose batch also bumps bc_userStats (15 min cooldown,
   * daily cap), so limits hold even for modified clients.
   */
  async saveDrinkVote(vote: DrinkVote): Promise<void> {
    const db = getFirestoreDb();
    const statsRef = doc(db, COLLECTIONS.userStats, vote.userId);
    const statsSnap = await getDoc(statsRef);
    const now = new Date();
    const day = Timestamp.fromMillis(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const prev = statsSnap.exists() ? statsSnap.data() : null;
    const sameDay = prev?.day instanceof Timestamp && prev.day.toMillis() === day.toMillis();

    const batch = writeBatch(db);
    batch.set(statsRef, {
      lastDrinkAt: serverTimestamp(),
      day,
      dayCount: sameDay ? (prev?.dayCount ?? 0) + 1 : 1,
    });
    batch.set(doc(db, COLLECTIONS.drinkVotes, vote.id), clean({
      ...vote,
      lat: snapToLattice(vote.lat, CHECKIN_STEPS),
      lon: snapToLattice(vote.lon, CHECKIN_STEPS),
    }));
    await batch.commit();
  }

  async removeDrinkVote(id: string): Promise<void> {
    const db = getFirestoreDb();
    await deleteDoc(doc(db, COLLECTIONS.drinkVotes, id));
  }

  async removeExpiredDrinkVotes(): Promise<number> {
    const db = getFirestoreDb();
    const now = getNow();
    const q = query(collection(db, COLLECTIONS.drinkVotes), where('expiresAt', '<', now));
    const snapshot = await getDocs(q);
    await Promise.all(snapshot.docs.map((d) => deleteDoc(d.ref)));
    return snapshot.size;
  }

  // ── Duels ─────────────────────────────────────────────
  async getDuel(id: string): Promise<Duel | null> {
    const db = getFirestoreDb();
    const snap = await getDoc(doc(db, COLLECTIONS.duels, id));
    return snap.exists() ? (snap.data() as Duel) : null;
  }

  async getDuelsForUser(userId: string): Promise<Duel[]> {
    const db = getFirestoreDb();
    const asChallenger = await getDocs(
      query(collection(db, COLLECTIONS.duels), where('challengerUserId', '==', userId)),
    );
    const asDefender = await getDocs(
      query(collection(db, COLLECTIONS.duels), where('defenderUserId', '==', userId)),
    );
    const merged = new Map<string, Duel>();
    asChallenger.docs.forEach((d) => merged.set(d.id, d.data() as Duel));
    asDefender.docs.forEach((d) => merged.set(d.id, d.data() as Duel));
    return Array.from(merged.values());
  }

  async saveDuel(duel: Duel): Promise<void> {
    const db = getFirestoreDb();
    await setDoc(doc(db, COLLECTIONS.duels, duel.id), clean(duel));
  }

  // ── Duel Messages ─────────────────────────────────────
  async getDuelMessages(duelId: string): Promise<DuelMessage[]> {
    const db = getFirestoreDb();
    const q = query(collection(db, COLLECTIONS.duelMessages), where('duelId', '==', duelId));
    const snapshot = await getDocs(q);
    return snapshot.docs
      .map((d) => d.data() as DuelMessage)
      .sort((a, b) => a.createdAt - b.createdAt);
  }

  async saveDuelMessage(msg: DuelMessage): Promise<void> {
    const db = getFirestoreDb();
    await setDoc(doc(db, COLLECTIONS.duelMessages, msg.id), clean(msg));
  }

  // ── Duel Outcomes ─────────────────────────────────────
  async getDuelOutcomes(userId: string): Promise<DuelOutcome[]> {
    const db = getFirestoreDb();
    const now = getNow();
    const q = query(collection(db, COLLECTIONS.duelOutcomes), where('userId', '==', userId));
    const snapshot = await getDocs(q);
    return snapshot.docs
      .map((d) => d.data() as DuelOutcome)
      .filter((o) => o.expiresAt > now);
  }

  async saveDuelOutcome(outcome: DuelOutcome): Promise<void> {
    const db = getFirestoreDb();
    const id = `${outcome.duelId}_${outcome.userId}`;
    await setDoc(doc(db, COLLECTIONS.duelOutcomes, id), clean(outcome));
  }

  async removeExpiredOutcomes(): Promise<number> {
    const db = getFirestoreDb();
    const now = getNow();
    const q = query(collection(db, COLLECTIONS.duelOutcomes), where('expiresAt', '<', now));
    const snapshot = await getDocs(q);
    await Promise.all(snapshot.docs.map((d) => deleteDoc(d.ref)));
    return snapshot.size;
  }

  // ── Teams ─────────────────────────────────────────────
  async getTeam(beerId: string): Promise<Team | null> {
    const db = getFirestoreDb();
    const q = query(collection(db, COLLECTIONS.teams), where('beerId', '==', beerId));
    const snapshot = await getDocs(q);
    const first = snapshot.docs[0];
    return first ? (first.data() as Team) : null;
  }

  async saveTeam(team: Team): Promise<void> {
    const db = getFirestoreDb();
    await setDoc(doc(db, COLLECTIONS.teams, team.id), clean(team));
  }

  /** Atomic join: only the caller's own id is added (rules enforce this). */
  async joinTeam(beerId: string, userId: string): Promise<Team> {
    const db = getFirestoreDb();
    const id = `team_${beerId}`;
    const ref = doc(db, COLLECTIONS.teams, id);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      const team: Team = { id, beerId, memberUserIds: [userId] };
      await setDoc(ref, team);
      return team;
    }
    await updateDoc(ref, { memberUserIds: arrayUnion(userId) });
    const after = await getDoc(ref);
    return after.data() as Team;
  }

  async leaveTeam(beerId: string, userId: string): Promise<void> {
    const db = getFirestoreDb();
    await updateDoc(doc(db, COLLECTIONS.teams, `team_${beerId}`), { memberUserIds: arrayRemove(userId) });
  }

  async getAllTeams(): Promise<Team[]> {
    const db = getFirestoreDb();
    const snapshot = await getDocs(collection(db, COLLECTIONS.teams));
    return snapshot.docs.map((d) => d.data() as Team);
  }
}
