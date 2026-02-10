import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import type { AuthState, User } from '../domain/types';
import type { StorageInterface } from '../storage/StorageInterface';
import { isFirebaseConfigured } from '../config/firebase';
import { getFirebaseAuth } from '../config/firebaseAuth';

interface AuthContextValue {
  auth: AuthState;
  login: (userId: string) => void;
  completeOnboarding: (user: User) => Promise<void>;
  updateUser: (user: User) => Promise<void>;
  logout: () => void;
  updateLastActive: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const LOCAL_AUTH_KEY = 'brewcountry_auth';

interface Props {
  children: ReactNode;
  store: StorageInterface;
}

/**
 * Auth provider using Google login (Firebase Auth).
 * Keeps localStorage user id for backward-compatible session restoration.
 */
export function AuthProvider({ children, store }: Props) {
  const [auth, setAuth] = useState<AuthState>({ status: 'loading' });

  // Check for existing session on mount
  useEffect(() => {
    if (isFirebaseConfigured()) {
      const auth = getFirebaseAuth();
      const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
        if (!firebaseUser) {
          localStorage.removeItem(LOCAL_AUTH_KEY);
          setAuth({ status: 'unauthenticated' });
          return;
        }

        const uid = firebaseUser.uid;
        localStorage.setItem(LOCAL_AUTH_KEY, uid);
        store.getUser(uid).then((user) => {
          if (user) {
            setAuth({ status: 'authenticated', userId: user.id, user });
          } else {
            setAuth({ status: 'onboarding', userId: uid });
          }
        });
      });

      return () => unsubscribe();
    }

    const savedId = localStorage.getItem(LOCAL_AUTH_KEY);
    if (!savedId) {
      setAuth({ status: 'unauthenticated' });
      return;
    }

    store.getUser(savedId).then((user) => {
      if (user) {
        setAuth({ status: 'authenticated', userId: user.id, user });
      } else {
        setAuth({ status: 'onboarding', userId: savedId });
      }
    });
  }, [store]);

  const login = useCallback((userId: string) => {
    localStorage.setItem(LOCAL_AUTH_KEY, userId);
    // Check if user has completed onboarding
    store.getUser(userId).then(user => {
      if (user) {
        setAuth({ status: 'authenticated', userId: user.id, user });
      } else {
        setAuth({ status: 'onboarding', userId });
      }
    });
  }, [store]);

  const completeOnboarding = useCallback(async (user: User) => {
    await store.saveUser(user);
    localStorage.setItem(LOCAL_AUTH_KEY, user.id);
    setAuth({ status: 'authenticated', userId: user.id, user });
  }, [store]);

  const updateUser = useCallback(async (user: User) => {
    await store.saveUser(user);
    setAuth({ status: 'authenticated', userId: user.id, user });
  }, [store]);

  const logout = useCallback(() => {
    localStorage.removeItem(LOCAL_AUTH_KEY);
    if (isFirebaseConfigured()) {
      signOut(getFirebaseAuth()).catch(() => {});
    }
    setAuth({ status: 'unauthenticated' });
  }, []);

  const updateLastActive = useCallback(async () => {
    if (auth.status !== 'authenticated') return;
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    // Only update once per day
    if (now - auth.user.lastActiveAt < dayMs) return;
    const updatedUser = { ...auth.user, lastActiveAt: now };
    await store.saveUser(updatedUser);
    setAuth({ status: 'authenticated', userId: updatedUser.id, user: updatedUser });
  }, [auth, store]);

  return (
    <AuthContext.Provider value={{ auth, login, completeOnboarding, updateUser, logout, updateLastActive }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
