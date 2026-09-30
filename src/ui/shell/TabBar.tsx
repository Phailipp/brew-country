import type { ReactNode } from 'react';
import './TabBar.css';

export type TabId = 'explore' | 'crew' | 'quests' | 'profile';

interface Tab {
  id: TabId;
  label: string;
  icon: ReactNode;
  badge?: boolean;
}

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

const ICONS: Record<TabId, ReactNode> = {
  explore: (
    <svg viewBox="0 0 24 24" {...stroke}><path d="M9 3 3 5.5v15L9 18l6 3 6-2.5v-15L15 6 9 3Z" /><path d="M9 3v15M15 6v15" /></svg>
  ),
  crew: (
    <svg viewBox="0 0 24 24" {...stroke}><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5" /><path d="M16 4.8a3.5 3.5 0 0 1 0 6.4M18 14.8c1.9.8 3 2.5 3.5 5.2" /></svg>
  ),
  quests: (
    <svg viewBox="0 0 24 24" {...stroke}><path d="M7 4h10v5a5 5 0 0 1-10 0V4Z" /><path d="M7 6H4v1.5A3.5 3.5 0 0 0 7.5 11M17 6h3v1.5a3.5 3.5 0 0 1-3.5 3.5M12 14v4M8 21h8" /></svg>
  ),
  profile: (
    <svg viewBox="0 0 24 24" {...stroke}><circle cx="12" cy="8" r="4" /><path d="M4 21c1-4.4 4.2-6.5 8-6.5s7 2.1 8 6.5" /></svg>
  ),
};

interface Props {
  active: TabId | null;
  onSelect: (id: TabId) => void;
  onProst: () => void;
  prostActive: boolean;
  unreadCrew: boolean;
  questsDone: number;
}

export function TabBar({ active, onSelect, onProst, prostActive, unreadCrew, questsDone }: Props) {
  const tabs: Tab[] = [
    { id: 'explore', label: 'Entdecken', icon: ICONS.explore },
    { id: 'crew', label: 'Crew', icon: ICONS.crew, badge: unreadCrew },
    { id: 'quests', label: 'Quests', icon: ICONS.quests },
    { id: 'profile', label: 'Profil', icon: ICONS.profile },
  ];

  const renderTab = (tab: Tab) => (
    <button
      key={tab.id}
      role="tab"
      aria-selected={active === tab.id}
      className={`tab${active === tab.id ? ' active' : ''}`}
      onClick={() => onSelect(tab.id)}
    >
      <span className="tab-icon" aria-hidden="true">{tab.icon}</span>
      <span className="tab-label">{tab.label}</span>
      {tab.badge && <span className="tab-badge" aria-label="Ungelesene Nachrichten" />}
      {tab.id === 'quests' && questsDone > 0 && (
        <span className="tab-count num" aria-label={`${questsDone} Quests geschafft`}>{questsDone}</span>
      )}
    </button>
  );

  return (
    <nav className="tabbar glass" role="tablist" aria-label="Hauptnavigation">
      {tabs.slice(0, 2).map(renderTab)}
      <button
        className={`prost-fab${prostActive ? ' active' : ''}`}
        onClick={onProst}
        aria-label="Prost! Jetzt einchecken"
        aria-pressed={prostActive}
      >
        <span className="prost-fab-glow" aria-hidden="true" />
        <span className="prost-fab-inner" aria-hidden="true">
          <svg viewBox="0 0 32 32" width="30" height="30">
            <path d="M8 11h13v13a3 3 0 0 1-3 3h-7a3 3 0 0 1-3-3V11Z" fill="currentColor" />
            <path d="M21 14h2.5a3 3 0 0 1 3 3v3a3 3 0 0 1-3 3H21" fill="none" stroke="currentColor" strokeWidth="2.4" />
            <path d="M6.5 11c0-3 2.4-4.8 4.8-4.2C12.6 4.4 17 4.3 18.3 6.9c2.5-.6 4.7 1.2 4.2 4.1Z" fill="#fff6e8" />
          </svg>
        </span>
        <span className="prost-fab-label">Prost!</span>
      </button>
      {tabs.slice(2).map(renderTab)}
    </nav>
  );
}
