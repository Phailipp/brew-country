/**
 * Firestore service layer.
 * All Firestore reads/writes are encapsulated here —
 * no UI component should import Firestore directly.
 */
import {
  collection,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  addDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  type Unsubscribe,
  type DocumentData,
} from 'firebase/firestore';
import { getFirestoreDb } from '../config/firestore';
import { GAME } from '../config/constants';
import type { Friendship, ChatMessage, UserPresence } from '../domain/types';

// ── User Profiles ───────────────────────────────────────

/**
 * Public user profile stored in Firestore.
 * Contains all fields needed for map dominance + friend display.
 */
export interface FirestoreUserProfile {
  userId: string;
  beerId: string;
  homeLat: number;
  homeLon: number;
  createdAt: number;
  lastActiveAt: number;
}

/**
 * Save or update a user's public profile in Firestore.
 * Called during onboarding and on each app load.
 */
export async function saveUserProfile(
  userId: string,
  beerId: string,
  homeLat?: number,
  homeLon?: number,
): Promise<void> {
  const db = getFirestoreDb();
  const data: Record<string, unknown> = {
    userId,
    beerId,
    lastActiveAt: Date.now(),
  };
  // Only set location + createdAt on first write (onboarding)
  if (homeLat !== undefined && homeLon !== undefined) {
    data.homeLat = homeLat;
    data.homeLon = homeLon;
    data.createdAt = Date.now();
  }
  await setDoc(doc(db, 'users', userId), data, { merge: true });
}

/**
 * Fetch a user's public profile from Firestore.
 */
export async function getUserProfile(userId: string): Promise<FirestoreUserProfile | null> {
  const db = getFirestoreDb();
  const snap = await getDoc(doc(db, 'users', userId));
  if (!snap.exists()) return null;
  const data = snap.data();
  return {
    userId: data.userId as string,
    beerId: data.beerId as string,
    homeLat: (data.homeLat as number) ?? 0,
    homeLon: (data.homeLon as number) ?? 0,
    createdAt: (data.createdAt as number) ?? 0,
    lastActiveAt: (data.lastActiveAt as number) ?? 0,
  };
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
      .map((d) => {
        const data = d.data();
        return {
          userId: data.userId as string,
          beerId: data.beerId as string,
          homeLat: (data.homeLat as number) ?? 0,
          homeLon: (data.homeLon as number) ?? 0,
          createdAt: (data.createdAt as number) ?? 0,
          lastActiveAt: (data.lastActiveAt as number) ?? 0,
        };
      })
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
    limit(GAME.CHAT_PAGE_SIZE),
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
