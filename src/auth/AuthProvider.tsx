import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import type { AuthState, User } from '../domain/types';
import type { StorageInterface } from '../storage/StorageInterface';

interface AuthContextValue {
  auth: AuthState;
  login: (userId: string, phone: string) => void;
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
 * Auth provider using local anonymous auth.
 * User ID is derived from the phone number and stored in localStorage.
 * Firebase is used only for Firestore (friends, chat, presence).
 */
export function AuthProvider({ children, store }: Props) {
  const [auth, setAuth] = useState<AuthState>({ status: 'loading' });

  // Check for existing session on mount
  useEffect(() => {
    const init = async () => {
      // Local auth: check localStorage
      const savedId = localStorage.getItem(LOCAL_AUTH_KEY);
      if (savedId) {
        const user = await store.getUser(savedId);
        if (user) {
          setAuth({ status: 'authenticated', userId: user.id, user });
          return;
        }
        // User ID saved but no user record — needs onboarding
        setAuth({ status: 'onboarding', userId: savedId });
        return;
      }

      setAuth({ status: 'unauthenticated' });
    };

    init();
  }, [store]);

  const login = useCallback((userId: string, _phone: string) => {
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
