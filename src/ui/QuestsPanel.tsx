import { memo } from 'react';
import type { QuestDefinition, QuestState } from '../domain/types';
import './QuestsPanel.css';

interface Props {
  questState: QuestState;
  catalog: QuestDefinition[];
}

function formatCompletedAt(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
}

export const QuestsPanel = memo(function QuestsPanel({ questState, catalog }: Props) {
  const completedQuests = catalog.filter(q => questState.progress[q.id]?.completed);
  const activeQuests = catalog.filter(q => !questState.progress[q.id]?.completed);

  return (
    <div className="quests-panel">
      <div className="quests-header">
        <h3>Brew Quests</h3>
        <span className="quests-progress-badge">
          {completedQuests.length}/{catalog.length}
        </span>
      </div>

      <div className="quests-list">
        {/* Active quests first */}
        {activeQuests.map((quest) => {
          const progress = questState.progress[quest.id];
          const current = progress?.currentCount ?? 0;
          const pct = Math.min(100, Math.round((current / quest.targetCount) * 100));

          return (
            <div key={quest.id} className="quest-row">
              <span className="quest-icon">{quest.icon}</span>
              <div className="quest-info">
                <div className="quest-title">{quest.title}</div>
                <div className="quest-desc">{quest.description}</div>
                <div className="quest-bar-wrap">
                  <div className="quest-bar-fill" style={{ width: `${pct}%` }} />
                </div>
              </div>
              <span className="quest-count">{current}/{quest.targetCount}</span>
            </div>
          );
        })}

        {/* Completed quests at bottom */}
        {completedQuests.length > 0 && (
          <>
            <div className="quests-section-divider">Abgeschlossen</div>
            {completedQuests.map((quest) => {
              const progress = questState.progress[quest.id]!;
              return (
                <div key={quest.id} className="quest-row completed">
                  <span className="quest-icon">{quest.icon}</span>
                  <div className="quest-info">
                    <div className="quest-title">{quest.title}</div>
                    {progress.completedAt && (
                      <div className="quest-completed-date">
                        ✓ {formatCompletedAt(progress.completedAt)}
                      </div>
                    )}
                  </div>
                  <span className="quest-check">✓</span>
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
});
