/**
 * Firebase configuration placeholder.
 * Replace these values with your actual Firebase project config.
 *
 * To set up:
 * 1. Create a Firebase project at https://console.firebase.google.com
 * 2. Enable Phone Authentication
 * 3. Enable Firestore and Storage
 * 4. Copy your web app config here
 */
export const firebaseConfig = {
  apiKey: 'YOUR_API_KEY',
  authDomain: 'YOUR_PROJECT.firebaseapp.com',
  projectId: 'YOUR_PROJECT',
  storageBucket: 'YOUR_PROJECT.appspot.com',
  messagingSenderId: '000000000000',
  appId: '1:000000000000:web:0000000000000000000000',
};

/**
 * Returns true if Firebase is configured with real credentials.
 */
export function isFirebaseConfigured(): boolean {
  return firebaseConfig.apiKey !== 'YOUR_API_KEY';
}
