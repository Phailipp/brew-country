import { useState, useCallback, useRef, useMemo, type ReactNode } from 'react';
import { ToastContext, type ToastTone } from './toastContext';
import './Toast.css';

interface ToastItem {
  id: number;
  icon: string;
  message: string;
  tone: ToastTone;
  exiting: boolean;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const showToast = useCallback((icon: string, message: string, tone: ToastTone = 'default') => {
    const id = nextId.current++;
    setToasts((prev) => [...prev.slice(-2), { id, icon, message, tone, exiting: false }]);

    setTimeout(() => {
      setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, exiting: true } : t)));
    }, 3500);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3800);
  }, []);

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-container" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.tone}${t.exiting ? ' toast-exit' : ''}`}>
            <span className="toast-icon" aria-hidden="true">{t.icon}</span>
            <span className="toast-msg">{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
