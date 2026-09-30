import { useMemo, useState } from 'react';
import type { MyVisit } from '../domain/venues';
import { weeklyChallenges, weekStart } from '../domain/weeklyChallenges';
import './QuestsPanel.css';

interface Props {
  visits: MyVisit[];
}

/** This week's pub challenges; they reset every Monday. */
export function WeeklyPanel({ visits }: Props) {
  const [now] = useState(() => Date.now());
  const challenges = useMemo(() => weeklyChallenges(visits, now), [visits, now]);
  const done = challenges.filter((c) => c.done).length;
  const daysLeft = Math.max(1, Math.ceil((weekStart(now) + 7 * 86_400_000 - now) / 86_400_000));

  return (
    <section className="section quests" aria-labelledby="weekly-title">
      <h2 className="section-title" id="weekly-title">
        Diese Woche <small>{done}/{challenges.length} · noch {daysLeft} {daysLeft === 1 ? 'Tag' : 'Tage'}</small>
      </h2>
      <ul className="quests-list stagger" aria-label="Wochen-Challenges">
        {challenges.map((c) => (
          <li key={c.id} className={`card quest${c.done ? ' done' : ''}`}>
            <span className="quest-tile" aria-hidden="true">{c.icon}</span>
            <div className="quest-body">
              <div className="quest-head">
                <h3 className="quest-title">{c.title}</h3>
                {c.done ? (
                  <span className="quest-check" aria-label="Erledigt">
                    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                ) : (
                  <span className="quest-count num">{c.progress}/{c.target}</span>
                )}
              </div>
              <p className="quest-desc">{c.description}</p>
              {!c.done && (
                <div className="bar quest-bar" role="progressbar" aria-label={`Fortschritt ${c.title}`}
                  aria-valuemin={0} aria-valuemax={c.target} aria-valuenow={c.progress}>
                  <span style={{ width: `${(c.progress / c.target) * 100}%` }} />
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
