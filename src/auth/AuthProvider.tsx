import { useState, useEffect, useCallback, useMemo } from 'react';
import type { ReactNode } from 'react';
import {
  onAuthStateChanged,
  signOut,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  updateProfile,
  reload,
} from 'firebase/auth';
import type { AuthState, User } from '../domain/types';
import type { StorageInterface } from '../storage/StorageInterface';
import { isFirebaseConfigured } from '../config/firebase';
import { getFirebaseAuth } from '../config/firebaseAuth';
import { AuthContext, LOCAL_AUTH_KEY, isDemoUserId, type AuthContextValue } from './authContext';

interface Props {
  children: ReactNode;
  store: StorageInterface;
}

function initialAuthState(): AuthState {
  // Without Firebase and without a saved session there is nothing to wait for
  if (!isFirebaseConfigured() && !localStorage.getItem(LOCAL_AUTH_KEY)) {
    return { status: 'unauthenticated' };
  }
  return { status: 'loading' };
}

export function AuthProvider({ children, store }: Props) {
  const [auth, setAuth] = useState<AuthState>(initialAuthState);

  /** Resolve a user id to authenticated / onboarding. Never leaves us stuck on "loading". */
  const resolveUser = useCallback((userId: string) => {
    store.getUser(userId).then(
      (user) => setAuth(user
        ? { status: 'authenticated', userId: user.id, user }
        : { status: 'onboarding', userId }),
      () => setAuth({ status: 'onboarding', userId }),
    );
  }, [store]);

  useEffect(() => {
    const savedId = localStorage.getItem(LOCAL_AUTH_KEY);

    // Demo sessions live entirely in the local sandbox
    if (isDemoUserId(savedId)) {
      resolveUser(savedId!);
      return;
    }

    if (isFirebaseConfigured()) {
      // Never leave people staring at a spinner when Firebase is unreachable;
      // a late auth event still upgrades the state.
      const fallback = setTimeout(() => {
        setAuth((prev) => (prev.status === 'loading' ? { status: 'unauthenticated' } : prev));
      }, 8000);
      const unsubscribe = onAuthStateChanged(getFirebaseAuth(), (firebaseUser) => {
        clearTimeout(fallback);
        if (!firebaseUser) {
          // Never clobber a demo session that was started in the meantime
          if (!isDemoUserId(localStorage.getItem(LOCAL_AUTH_KEY))) localStorage.removeItem(LOCAL_AUTH_KEY);
          setAuth({ status: 'unauthenticated' });
          return;
        }

        if (!firebaseUser.emailVerified) {
          setAuth({
            status: 'verify-email',
            userId: firebaseUser.uid,
            email: firebaseUser.email ?? '',
            nickname: firebaseUser.displayName ?? '',
          });
          return;
        }

        localStorage.setItem(LOCAL_AUTH_KEY, firebaseUser.uid);
        resolveUser(firebaseUser.uid);
      });
      return () => {
        clearTimeout(fallback);
        unsubscribe();
      };
    }

    if (savedId) resolveUser(savedId);
  }, [resolveUser]);

  const register = useCallback(async (email: string, password: string, nickname: string) => {
    const cred = await createUserWithEmailAndPassword(getFirebaseAuth(), email, password);
    await updateProfile(cred.user, { displayName: nickname });
    await sendEmailVerification(cred.user);
    setAuth({ status: 'verify-email', userId: cred.user.uid, email, nickname });
  }, []);

  const login = useCallback((userId: string) => {
    const wasDemo = isDemoUserId(localStorage.getItem(LOCAL_AUTH_KEY));
    localStorage.setItem(LOCAL_AUTH_KEY, userId);
    // The storage backend is chosen at boot (main.tsx). Switching into the
    // demo sandbox therefore needs a reload, otherwise demo data would be
    // written to the production database.
    if (isDemoUserId(userId) && !wasDemo) {
      window.location.reload();
      return;
    }
    resolveUser(userId);
  }, [resolveUser]);

  const loginWithEmail = useCallback(async (email: string, password: string) => {
    const cred = await signInWithEmailAndPassword(getFirebaseAuth(), email, password);
    if (!cred.user.emailVerified) {
      setAuth({
        status: 'verify-email',
        userId: cred.user.uid,
        email: cred.user.email ?? email,
        nickname: cred.user.displayName ?? '',
      });
    }
  }, []);

  const resendVerificationEmail = useCallback(async () => {
    const current = getFirebaseAuth().currentUser;
    if (!current) throw new Error('Kein aktiver Benutzer');
    await sendEmailVerification(current);
  }, []);

  const refreshVerificationStatus = useCallback(async () => {
    const current = getFirebaseAuth().currentUser;
    if (!current) {
      setAuth({ status: 'unauthenticated' });
      return;
    }

    await reload(current);
    if (!current.emailVerified) {
      setAuth({
        status: 'verify-email',
        userId: current.uid,
        email: current.email ?? '',
        nickname: current.displayName ?? '',
      });
      return;
    }

    resolveUser(current.uid);
  }, [resolveUser]);

  const completeOnboarding = useCallback(async (user: User) => {
    // Real accounts must be persisted; only the demo sandbox may continue offline
    try {
      await store.saveUser(user);
    } catch (err) {
      if (!isDemoUserId(user.id)) throw err;
    }
    localStorage.setItem(LOCAL_AUTH_KEY, user.id);
    setAuth({ status: 'authenticated', userId: user.id, user });
  }, [store]);

  const updateUser = useCallback(async (user: User) => {
    await store.saveUser(user);
    setAuth({ status: 'authenticated', userId: user.id, user });
  }, [store]);

  const logout = useCallback(() => {
    const wasDemo = isDemoUserId(localStorage.getItem(LOCAL_AUTH_KEY));
    localStorage.removeItem(LOCAL_AUTH_KEY);
    if (isFirebaseConfigured()) {
      signOut(getFirebaseAuth()).catch(() => {});
    }
    if (wasDemo) {
      window.location.reload();
      return;
    }
    setAuth({ status: 'unauthenticated' });
  }, []);

  const updateLastActive = useCallback(async () => {
    if (auth.status !== 'authenticated') return;
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    if (now - auth.user.lastActiveAt < dayMs) return;
    const updatedUser = { ...auth.user, lastActiveAt: now };
    await store.saveUser(updatedUser);
    setAuth({ status: 'authenticated', userId: updatedUser.id, user: updatedUser });
  }, [auth, store]);

  const value = useMemo<AuthContextValue>(() => ({
    auth,
    login,
    register,
    loginWithEmail,
    resendVerificationEmail,
    refreshVerificationStatus,
    completeOnboarding,
    updateUser,
    logout,
    updateLastActive,
  }), [
    auth, login, register, loginWithEmail, resendVerificationEmail,
    refreshVerificationStatus, completeOnboarding, updateUser, logout, updateLastActive,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
