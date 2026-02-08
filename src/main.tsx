import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ToastProvider } from './ui/Toast.tsx'
import { AuthProvider } from './auth/AuthProvider.tsx'
import { IndexedDBStore } from './storage/IndexedDBStore.ts'

const store = new IndexedDBStore();

const isAdmin = import.meta.env.DEV && window.location.hash === '#admin';

if (isAdmin) {
  // Lazy-load admin panel (DEV only)
  import('./admin/AdminPanel.tsx').then(({ AdminPanel }) => {
    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <AdminPanel store={store} />
      </StrictMode>,
    );
  });

  // Reload on hash change to switch between admin/app
  window.addEventListener('hashchange', () => location.reload());
} else {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <ToastProvider>
        <AuthProvider store={store}>
          <App store={store} />
        </AuthProvider>
      </ToastProvider>
    </StrictMode>,
  );
}
