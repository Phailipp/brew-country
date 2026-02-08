import type { QuestDefinition, QuestState } from '../domain/types';
import './QuestsPanel.css';

interface Props {
  questState: QuestState;
  catalog: QuestDefinition[];
}

export function QuestsPanel({ questState, catalog }: Props) {
  return (
    <div className="quests-panel">
      <h3>Brew Quests</h3>
      {catalog.map((quest) => {
        const progress = questState.progress[quest.id];
        const current = progress?.currentCount ?? 0;
        const completed = progress?.completed ?? false;
        const pct = Math.min(100, Math.round((current / quest.targetCount) * 100));

        return (
          <div key={quest.id} className={`quest-row${completed ? ' completed' : ''}`}>
            <span className="quest-icon">{quest.icon}</span>
            <div className="quest-info">
              <div className="quest-title" title={quest.description}>{quest.title}</div>
              <div className="quest-bar-wrap">
                <div className="quest-bar-fill" style={{ width: `${pct}%` }} />
              </div>
            </div>
            <span className="quest-count">
              {completed ? (
                <span className="quest-check">{'\u2713'}</span>
              ) : (
                `${current}/${quest.targetCount}`
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}
