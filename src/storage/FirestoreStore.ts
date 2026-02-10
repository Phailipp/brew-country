import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  where,
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
import type { StorageInterface } from './StorageInterface';

const COLLECTIONS = {
  users: 'bc_users',
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

export class FirestoreStore implements StorageInterface {
  // ── User ──────────────────────────────────────────────
  async getUser(id: string): Promise<User | null> {
    const db = getFirestoreDb();
    const snap = await getDoc(doc(db, COLLECTIONS.users, id));
    return snap.exists() ? (snap.data() as User) : null;
  }

  async saveUser(user: User): Promise<void> {
    const db = getFirestoreDb();
    await setDoc(doc(db, COLLECTIONS.users, user.id), clean(user));
  }

  async getAllUsers(): Promise<User[]> {
    const db = getFirestoreDb();
    const snapshot = await getDocs(collection(db, COLLECTIONS.users));
    return snapshot.docs.map((d) => d.data() as User);
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

  async saveOTRVote(vote: OnTheRoadVote): Promise<void> {
    const db = getFirestoreDb();
    await setDoc(doc(db, COLLECTIONS.otrVotes, vote.id), clean(vote));
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

  async saveDrinkVote(vote: DrinkVote): Promise<void> {
    const db = getFirestoreDb();
    await setDoc(doc(db, COLLECTIONS.drinkVotes, vote.id), clean(vote));
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

  async getAllTeams(): Promise<Team[]> {
    const db = getFirestoreDb();
    const snapshot = await getDocs(collection(db, COLLECTIONS.teams));
    return snapshot.docs.map((d) => d.data() as Team);
  }
}
