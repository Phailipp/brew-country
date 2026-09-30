import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, getDocs, collection } from 'firebase/firestore';
import {
  BEER, DAY, HOME_LAT, HOME_LON, OTHER_BEER, adminDb, anonDb, createEnv, privateProfile,
  round50, seed, unverifiedDb, userDb,
} from './helpers';

let env: RulesTestEnvironment;
beforeAll(async () => { env = await createEnv(); });
afterAll(async () => { await env.cleanup(); });
beforeEach(async () => { await env.clearFirestore(); });

// Berlin — a valid location different from the seeded home
const NEW_LAT = 52.52;
const NEW_LON = 13.405;

describe('bc_users (private profile)', () => {
  describe('create', () => {
    it('allows creating the own valid profile', async () => {
      await assertSucceeds(setDoc(doc(userDb(env, 'alice'), 'bc_users/alice'), privateProfile('alice')));
    });
    it('denies creating a profile for someone else', async () => {
      await assertFails(setDoc(doc(userDb(env, 'alice'), 'bc_users/bob'), privateProfile('bob')));
    });
    it('denies creating with id field != uid', async () => {
      await assertFails(setDoc(doc(userDb(env, 'alice'), 'bc_users/alice'), privateProfile('alice', { id: 'bob' })));
    });
    it('denies unverified users', async () => {
      await assertFails(setDoc(doc(unverifiedDb(env, 'alice'), 'bc_users/alice'), privateProfile('alice')));
    });
    it('denies unauthenticated users', async () => {
      await assertFails(setDoc(doc(anonDb(env), 'bc_users/alice'), privateProfile('alice')));
    });
    it('denies ageVerified false', async () => {
      await assertFails(setDoc(doc(userDb(env, 'alice'), 'bc_users/alice'), privateProfile('alice', { ageVerified: false })));
    });
    it('denies a backdated createdAt', async () => {
      await assertFails(setDoc(doc(userDb(env, 'alice'), 'bc_users/alice'),
        privateProfile('alice', { createdAt: Date.now() - 30 * DAY })));
    });
    it('denies an invalid beerId', async () => {
      await assertFails(setDoc(doc(userDb(env, 'alice'), 'bc_users/alice'), privateProfile('alice', { beerId: 'Bad Beer!' })));
    });
    it('allows a home anywhere in the world (Buenos Aires)', async () => {
      await assertSucceeds(setDoc(doc(userDb(env, 'alice'), 'bc_users/alice'),
        privateProfile('alice', { homeLat: -34.6037, homeLon: -58.3816 })));
    });
    it('denies a home off the map (lat 88)', async () => {
      await assertFails(setDoc(doc(userDb(env, 'alice'), 'bc_users/alice'),
        privateProfile('alice', { homeLat: 88, homeLon: 10 })));
    });
    it('denies a home on Null Island (reserved for wiped homes)', async () => {
      await assertFails(setDoc(doc(userDb(env, 'alice'), 'bc_users/alice'),
        privateProfile('alice', { homeLat: 0, homeLon: 0 })));
    });
    it('denies unknown fields', async () => {
      await assertFails(setDoc(doc(userDb(env, 'alice'), 'bc_users/alice'), privateProfile('alice', { isAdmin: true })));
    });
  });

  describe('read', () => {
    beforeEach(async () => {
      await seed(env, (db) => setDoc(doc(db, 'bc_users/alice'), privateProfile('alice')));
    });
    it('allows reading the own profile', async () => {
      await assertSucceeds(getDoc(doc(userDb(env, 'alice'), 'bc_users/alice')));
    });
    it('denies reading someone else\'s profile', async () => {
      await assertFails(getDoc(doc(userDb(env, 'bob'), 'bc_users/alice')));
    });
    it('denies listing the collection', async () => {
      await assertFails(getDocs(collection(userDb(env, 'bob'), 'bc_users')));
    });
    it('allows admins to read any profile', async () => {
      await assertSucceeds(getDoc(doc(adminDb(env), 'bc_users/alice')));
    });
  });

  describe('update', () => {
    it('allows a normal update (nickname, lastActiveAt)', async () => {
      await seed(env, (db) => setDoc(doc(db, 'bc_users/alice'), privateProfile('alice')));
      await assertSucceeds(updateDoc(doc(userDb(env, 'alice'), 'bc_users/alice'),
        { nickname: 'Ali', lastActiveAt: Date.now() }));
    });
    it('denies changing createdAt', async () => {
      await seed(env, (db) => setDoc(doc(db, 'bc_users/alice'), privateProfile('alice')));
      await assertFails(updateDoc(doc(userDb(env, 'alice'), 'bc_users/alice'),
        { createdAt: Date.now() - 60 * DAY, lastActiveAt: Date.now() }));
    });
    it('denies setting ageVerified to false', async () => {
      await seed(env, (db) => setDoc(doc(db, 'bc_users/alice'), privateProfile('alice')));
      await assertFails(updateDoc(doc(userDb(env, 'alice'), 'bc_users/alice'),
        { ageVerified: false, lastActiveAt: Date.now() }));
    });
    it('denies updating someone else\'s profile', async () => {
      await seed(env, (db) => setDoc(doc(db, 'bc_users/alice'), privateProfile('alice')));
      await assertFails(updateDoc(doc(userDb(env, 'bob'), 'bc_users/alice'), { nickname: 'x', lastActiveAt: Date.now() }));
    });
    it('denies moving home within 7 days after createdAt', async () => {
      await seed(env, (db) => setDoc(doc(db, 'bc_users/alice'), privateProfile('alice', { createdAt: Date.now() - 2 * DAY })));
      await assertFails(updateDoc(doc(userDb(env, 'alice'), 'bc_users/alice'),
        { homeLat: NEW_LAT, homeLon: NEW_LON, homeChangedAt: Date.now(), lastActiveAt: Date.now() }));
    });
    it('denies moving home within 7 days after the last move', async () => {
      await seed(env, (db) => setDoc(doc(db, 'bc_users/alice'),
        privateProfile('alice', { createdAt: Date.now() - 30 * DAY, homeChangedAt: Date.now() - 3 * DAY })));
      await assertFails(updateDoc(doc(userDb(env, 'alice'), 'bc_users/alice'),
        { homeLat: NEW_LAT, homeLon: NEW_LON, homeChangedAt: Date.now(), lastActiveAt: Date.now() }));
    });
    it('allows setting home when it was wiped to 0/0', async () => {
      await seed(env, (db) => setDoc(doc(db, 'bc_users/alice'),
        privateProfile('alice', { createdAt: Date.now() - DAY, homeLat: 0, homeLon: 0 })));
      await assertSucceeds(updateDoc(doc(userDb(env, 'alice'), 'bc_users/alice'),
        { homeLat: NEW_LAT, homeLon: NEW_LON, lastActiveAt: Date.now() }));
    });
    // Regression: the "re-set after a wipe" branch `(existing().homeLat == 0 && existing().homeLon == 0)`
    // did not check the location, so a wiped profile could be moved off the map.
    it('denies re-setting a wiped home to a place off the map', async () => {
      await seed(env, (db) => setDoc(doc(db, 'bc_users/alice'),
        privateProfile('alice', { createdAt: Date.now() - DAY, homeLat: 0, homeLon: 0 })));
      await assertFails(updateDoc(doc(userDb(env, 'alice'), 'bc_users/alice'),
        { homeLat: 88, homeLon: 2.3522, lastActiveAt: Date.now() }));
    });
    it('allows moving home with homeChangedAt≈now when createdAt is > 7 days ago', async () => {
      await seed(env, (db) => setDoc(doc(db, 'bc_users/alice'), privateProfile('alice', { createdAt: Date.now() - 8 * DAY })));
      await assertSucceeds(updateDoc(doc(userDb(env, 'alice'), 'bc_users/alice'),
        { homeLat: NEW_LAT, homeLon: NEW_LON, homeChangedAt: Date.now(), lastActiveAt: Date.now() }));
    });
    it('denies moving home without a fresh homeChangedAt', async () => {
      await seed(env, (db) => setDoc(doc(db, 'bc_users/alice'), privateProfile('alice', { createdAt: Date.now() - 8 * DAY })));
      await assertFails(updateDoc(doc(userDb(env, 'alice'), 'bc_users/alice'),
        { homeLat: NEW_LAT, homeLon: NEW_LON, lastActiveAt: Date.now() }));
    });
    it('denies moving home off the map even after 7 days', async () => {
      await seed(env, (db) => setDoc(doc(db, 'bc_users/alice'), privateProfile('alice', { createdAt: Date.now() - 8 * DAY })));
      await assertFails(updateDoc(doc(userDb(env, 'alice'), 'bc_users/alice'),
        { homeLat: 48.8566, homeLon: 200, homeChangedAt: Date.now(), lastActiveAt: Date.now() }));
    });
    // Regression: homeChangedAt itself is not protected. A user can first back-date it
    // (home unchanged → allowed), then move home immediately, bypassing the 7-day lock.
    it('denies back-dating homeChangedAt to bypass the 7-day home lock', async () => {
      await seed(env, (db) => setDoc(doc(db, 'bc_users/alice'), privateProfile('alice', { createdAt: Date.now() - DAY })));
      const db = userDb(env, 'alice');
      await assertFails(updateDoc(doc(db, 'bc_users/alice'), { homeChangedAt: 0, lastActiveAt: Date.now() }));
    });
  });
});

