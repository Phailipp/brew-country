import { browserLocalPersistence, indexedDBLocalPersistence, initializeAuth, type Auth } from 'firebase/auth';
import { getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { firebaseConfig, isFirebaseConfigured } from './firebase';

let app: FirebaseApp | null = null;
let auth: Auth | null = null;

function getOrInitApp(): FirebaseApp {
  if (!isFirebaseConfigured()) {
    throw new Error('Firebase is not configured — cannot use Firebase Auth');
  }

  if (!app) {
    app = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);
  }

  return app;
}

export function getFirebaseAuth(): Auth {
  if (!auth) {
    // Email/password only: no popup/redirect resolver, so Firebase does not
    // load scripts from apis.google.com (privacy, CSP) on every start.
    auth = initializeAuth(getOrInitApp(), {
      persistence: [indexedDBLocalPersistence, browserLocalPersistence],
    });
  }
  return auth;
}
