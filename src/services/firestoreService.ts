/**
 * Firestore service layer.
 * All Firestore reads/writes are encapsulated here —
 * no UI component should import Firestore directly.
 */
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  addDoc,
  query,
  where,
  orderBy,
  limitToLast,
  arrayRemove,
  onSnapshot,
  serverTimestamp,
  type Unsubscribe,
  type DocumentData,
} from 'firebase/firestore';
import { getFirestoreDb } from '../config/firestore';
import { getFirebaseAuth } from '../config/firebaseAuth';
import { deleteUser } from 'firebase/auth';
import { GAME } from '../config/constants';
import { PUBLIC_HOME_STEPS, snapToLattice } from '../domain/privacy';
import type { Friendship, ChatMessage, UserPresence } from '../domain/types';
import type { QuestState, Vote } from '../domain/types';

// ── User Profiles ───────────────────────────────────────

/**
 * Public user profile stored in Firestore.
 * Contains all fields needed for map dominance + friend display.
 */
export interface FirestoreUserProfile {
  userId: string;
  beerId: string;
  /** Coarse (~2 km) public position — the exact home stays private. */
  homeLat: number;
  homeLon: number;
  createdAt: number;
  lastActiveAt: number;
  syg: boolean;
}

/**
 * Save or update a user's public profile in Firestore.
 * Called during onboarding and on each app load.
 */
export async function saveUserProfile(
  userId: string,
  beerId: string,
  homeLat: number,
  homeLon: number,
  createdAt: number,
  syg = false,
): Promise<void> {
  const db = getFirestoreDb();
  // createdAt comes from the canonical user record — never "now", otherwise
  // every app start would restart the new-player home boost.
  // The home position is published on a ~2 km lattice only (privacy).
  await setDoc(doc(db, 'users', userId), {
    userId,
    beerId,
    homeLat: snapToLattice(homeLat, PUBLIC_HOME_STEPS),
    homeLon: snapToLattice(homeLon, PUBLIC_HOME_STEPS),
    createdAt,
    lastActiveAt: Date.now(),
    syg,
  });
}

function toProfile(data: DocumentData): FirestoreUserProfile {
  return {
    userId: data.userId as string,
    beerId: data.beerId as string,
    homeLat: (data.homeLat as number) ?? 0,
    homeLon: (data.homeLon as number) ?? 0,
    createdAt: (data.createdAt as number) ?? 0,
    lastActiveAt: (data.lastActiveAt as number) ?? 0,
    syg: (data.syg as boolean) ?? false,
  };
}

/** Public profile → minimal User shape (for weights, friends, team maths). */
export function profileToUser(p: FirestoreUserProfile): import('../domain/types').User {
  return {
    id: p.userId,
    phone: null,
    createdAt: p.createdAt,
    lastActiveAt: p.lastActiveAt,
    homeLat: p.homeLat,
    homeLon: p.homeLon,
    beerId: p.beerId,
    standYourGroundEnabled: p.syg,
    ageVerified: true,
  };
}

/**
 * Fetch a user's public profile from Firestore.
 */
export async function getUserProfile(userId: string): Promise<FirestoreUserProfile | null> {
  const db = getFirestoreDb();
  const snap = await getDoc(doc(db, 'users', userId));
  return snap.exists() ? toProfile(snap.data()) : null;
}

/**
 * Subscribe to ALL user profiles in real-time.
 * Every client gets the full set of users for dominance calculation.
 */
export function subscribeAllUsers(
  callback: (users: FirestoreUserProfile[]) => void,
): Unsubscribe {
  const db = getFirestoreDb();
  const q = collection(db, 'users');

  return onSnapshot(q, (snapshot) => {
    const users: FirestoreUserProfile[] = snapshot.docs
      .map((d) => toProfile(d.data()))
      // Only include users with valid location
      .filter((u) => u.homeLat !== 0 || u.homeLon !== 0);
    callback(users);
  });
}

// ── Helpers ──────────────────────────────────────────────

/**
 * Build a deterministic friendship ID from two user IDs.
 * Always sorts alphabetically so A→B === B→A.
 */
