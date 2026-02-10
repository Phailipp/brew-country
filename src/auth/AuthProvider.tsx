import { createContext, useContext, useState, useEffect, useCallback } from 'react';
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

interface AuthContextValue {
  auth: AuthState;
  login: (userId: string) => void;
  register: (email: string, password: string, nickname: string) => Promise<void>;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  resendVerificationEmail: () => Promise<void>;
  refreshVerificationStatus: () => Promise<void>;
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

export function AuthProvider({ children, store }: Props) {
  const [auth, setAuth] = useState<AuthState>({ status: 'loading' });

  useEffect(() => {
    if (isFirebaseConfigured()) {
      const firebaseAuth = getFirebaseAuth();
      const unsubscribe = onAuthStateChanged(firebaseAuth, (firebaseUser) => {
        if (!firebaseUser) {
          localStorage.removeItem(LOCAL_AUTH_KEY);
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

  const register = useCallback(async (email: string, password: string, nickname: string) => {
    const firebaseAuth = getFirebaseAuth();
    const cred = await createUserWithEmailAndPassword(firebaseAuth, email, password);
    await updateProfile(cred.user, { displayName: nickname });
    await sendEmailVerification(cred.user);
    setAuth({
      status: 'verify-email',
      userId: cred.user.uid,
      email,
      nickname,
    });
  }, []);

  const login = useCallback((userId: string) => {
    localStorage.setItem(LOCAL_AUTH_KEY, userId);
    store.getUser(userId).then((user) => {
      if (user) {
        setAuth({ status: 'authenticated', userId: user.id, user });
      } else {
        setAuth({ status: 'onboarding', userId });
      }
    });
  }, [store]);

  const loginWithEmail = useCallback(async (email: string, password: string) => {
    const firebaseAuth = getFirebaseAuth();
    const cred = await signInWithEmailAndPassword(firebaseAuth, email, password);
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

    const user = await store.getUser(current.uid);
    if (user) {
      setAuth({ status: 'authenticated', userId: user.id, user });
    } else {
      setAuth({ status: 'onboarding', userId: current.uid });
    }
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
    if (now - auth.user.lastActiveAt < dayMs) return;
    const updatedUser = { ...auth.user, lastActiveAt: now };
    await store.saveUser(updatedUser);
    setAuth({ status: 'authenticated', userId: updatedUser.id, user: updatedUser });
  }, [auth, store]);

  return (
    <AuthContext.Provider
      value={{
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
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
