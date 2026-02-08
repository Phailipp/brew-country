/**
 * Firestore service layer.
 * All Firestore reads/writes are encapsulated here —
 * no UI component should import Firestore directly.
 */
import {
  collection,
  doc,
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
 * Create a friendship between two users.
 * Writes to Firestore `friendships/{id}`.
 */
export async function addFriend(myUserId: string, friendUserId: string): Promise<Friendship> {
  const db = getFirestoreDb();
  const sorted = [myUserId, friendUserId].sort() as [string, string];
  const id = makeFriendshipId(myUserId, friendUserId);

  const friendship: Friendship = {
    id,
    userIds: sorted,
    createdAt: Date.now(),
  };

  await setDoc(doc(db, 'friendships', id), {
    userIds: sorted,
    createdAt: friendship.createdAt,
  });

  return friendship;
}

/**
 * Remove a friendship.
 * Deletes the Firestore document. Subcollection messages remain (Firestore behavior).
 */
export async function removeFriend(myUserId: string, friendUserId: string): Promise<void> {
  const db = getFirestoreDb();
  const id = makeFriendshipId(myUserId, friendUserId);
  await deleteDoc(doc(db, 'friendships', id));
}

/**
 * Subscribe to all friendships for a user (real-time).
 * Uses `array-contains` on the `userIds` field.
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
