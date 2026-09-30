import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import {
  addDoc, arrayRemove, arrayUnion, collection, deleteDoc, doc, getDoc, getDocs, query,
  serverTimestamp, setDoc, updateDoc, where,
} from 'firebase/firestore';
import { BEER, OTHER_BEER, anonDb, createEnv, privateProfile, seed, unverifiedDb, userDb } from './helpers';

let env: RulesTestEnvironment;
beforeAll(async () => { env = await createEnv(); });
afterAll(async () => { await env.cleanup(); });
beforeEach(async () => { await env.clearFirestore(); });

describe('bc_teams', () => {
  const TEAM = `team_${BEER}`;
  beforeEach(async () => {
    await seed(env, async (db) => {
      for (const uid of ['alice', 'bob', 'carol']) await setDoc(doc(db, 'bc_users', uid), privateProfile(uid));
    });
  });
  const seedTeam = (members: string[], beerId = BEER) =>
    seed(env, (db) => setDoc(doc(db, 'bc_teams', `team_${beerId}`), { id: `team_${beerId}`, beerId, memberUserIds: members }));

  it('allows creating the team of the own beer', async () => {
    await assertSucceeds(setDoc(doc(userDb(env, 'alice'), 'bc_teams', TEAM), { id: TEAM, beerId: BEER, memberUserIds: ['alice'] }));
  });
  it('denies creating a team for another beer', async () => {
    const id = `team_${OTHER_BEER}`;
    await assertFails(setDoc(doc(userDb(env, 'alice'), 'bc_teams', id), { id, beerId: OTHER_BEER, memberUserIds: ['alice'] }));
  });
  it('denies creating a team with other members', async () => {
    await assertFails(setDoc(doc(userDb(env, 'alice'), 'bc_teams', TEAM), { id: TEAM, beerId: BEER, memberUserIds: ['alice', 'bob'] }));
  });
  it('denies creating a team without a private profile', async () => {
    await assertFails(setDoc(doc(userDb(env, 'dave'), 'bc_teams', TEAM), { id: TEAM, beerId: BEER, memberUserIds: ['dave'] }));
  });
  it('allows joining via arrayUnion(self)', async () => {
    await seedTeam(['bob']);
    await assertSucceeds(updateDoc(doc(userDb(env, 'alice'), 'bc_teams', TEAM), { memberUserIds: arrayUnion('alice') }));
  });
  it('denies joining the team of another beer', async () => {
    await seedTeam(['bob'], OTHER_BEER);
    await assertFails(updateDoc(doc(userDb(env, 'alice'), 'bc_teams', `team_${OTHER_BEER}`), { memberUserIds: arrayUnion('alice') }));
  });
  it('denies adding someone else', async () => {
    await seedTeam(['bob']);
    await assertFails(updateDoc(doc(userDb(env, 'alice'), 'bc_teams', TEAM), { memberUserIds: arrayUnion('carol') }));
  });
  it('denies joining a full team (more than 10 members)', async () => {
    await seedTeam(Array.from({ length: 10 }, (_, i) => `m${i}`));
    await assertFails(updateDoc(doc(userDb(env, 'alice'), 'bc_teams', TEAM), { memberUserIds: arrayUnion('alice') }));
  });
  it('allows leaving via arrayRemove(self)', async () => {
    await seedTeam(['alice', 'bob']);
    await assertSucceeds(updateDoc(doc(userDb(env, 'alice'), 'bc_teams', TEAM), { memberUserIds: arrayRemove('alice') }));
  });
  it('denies removing someone else', async () => {
    await seedTeam(['alice', 'bob']);
    await assertFails(updateDoc(doc(userDb(env, 'alice'), 'bc_teams', TEAM), { memberUserIds: arrayRemove('bob') }));
  });
  it('denies changing beerId', async () => {
    await seedTeam(['alice']);
    await assertFails(updateDoc(doc(userDb(env, 'alice'), 'bc_teams', TEAM), { beerId: OTHER_BEER }));
  });
  it('allows verified reads, denies unauthenticated reads', async () => {
    await seedTeam(['alice']);
    await assertSucceeds(getDoc(doc(userDb(env, 'bob'), 'bc_teams', TEAM)));
    await assertFails(getDoc(doc(anonDb(env), 'bc_teams', TEAM)));
  });
});

