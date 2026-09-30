import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import {
  addDoc, collection, doc, getDoc, getDocs, query, serverTimestamp, setDoc, where,
} from 'firebase/firestore';
import { adminDb, anonDb, createEnv, seed, unverifiedDb, userDb } from './helpers';

let env: RulesTestEnvironment;
beforeAll(async () => { env = await createEnv(); });
afterAll(async () => { await env.cleanup(); });
beforeEach(async () => { await env.clearFirestore(); });

function submission(uid: string, over: Record<string, unknown> = {}) {
  return {
    name: 'Klosterbräu Dunkel',
    brewery: 'Klosterbrauerei',
    city: 'Bamberg',
    country: 'DE',
    website: '',
    note: 'Sehr lecker',
    submittedBy: uid,
    status: 'pending',
    createdAt: serverTimestamp(),
    ...over,
  };
}
const seedSubmission = (id: string, uid: string) =>
  seed(env, (db) => setDoc(doc(db, 'beerSubmissions', id), { ...submission(uid), createdAt: new Date() }));

describe('beerSubmissions', () => {
  it('allows a valid submission', async () => {
    await assertSucceeds(addDoc(collection(userDb(env, 'alice'), 'beerSubmissions'), submission('alice')));
  });
  it('denies self-approval (status approved)', async () => {
    await assertFails(addDoc(collection(userDb(env, 'alice'), 'beerSubmissions'), submission('alice', { status: 'approved' })));
  });
  it('denies a foreign submittedBy', async () => {
    await assertFails(addDoc(collection(userDb(env, 'alice'), 'beerSubmissions'), submission('bob')));
  });
  it('denies a name longer than 60 chars', async () => {
    await assertFails(addDoc(collection(userDb(env, 'alice'), 'beerSubmissions'), submission('alice', { name: 'x'.repeat(61) })));
  });
  it('allows any ISO country code', async () => {
    await assertSucceeds(addDoc(collection(userDb(env, 'alice'), 'beerSubmissions'), submission('alice', { country: 'JP' })));
  });
  it('denies a malformed country code', async () => {
    await assertFails(addDoc(collection(userDb(env, 'alice'), 'beerSubmissions'), submission('alice', { country: 'Japan' })));
  });
  it('denies a client-side createdAt', async () => {
    await assertFails(addDoc(collection(userDb(env, 'alice'), 'beerSubmissions'), submission('alice', { createdAt: Date.now() })));
  });
  it('denies unverified users', async () => {
    await assertFails(addDoc(collection(unverifiedDb(env, 'alice'), 'beerSubmissions'), submission('alice')));
  });
  it('allows reading the own submission (doc + filtered query)', async () => {
    await seedSubmission('s1', 'alice');
    const db = userDb(env, 'alice');
    await assertSucceeds(getDoc(doc(db, 'beerSubmissions/s1')));
    await assertSucceeds(getDocs(query(collection(db, 'beerSubmissions'), where('submittedBy', '==', 'alice'))));
  });
  it('denies reading someone else\'s submission', async () => {
    await seedSubmission('s1', 'alice');
    await assertFails(getDoc(doc(userDb(env, 'bob'), 'beerSubmissions/s1')));
    await assertFails(getDocs(query(collection(userDb(env, 'bob'), 'beerSubmissions'), where('status', '==', 'pending'))));
  });
  it('denies a user updating the status', async () => {
    await seedSubmission('s1', 'alice');
    await assertFails(setDoc(doc(userDb(env, 'alice'), 'beerSubmissions/s1'), { status: 'approved' }, { merge: true }));
  });
  it('allows an admin to list all pending submissions and approve one', async () => {
    await seedSubmission('s1', 'alice');
    await seedSubmission('s2', 'bob');
    const db = adminDb(env);
    await assertSucceeds(getDocs(query(collection(db, 'beerSubmissions'), where('status', '==', 'pending'))));
    await assertSucceeds(setDoc(doc(db, 'beerSubmissions/s1'), { status: 'approved', beerId: 'klosterbraeu-dunkel' }, { merge: true }));
  });
});

describe('beers (catalogue)', () => {
  const beer = { id: 'klosterbraeu-dunkel', name: 'Klosterbräu Dunkel', brewery: 'Klosterbrauerei', city: 'Bamberg', country: 'DE', color: '#5a3' };
  it('everyone can read, including unauthenticated', async () => {
    await seed(env, (db) => setDoc(doc(db, 'beers', beer.id), beer));
    await assertSucceeds(getDoc(doc(anonDb(env), 'beers', beer.id)));
    await assertSucceeds(getDocs(collection(anonDb(env), 'beers')));
    await assertSucceeds(getDoc(doc(userDb(env, 'alice'), 'beers', beer.id)));
  });
  it('denies users writing', async () => {
    await assertFails(setDoc(doc(userDb(env, 'alice'), 'beers', beer.id), beer));
  });
  it('allows admins writing', async () => {
    await assertSucceeds(setDoc(doc(adminDb(env), 'beers', beer.id), { ...beer, approvedAt: serverTimestamp() }));
  });
});

describe('admin-only & default deny', () => {
  it('legacyVotes: user write ✗, admin write ✓, verified read ✓', async () => {
    await assertFails(setDoc(doc(userDb(env, 'alice'), 'legacyVotes/l1'), { x: 1 }));
    await assertSucceeds(setDoc(doc(adminDb(env), 'legacyVotes/l1'), { x: 1 }));
    await assertSucceeds(getDoc(doc(userDb(env, 'alice'), 'legacyVotes/l1')));
  });
  it('bc_duelOutcomes: user write ✗, admin write ✓', async () => {
    const outcome = { winnerUserId: 'alice', expiresAt: Date.now() + 3600_000 };
    await assertFails(setDoc(doc(userDb(env, 'alice'), 'bc_duelOutcomes/o1'), outcome));
    await assertSucceeds(setDoc(doc(adminDb(env), 'bc_duelOutcomes/o1'), outcome));
  });
  it('unknown collections are denied (even for admins)', async () => {
    await assertFails(setDoc(doc(userDb(env, 'alice'), 'secrets/s1'), { a: 1 }));
    await assertFails(getDoc(doc(userDb(env, 'alice'), 'secrets/s1')));
    await assertFails(setDoc(doc(adminDb(env), 'secrets/s1'), { a: 1 }));
  });
  it('questStates: owner only', async () => {
    await assertSucceeds(setDoc(doc(userDb(env, 'alice'), 'questStates/alice'), { q: 1 }));
    await assertFails(setDoc(doc(userDb(env, 'alice'), 'questStates/bob'), { q: 1 }));
    await assertFails(getDoc(doc(userDb(env, 'bob'), 'questStates/alice')));
  });
});
