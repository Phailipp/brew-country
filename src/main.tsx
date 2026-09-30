// Self-hosted fonts: no request to Google (GDPR), works offline
import '@fontsource-variable/inter';
import '@fontsource-variable/bricolage-grotesque/opsz.css';
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { loadBrandLogos } from './domain/beers.ts'
import { ToastProvider } from './ui/Toast.tsx'
import { AuthProvider } from './auth/AuthProvider.tsx'
import { FirestoreStore } from './storage/FirestoreStore.ts'
import { IndexedDBStore } from './storage/IndexedDBStore.ts'
import { LOCAL_AUTH_KEY, isDemoUserId } from './auth/authContext.ts'
import { ADMIN_ENABLED } from './config/env.ts'
import { installGlobalLight } from './ui/kit/globalLight.ts'
import { ErrorBoundary } from './ui/ErrorBoundary.tsx'

installGlobalLight()

// Demo users (id starts with "dev_") play in a local IndexedDB sandbox — no Firebase writes
function storedAuthKey(): string | null {
  try {
    return localStorage.getItem(LOCAL_AUTH_KEY);
  } catch {
    return null; // storage blocked (private mode, strict settings)
  }
}
const store = isDemoUserId(storedAuthKey())
  ? new IndexedDBStore()
  : new FirestoreStore();

const root = createRoot(document.getElementById('root')!);

if (ADMIN_ENABLED && window.location.hash === '#admin') {
  import('./admin/AdminPanel.tsx').then(({ AdminPanel }) => {
    root.render(
      <StrictMode>
        <AdminPanel store={store} />
      </StrictMode>,
    );
  });

  window.addEventListener('hashchange', () => location.reload());
} else {
  root.render(
    <StrictMode>
      <ErrorBoundary>
        <ToastProvider>
          <AuthProvider store={store}>
            <App store={store} />
          </AuthProvider>
        </ToastProvider>
      </ErrorBoundary>
    </StrictMode>,
  );
}

loadBrandLogos().catch(() => {});