describe('friendships', () => {
  const FID = 'alice_bob';
  const request = (over: Record<string, unknown> = {}) => ({
    userIds: ['alice', 'bob'], status: 'pending', requestedBy: 'alice', createdAt: Date.now(), ...over,
  });
  const seedFriendship = (status: 'pending' | 'accepted') =>
    seed(env, (db) => setDoc(doc(db, 'friendships', FID), request({ status })));

  it('allows sending a request', async () => {
    await assertSucceeds(setDoc(doc(userDb(env, 'alice'), 'friendships', FID), request()));
  });
  it('allows the lexicographically larger user to send a request', async () => {
    await assertSucceeds(setDoc(doc(userDb(env, 'bob'), 'friendships', FID), request({ requestedBy: 'bob' })));
  });
  it('denies a request in someone else\'s name', async () => {
    await assertFails(setDoc(doc(userDb(env, 'alice'), 'friendships', FID), request({ requestedBy: 'bob' })));
  });
  it('denies a request between two other users', async () => {
    await assertFails(setDoc(doc(userDb(env, 'carol'), 'friendships', FID), request({ requestedBy: 'carol' })));
  });
  it('denies unsorted userIds / wrong doc id', async () => {
    await assertFails(setDoc(doc(userDb(env, 'alice'), 'friendships', 'bob_alice'), request({ userIds: ['bob', 'alice'] })));
    await assertFails(setDoc(doc(userDb(env, 'alice'), 'friendships', 'bob_alice'), request()));
  });
  it('denies creating an already accepted friendship', async () => {
    await assertFails(setDoc(doc(userDb(env, 'alice'), 'friendships', FID), request({ status: 'accepted' })));
  });
  it('denies unverified users', async () => {
    await assertFails(setDoc(doc(unverifiedDb(env, 'alice'), 'friendships', FID), request()));
  });
  it('denies the requester accepting their own request', async () => {
    await seedFriendship('pending');
    await assertFails(setDoc(doc(userDb(env, 'alice'), 'friendships', FID), { status: 'accepted' }, { merge: true }));
  });
  it('allows the recipient to accept', async () => {
    await seedFriendship('pending');
    await assertSucceeds(setDoc(doc(userDb(env, 'bob'), 'friendships', FID), { status: 'accepted' }, { merge: true }));
  });
  it('denies a third user accepting', async () => {
    await seedFriendship('pending');
    await assertFails(setDoc(doc(userDb(env, 'carol'), 'friendships', FID), { status: 'accepted' }, { merge: true }));
  });
  it('allows members to read (doc + array-contains query)', async () => {
    await seedFriendship('pending');
    await assertSucceeds(getDoc(doc(userDb(env, 'bob'), 'friendships', FID)));
    const db = userDb(env, 'alice');
    await assertSucceeds(getDocs(query(collection(db, 'friendships'), where('userIds', 'array-contains', 'alice'))));
  });
  it('denies a third user reading', async () => {
    await seedFriendship('accepted');
    await assertFails(getDoc(doc(userDb(env, 'carol'), 'friendships', FID)));
    await assertFails(getDocs(collection(userDb(env, 'carol'), 'friendships')));
  });
  it('allows members to delete, denies others', async () => {
    await seedFriendship('accepted');
    await assertFails(deleteDoc(doc(userDb(env, 'carol'), 'friendships', FID)));
    await assertSucceeds(deleteDoc(doc(userDb(env, 'bob'), 'friendships', FID)));
  });

  describe('messages', () => {
    const msgs = (uid: string) => collection(userDb(env, uid), 'friendships', FID, 'messages');

    it('allows a member of an accepted friendship to send', async () => {
      await seedFriendship('accepted');
      await assertSucceeds(addDoc(msgs('alice'), { senderId: 'alice', text: 'Prost!', createdAt: serverTimestamp() }));
    });
    it('denies sending while the friendship is pending', async () => {
      await seedFriendship('pending');
      await assertFails(addDoc(msgs('alice'), { senderId: 'alice', text: 'Prost!', createdAt: serverTimestamp() }));
    });
    it('denies a foreign senderId', async () => {
      await seedFriendship('accepted');
      await assertFails(addDoc(msgs('alice'), { senderId: 'bob', text: 'Prost!', createdAt: serverTimestamp() }));
    });
    it('denies a non-member sending', async () => {
      await seedFriendship('accepted');
      await assertFails(addDoc(msgs('carol'), { senderId: 'carol', text: 'Hi', createdAt: serverTimestamp() }));
    });
    it('denies text longer than 500 chars', async () => {
      await seedFriendship('accepted');
      await assertFails(addDoc(msgs('alice'), { senderId: 'alice', text: 'x'.repeat(501), createdAt: serverTimestamp() }));
    });
    it('allows exactly 500 chars', async () => {
      await seedFriendship('accepted');
      await assertSucceeds(addDoc(msgs('alice'), { senderId: 'alice', text: 'x'.repeat(500), createdAt: serverTimestamp() }));
    });
    it('denies a client-side createdAt', async () => {
      await seedFriendship('accepted');
      await assertFails(addDoc(msgs('alice'), { senderId: 'alice', text: 'Hi', createdAt: Date.now() }));
    });
    it('allows members to read, denies non-members', async () => {
      await seedFriendship('accepted');
      await seed(env, (db) => setDoc(doc(db, 'friendships', FID, 'messages', 'm1'), { senderId: 'alice', text: 'Hi', createdAt: new Date() }));
      await assertSucceeds(getDocs(msgs('bob')));
      await assertFails(getDocs(msgs('carol')));
      await assertFails(getDoc(doc(userDb(env, 'carol'), 'friendships', FID, 'messages', 'm1')));
    });
    it('denies editing a message', async () => {
      await seedFriendship('accepted');
      await seed(env, (db) => setDoc(doc(db, 'friendships', FID, 'messages', 'm1'), { senderId: 'alice', text: 'Hi', createdAt: new Date() }));
      await assertFails(updateDoc(doc(userDb(env, 'alice'), 'friendships', FID, 'messages', 'm1'), { text: 'edited' }));
    });
  });
});

