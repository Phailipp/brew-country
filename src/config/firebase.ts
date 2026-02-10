/**
 * Firebase configuration placeholder.
 * Replace these values with your actual Firebase project config.
 *
 * To set up:
 * 1. Create a Firebase project at https://console.firebase.google.com
 * 2. Enable Google Authentication
 * 3. Enable Firestore and Storage
 * 4. Copy your web app config here
 */
export const firebaseConfig = {
  apiKey: 'AIzaSyCfUwX7qFRv1r7017beAaEj6yeooieG9xw',
  authDomain: 'brew-country.firebaseapp.com',
  projectId: 'brew-country',
  storageBucket: 'brew-country.firebasestorage.app',
  messagingSenderId: '60569944098',
  appId: '1:60569944098:web:727b01bea7522485b18a7b',
};

/**
 * Returns true if Firebase is configured with real credentials.
 */
export function isFirebaseConfigured(): boolean {
  return firebaseConfig.apiKey !== 'YOUR_API_KEY';
}
