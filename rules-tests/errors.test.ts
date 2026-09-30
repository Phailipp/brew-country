import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { addDoc, collection, getDocs, serverTimestamp, Timestamp } from 'firebase/firestore';
import { adminDb, anonDb, createEnv, unverifiedDb, userDb } from './helpers';

let env: RulesTestEnvironment;
beforeAll(async () => { env = await createEnv(); });
afterAll(async () => { await env.cleanup(); });
beforeEach(async () => { await env.clearFirestore(); });

const report = (over: Record<string, unknown> = {}) => ({
  kind: 'error', message: 'TypeError: x is undefined', stack: 'at App', version: '1.0.0+abc', ua: 'Mozilla/5.0', at: serverTimestamp(),
  expiresAt: Timestamp.fromMillis(Date.now() + 30 * 86_400_000), ...over,
});

describe('bc_clientErrors', () => {
  it('lets signed-in players report a crash', async () => {
    await assertSucceeds(addDoc(collection(userDb(env, 'alice'), 'bc_clientErrors'), report()));
  });
  it('denies anonymous and unverified reports, and reports without expiry', async () => {
    await assertFails(addDoc(collection(anonDb(env), 'bc_clientErrors'), report()));
    await assertFails(addDoc(collection(unverifiedDb(env, 'eve'), 'bc_clientErrors'), report()));
    await assertFails(addDoc(collection(userDb(env, 'alice'), 'bc_clientErrors'), report({ expiresAt: Timestamp.fromMillis(Date.now() + 365 * 86_400_000) })));
  });
  it('denies oversized messages and extra fields (e.g. a user id or location)', async () => {
    const db = userDb(env, 'alice');
    await assertFails(addDoc(collection(db, 'bc_clientErrors'), report({ message: 'x'.repeat(501) })));
    await assertFails(addDoc(collection(db, 'bc_clientErrors'), report({ uid: 'alice' })));
    await assertFails(addDoc(collection(db, 'bc_clientErrors'), report({ lat: 48.1 })));
    await assertFails(addDoc(collection(db, 'bc_clientErrors'), report({ kind: 'spam' })));
    await assertFails(addDoc(collection(db, 'bc_clientErrors'), report({ at: Date.now() })));
  });
  it('is readable by admins only', async () => {
    await addDoc(collection(userDb(env, 'alice'), 'bc_clientErrors'), report());
    await assertFails(getDocs(collection(userDb(env, 'bob'), 'bc_clientErrors')));
    await assertSucceeds(getDocs(collection(adminDb(env), 'bc_clientErrors')));
  });
});
