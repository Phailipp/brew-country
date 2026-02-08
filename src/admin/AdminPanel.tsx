import { useState } from 'react';
import type { StorageInterface } from '../storage/StorageInterface';
import { SeedControls } from './SeedControls';
import { TimeControls } from './TimeControls';
import { DebugStats } from './DebugStats';
import { ManualInjectPanel } from './ManualInjectPanel';
import './AdminPanel.css';

interface Props {
  store: StorageInterface;
}

type Tab = 'seed' | 'time' | 'stats' | 'inject';

export function AdminPanel({ store }: Props) {
  const [tab, setTab] = useState<Tab>('stats');

  return (
    <div className="admin-panel">
      <header className="admin-header">
        <h1>Brew Country Admin</h1>
        <a href="/" className="admin-back">Zur App</a>
      </header>

      <nav className="admin-tabs">
        {(['stats', 'seed', 'time', 'inject'] as Tab[]).map(t => (
          <button
            key={t}
            className={`admin-tab ${tab === t ? 'active' : ''}`}
            onClick={() => setTab(t)}
          >
            {t === 'stats' ? 'Stats' : t === 'seed' ? 'Seed' : t === 'time' ? 'Time' : 'Inject'}
          </button>
        ))}
      </nav>

      <div className="admin-content">
        {tab === 'stats' && <DebugStats store={store} />}
        {tab === 'seed' && <SeedControls store={store} />}
        {tab === 'time' && <TimeControls />}
        {tab === 'inject' && <ManualInjectPanel store={store} />}
      </div>
    </div>
  );
}
