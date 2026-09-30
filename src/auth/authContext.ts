import { createContext, useContext } from 'react';
import type { AuthState, User } from '../domain/types';

export interface AuthContextValue {
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

export const AuthContext = createContext<AuthContextValue | null>(null);

export const LOCAL_AUTH_KEY = 'brewcountry_auth';

/** Demo users (id prefix `dev_`) play in a local sandbox without Firebase. */
export const isDemoUserId = (id: string | null | undefined): boolean => !!id && id.startsWith('dev_');

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