describe('users (public profile)', () => {
  function publicProfile(uid: string, over: Record<string, unknown> = {}) {
    return {
      userId: uid,
      beerId: BEER,
      homeLat: round50(HOME_LAT),
      homeLon: round50(HOME_LON),
      createdAt: CREATED,
      lastActiveAt: Date.now(),
      syg: true,
      ...over,
    };
  }
  const CREATED = Date.now() - 3 * DAY;
  beforeEach(async () => {
    await seed(env, async (db) => {
      await setDoc(doc(db, 'bc_users/alice'), privateProfile('alice', { createdAt: CREATED }));
      await setDoc(doc(db, 'bc_users/bob'), privateProfile('bob', { createdAt: CREATED }));
    });
  });

  it('allows a public profile consistent with the private one', async () => {
    await assertSucceeds(setDoc(doc(userDb(env, 'alice'), 'users/alice'), publicProfile('alice')));
  });
  it('denies exact (non-rounded) coordinates', async () => {
    await assertFails(setDoc(doc(userDb(env, 'alice'), 'users/alice'),
      publicProfile('alice', { homeLat: HOME_LAT, homeLon: HOME_LON })));
  });
  it('denies a lattice point too far from the private home', async () => {
    await assertFails(setDoc(doc(userDb(env, 'alice'), 'users/alice'),
      publicProfile('alice', { homeLat: round50(HOME_LAT) + 0.04 })));
  });
  it('denies a different createdAt (anti newcomer-boost cheat)', async () => {
    await assertFails(setDoc(doc(userDb(env, 'alice'), 'users/alice'),
      publicProfile('alice', { createdAt: Date.now() })));
  });
  it('denies a different beerId', async () => {
    await assertFails(setDoc(doc(userDb(env, 'alice'), 'users/alice'), publicProfile('alice', { beerId: OTHER_BEER })));
  });
  it('denies syg differing from standYourGroundEnabled', async () => {
    await assertFails(setDoc(doc(userDb(env, 'alice'), 'users/alice'), publicProfile('alice', { syg: false })));
  });
  it('denies writing someone else\'s public profile', async () => {
    await assertFails(setDoc(doc(userDb(env, 'alice'), 'users/bob'), publicProfile('bob')));
  });
  it('denies a public profile without a private profile', async () => {
    await assertFails(setDoc(doc(userDb(env, 'carol'), 'users/carol'), publicProfile('carol')));
  });
  it('allows verified users to read public profiles', async () => {
    await seed(env, (db) => setDoc(doc(db, 'users/alice'), publicProfile('alice')));
    await assertSucceeds(getDoc(doc(userDb(env, 'bob'), 'users/alice')));
    await assertSucceeds(getDocs(collection(userDb(env, 'bob'), 'users')));
  });
  it('denies unauthenticated reads', async () => {
    await seed(env, (db) => setDoc(doc(db, 'users/alice'), publicProfile('alice')));
    await assertFails(getDoc(doc(anonDb(env), 'users/alice')));
  });
  it('denies unverified reads', async () => {
    await seed(env, (db) => setDoc(doc(db, 'users/alice'), publicProfile('alice')));
    await assertFails(getDoc(doc(unverifiedDb(env, 'carol'), 'users/alice')));
  });
});