export function makeFriendshipId(userA: string, userB: string): string {
  const sorted = [userA, userB].sort();
  return `${sorted[0]}_${sorted[1]}`;
}

// ── Friends ──────────────────────────────────────────────

/**
 * Send a friend request (status: 'pending').
 * The other user must accept before the friendship is active.
 */
export async function addFriend(myUserId: string, friendUserId: string): Promise<Friendship> {
  const db = getFirestoreDb();
  const sorted = [myUserId, friendUserId].sort() as [string, string];
  const id = makeFriendshipId(myUserId, friendUserId);

  const friendship: Friendship = {
    id,
    userIds: sorted,
    status: 'pending',
    requestedBy: myUserId,
    createdAt: Date.now(),
  };

  await setDoc(doc(db, 'friendships', id), {
    userIds: sorted,
    status: 'pending',
    requestedBy: myUserId,
    createdAt: friendship.createdAt,
  });

  return friendship;
}

/**
 * Accept a pending friend request.
 */
export async function acceptFriend(myUserId: string, friendUserId: string): Promise<void> {
  const db = getFirestoreDb();
  const id = makeFriendshipId(myUserId, friendUserId);
  await setDoc(doc(db, 'friendships', id), { status: 'accepted' }, { merge: true });
}

/**
 * Decline a pending friend request or withdraw a sent request.
 * Deletes the Firestore document entirely.
 */
export async function declineFriend(myUserId: string, friendUserId: string): Promise<void> {
  const db = getFirestoreDb();
  const id = makeFriendshipId(myUserId, friendUserId);
  await deleteDoc(doc(db, 'friendships', id));
}

/**
 * Remove an accepted friendship.
 * Deletes the Firestore document. Subcollection messages remain (Firestore behavior).
 */
export async function removeFriend(myUserId: string, friendUserId: string): Promise<void> {
  const db = getFirestoreDb();
  const id = makeFriendshipId(myUserId, friendUserId);
  await deleteDoc(doc(db, 'friendships', id));
}

/**
 * Subscribe to all friendships for a user (real-time).
 * Includes both pending and accepted. UI filters by status.
 */
export function subscribeFriends(
  userId: string,
  callback: (friendships: Friendship[]) => void,
): Unsubscribe {
  const db = getFirestoreDb();
  const q = query(
    collection(db, 'friendships'),
    where('userIds', 'array-contains', userId),
  );

  return onSnapshot(q, (snapshot) => {
    const friendships: Friendship[] = snapshot.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        userIds: data.userIds as [string, string],
        status: (data.status as 'pending' | 'accepted') ?? 'accepted', // backward compat
        requestedBy: (data.requestedBy as string) ?? '',
        createdAt: data.createdAt as number,
      };
    });
    callback(friendships);
  });
}

// ── Chat ─────────────────────────────────────────────────

/**
 * Send a chat message in a friendship.
 * Uses `serverTimestamp()` for ordering consistency.
 */
export async function sendMessage(
  friendshipId: string,
  senderId: string,
  text: string,
): Promise<void> {
  const db = getFirestoreDb();
  const trimmed = text.trim().slice(0, GAME.MAX_CHAT_MESSAGE_LENGTH);
  if (!trimmed) return;

  await addDoc(collection(db, 'friendships', friendshipId, 'messages'), {
    senderId,
    text: trimmed,
    createdAt: serverTimestamp(),
  });
}

/**
 * Subscribe to chat messages for a friendship (real-time, ordered by time, limited).
 */
export function subscribeMessages(
  friendshipId: string,
  callback: (messages: ChatMessage[]) => void,
): Unsubscribe {
  const db = getFirestoreDb();
  const q = query(
    collection(db, 'friendships', friendshipId, 'messages'),
    orderBy('createdAt', 'asc'),
    // Newest page — `limit` would pin the chat to the oldest messages
    limitToLast(GAME.CHAT_PAGE_SIZE),
  );

  return onSnapshot(q, (snapshot) => {
    const messages: ChatMessage[] = snapshot.docs.map((d) => {
      const data = d.data() as DocumentData;
      return {
        id: d.id,
        senderId: data.senderId as string,
        text: data.text as string,
        // serverTimestamp() may be null on first local callback (pending write)
        createdAt: data.createdAt?.toMillis?.() ?? Date.now(),
      };
    });
    callback(messages);
  });
}

