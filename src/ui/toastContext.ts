import { createContext, useContext } from 'react';

export type ToastTone = 'default' | 'success' | 'error';

export interface ToastContextValue {
  showToast: (icon: string, message: string, tone?: ToastTone) => void;
}

export const ToastContext = createContext<ToastContextValue>({ showToast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}
