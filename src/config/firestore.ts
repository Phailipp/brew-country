/**
 * Lazy Firestore singleton.
 * Only initializes Firebase when isFirebaseConfigured() returns true.
 */
import { getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { firebaseConfig, isFirebaseConfigured } from './firebase';

let app: FirebaseApp | null = null;
let db: Firestore | null = null;

/**
 * Returns a Firestore instance. Throws if Firebase is not configured.
 */
export function getFirestoreDb(): Firestore {
  if (!isFirebaseConfigured()) {
    throw new Error('Firebase is not configured — cannot use Firestore');
  }
  if (!db) {
    app = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);
    db = getFirestore(app);
  }
  return db;
}

/**
 * Returns the Firebase app instance, or null if not initialized.
 */
export function getFirebaseApp(): FirebaseApp | null {
  return app;
}