// ── Presence ─────────────────────────────────────────────

/**
 * Update the current user's presence heartbeat.
 */
export async function updatePresence(userId: string): Promise<void> {
  const db = getFirestoreDb();
  await setDoc(
    doc(db, 'presence', userId),
    { lastSeen: Date.now() },
    { merge: true },
  );
}

/**
 * Subscribe to online user count.
 * Queries all presence documents and filters client-side for recent heartbeats.
 */
export function subscribeOnlineCount(
  callback: (count: number) => void,
): Unsubscribe {
  const db = getFirestoreDb();
  const q = collection(db, 'presence');

  return onSnapshot(q, (snapshot) => {
    const now = Date.now();
    const threshold = now - GAME.PRESENCE_ONLINE_THRESHOLD_MS;
    let count = 0;
    snapshot.docs.forEach((d) => {
      const lastSeen = d.data().lastSeen as number | undefined;
      if (lastSeen && lastSeen > threshold) {
        count++;
      }
    });
    callback(count);
  });
}

/**
 * Subscribe to presence for specific user IDs (for friends list).
 * Firestore `in` queries support up to 30 items.
 * For > 30 friends, splits into multiple queries.
 */
export function subscribePresenceForUsers(
  userIds: string[],
  callback: (presenceMap: Map<string, UserPresence>) => void,
): Unsubscribe {
  if (userIds.length === 0) {
    callback(new Map());
    return () => {};
  }

  const db = getFirestoreDb();
  const presenceMap = new Map<string, UserPresence>();
  const unsubscribers: Unsubscribe[] = [];

  // Split into chunks of 30 (Firestore `in` limit)
  const chunks: string[][] = [];
  for (let i = 0; i < userIds.length; i += 30) {
    chunks.push(userIds.slice(i, i + 30));
  }

  for (const chunk of chunks) {
    const q = query(
      collection(db, 'presence'),
      where('__name__', 'in', chunk),
    );

    const unsub = onSnapshot(q, (snapshot) => {
      snapshot.docs.forEach((d) => {
        const data = d.data();
        presenceMap.set(d.id, {
          userId: d.id,
          lastSeen: (data.lastSeen as number) ?? 0,
        });
      });
      callback(new Map(presenceMap));
    });

    unsubscribers.push(unsub);
  }

  return () => {
    unsubscribers.forEach((unsub) => unsub());
  };
}

// ── Legacy Votes (Dev Simulation) ───────────────────────

export function subscribeLegacyVotes(callback: (votes: Vote[]) => void): Unsubscribe {
  const db = getFirestoreDb();
  const q = collection(db, 'legacyVotes');

  return onSnapshot(q, (snapshot) => {
    const votes = snapshot.docs.map((d) => d.data() as Vote);
    callback(votes);
  });
}

export async function saveLegacyVote(vote: Vote): Promise<void> {
  const db = getFirestoreDb();
  await setDoc(doc(db, 'legacyVotes', vote.id), vote);
}

export async function saveLegacyVotes(votes: Vote[]): Promise<void> {
  await Promise.all(votes.map((v) => saveLegacyVote(v)));
}

export async function clearLegacyVotes(): Promise<void> {
  const db = getFirestoreDb();
  const snapshot = await getDocs(collection(db, 'legacyVotes'));
  await Promise.all(snapshot.docs.map((d) => deleteDoc(d.ref)));
}

// ── Quest State ──────────────────────────────────────────

export async function getQuestStateForUser(userId: string): Promise<QuestState> {
  const db = getFirestoreDb();
  const snap = await getDoc(doc(db, 'questStates', userId));
  if (!snap.exists()) return { progress: {} };
  const data = snap.data();
  return (data.state as QuestState) ?? { progress: {} };
}

export async function saveQuestStateForUser(userId: string, state: QuestState): Promise<void> {
  const db = getFirestoreDb();
  await setDoc(doc(db, 'questStates', userId), { state, updatedAt: Date.now() }, { merge: true });
}

// ── Beer catalogue: community submissions ───────────────

