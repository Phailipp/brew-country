import type { QuestDefinition, QuestState } from '../domain/types';
import './QuestsPanel.css';

interface Props {
  questState: QuestState;
  catalog: QuestDefinition[];
}

const RING_R = 30;
const RING_C = 2 * Math.PI * RING_R;

export function QuestsPanel({ questState, catalog }: Props) {
  const rows = catalog.map((quest) => {
    const progress = questState.progress[quest.id];
    const current = Math.min(progress?.currentCount ?? 0, quest.targetCount);
    const completed = progress?.completed ?? false;
    const pct = completed ? 100 : Math.min(100, Math.round((current / quest.targetCount) * 100));
    return { quest, current, completed, pct };
  });

  const doneCount = rows.filter((r) => r.completed).length;
  const total = rows.length;
  const ratio = total > 0 ? doneCount / total : 0;

  // Open quests first (closest to done on top), completed at the end
  const sorted = [...rows].sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    return b.pct - a.pct;
  });

  return (
    <section className="section quests" aria-labelledby="quests-title">
      <h2 className="section-title" id="quests-title">Brew Quests</h2>

      {total === 0 ? (
        <div className="empty">
          <span className="empty-icon" aria-hidden="true">🗺️</span>
          <span className="empty-title">Noch keine Quests</span>
          <p>Bald gibt's hier Aufgaben für dich. Schau später wieder rein!</p>
        </div>
      ) : (
        <>
          <div className="card card-hero quests-summary">
            <svg className="quests-ring" viewBox="0 0 72 72" aria-hidden="true">
              <circle cx="36" cy="36" r={RING_R} className="quests-ring-track" />
              <circle
                cx="36"
                cy="36"
                r={RING_R}
                className="quests-ring-fill"
                strokeDasharray={RING_C}
                strokeDashoffset={RING_C * (1 - ratio)}
              />
            </svg>
            <div className="quests-summary-text">
              <span className="quests-summary-num num">
                {doneCount}<span className="quests-summary-total">/{total}</span>
              </span>
              <span className="quests-summary-label">
                {doneCount === total
                  ? 'Alle geschafft – Legende! 🏆'
                  : doneCount === 0
                    ? 'geschafft – leg los!'
                    : 'geschafft – weiter so!'}
              </span>
            </div>
          </div>

          <ul className="quests-list stagger" aria-label="Quests">
            {sorted.map(({ quest, current, completed, pct }) => (
              <li key={quest.id} className={`card quest${completed ? ' done' : ''}`}>
                <span className="quest-tile" aria-hidden="true">{quest.icon}</span>
                <div className="quest-body">
                  <div className="quest-head">
                    <h3 className="quest-title">{quest.title}</h3>
                    {completed ? (
                      <span className="quest-check" role="img" aria-label="Erledigt">
                        <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
                          <path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </span>
                    ) : (
                      <span className="quest-count num">{current}/{quest.targetCount}</span>
                    )}
                  </div>
                  <p className="quest-desc">{quest.description}</p>
                  {!completed && (
                    <div
                      className="bar quest-bar"
                      role="progressbar"
                      aria-label={`Fortschritt ${quest.title}`}
                      aria-valuemin={0}
                      aria-valuemax={quest.targetCount}
                      aria-valuenow={current}
                    >
                      <span style={{ width: `${pct}%` }} />
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
