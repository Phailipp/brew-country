import { createContext, useContext, useState, useCallback, useRef, type ReactNode } from 'react';
import './Toast.css';

interface ToastItem {
  id: number;
  icon: string;
  message: string;
  exiting: boolean;
}

interface ToastContextValue {
  showToast: (icon: string, message: string) => void;
}

const ToastContext = createContext<ToastContextValue>({ showToast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const showToast = useCallback((icon: string, message: string) => {
    const id = nextId.current++;
    setToasts((prev) => [...prev, { id, icon, message, exiting: false }]);

    // Start exit animation after 3.5s
    setTimeout(() => {
      setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, exiting: true } : t)));
    }, 3500);

    // Remove after exit animation
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3800);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="toast-container">
        {toasts.map((t) => (
          <div key={t.id} className={`toast${t.exiting ? ' toast-exit' : ''}`}>
            <span className="toast-icon">{t.icon}</span>
            <span className="toast-msg">{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