describe('presence', () => {
  it('allows writing the own heartbeat', async () => {
    await assertSucceeds(setDoc(doc(userDb(env, 'alice'), 'presence/alice'), { lastSeen: Date.now() }, { merge: true }));
  });
  it('denies writing someone else\'s heartbeat', async () => {
    await assertFails(setDoc(doc(userDb(env, 'alice'), 'presence/bob'), { lastSeen: Date.now() }));
  });
  it('denies lastSeen far in the future', async () => {
    await assertFails(setDoc(doc(userDb(env, 'alice'), 'presence/alice'), { lastSeen: Date.now() + 24 * 3600 * 1000 }));
  });
  it('denies extra fields', async () => {
    await assertFails(setDoc(doc(userDb(env, 'alice'), 'presence/alice'), { lastSeen: Date.now(), lat: 48.1 }));
  });
  it('allows deleting the own presence, verified reads', async () => {
    await seed(env, (db) => setDoc(doc(db, 'presence/alice'), { lastSeen: Date.now() }));
    await assertSucceeds(getDocs(collection(userDb(env, 'bob'), 'presence')));
    await assertFails(getDocs(collection(anonDb(env), 'presence')));
    await assertFails(deleteDoc(doc(userDb(env, 'bob'), 'presence/alice')));
    await assertSucceeds(deleteDoc(doc(userDb(env, 'alice'), 'presence/alice')));
  });
});