export interface BeerSubmission {
  id: string;
  name: string;
  brewery: string;
  city: string;
  /** ISO 3166-1 alpha-2 */
  country: string;
  website: string;
  note: string;
  submittedBy: string;
  createdAt: number;
  status: 'pending' | 'approved' | 'rejected';
}

export type BeerSubmissionInput = Pick<BeerSubmission, 'name' | 'brewery' | 'city' | 'country' | 'website' | 'note'>;

/** Anyone signed in can suggest a beer; it stays invisible until an admin approves it. */
export async function submitBeerSuggestion(userId: string, input: BeerSubmissionInput): Promise<void> {
  const db = getFirestoreDb();
  await addDoc(collection(db, 'beerSubmissions'), {
    ...input,
    submittedBy: userId,
    status: 'pending',
    createdAt: serverTimestamp(),
  });
}

export async function listBeerSubmissions(status: BeerSubmission['status'] = 'pending'): Promise<BeerSubmission[]> {
  const db = getFirestoreDb();
  const snap = await getDocs(query(collection(db, 'beerSubmissions'), where('status', '==', status)));
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      ...(data as Omit<BeerSubmission, 'id' | 'createdAt'>),
      createdAt: data.createdAt?.toMillis?.() ?? 0,
    };
  });
}

export interface CatalogBeer {
  id: string;
  name: string;
  brewery: string;
  city: string;
  /** ISO 3166-1 alpha-2 */
  country: string;
  color: string;
  logoUrl?: string;
}

/** Admin: publish a submission as a catalogue beer and mark it approved. */
export async function approveBeerSubmission(submissionId: string, beer: CatalogBeer): Promise<void> {
  const db = getFirestoreDb();
  await setDoc(doc(db, 'beers', beer.id), { ...beer, approvedAt: serverTimestamp(), submissionId });
  await setDoc(doc(db, 'beerSubmissions', submissionId), { status: 'approved', beerId: beer.id }, { merge: true });
}

export async function rejectBeerSubmission(submissionId: string, reason: string): Promise<void> {
  const db = getFirestoreDb();
  await setDoc(doc(db, 'beerSubmissions', submissionId), { status: 'rejected', reason }, { merge: true });
}

/** Approved community beers (small collection, live). */
export function subscribeCatalogBeers(callback: (beers: CatalogBeer[]) => void): Unsubscribe {
  const db = getFirestoreDb();
  return onSnapshot(collection(db, 'beers'), (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<CatalogBeer, 'id'>) })));
  }, () => callback([]));
}

// ── Account deletion (GDPR "right to erasure") ──────────

/**
 * Delete everything the player owns, then the auth account itself.
 * Throws `auth/requires-recent-login` if the session is too old — the UI
 * then asks the player to sign in again.
 */
export async function deleteMyAccount(uid: string, beerId: string): Promise<void> {
  const db = getFirestoreDb();
  const del = (path: string, id: string) => deleteDoc(doc(db, path, id)).catch(() => {});

  // Friendships incl. chat history
  const friends = await getDocs(query(collection(db, 'friendships'), where('userIds', 'array-contains', uid)));
  for (const f of friends.docs) {
    const msgs = await getDocs(collection(db, 'friendships', f.id, 'messages'));
    await Promise.all(msgs.docs.map((m) => deleteDoc(m.ref).catch(() => {})));
    await deleteDoc(f.ref).catch(() => {});
  }

  // Check-ins and flags
  for (const coll of ['bc_drinkVotes', 'bc_otrVotes']) {
    const mine = await getDocs(query(collection(db, coll), where('userId', '==', uid)));
    await Promise.all(mine.docs.map((d) => deleteDoc(d.ref).catch(() => {})));
  }

  // Team membership
  await setDoc(doc(db, 'bc_teams', `team_${beerId}`), { memberUserIds: arrayRemove(uid) }, { merge: true }).catch(() => {});

  await Promise.all([
    del('presence', uid),
    del('questStates', uid),
    del('bc_userStats', uid),
    del('users', uid),
  ]);
  await del('bc_users', uid);

  const current = getFirebaseAuth().currentUser;
  if (current && current.uid === uid) await deleteUser(current);
}
