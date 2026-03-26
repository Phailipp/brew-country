import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ToastProvider } from './ui/Toast.tsx'
import { AuthProvider } from './auth/AuthProvider.tsx'
import { FirestoreStore } from './storage/FirestoreStore.ts'
import { IndexedDBStore } from './storage/IndexedDBStore.ts'

// Dev-bypass users (id starts with "dev_") use local IndexedDB — no Firebase needed
const savedUserId = localStorage.getItem('brewcountry_auth');
const isDevUser = savedUserId?.startsWith('dev_') ?? false;
const store = isDevUser ? new IndexedDBStore() : new FirestoreStore();

const isAdmin = window.location.hash === '#admin';

if (isAdmin) {
  import('./admin/AdminPanel.tsx').then(({ AdminPanel }) => {
    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <AdminPanel store={store} />
      </StrictMode>,
    );
  });

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
