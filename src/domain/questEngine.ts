import type { AppEvent, QuestDefinition, QuestProgress, QuestState, OverlaySettings } from './types';

export interface QuestEvalResult {
  newState: QuestState;
  completions: QuestDefinition[];
}

function ensureProgress(state: QuestState, quest: QuestDefinition): QuestProgress {
  return state.progress[quest.id] ?? {
    questId: quest.id,
    currentCount: 0,
    completed: false,
    completedAt: null,
    trackedIds: [],
  };
}

/**
 * Pure reducer: evaluate an AppEvent against quest catalog and return new state + completions.
 */
export function evaluateEvent(
  event: AppEvent,
  state: QuestState,
  catalog: QuestDefinition[],
  settings: OverlaySettings
): QuestEvalResult {
  const newProgress = { ...state.progress };
  const completions: QuestDefinition[] = [];

  for (const quest of catalog) {
    const prev = ensureProgress(state, quest);
    if (prev.completed) {
      newProgress[quest.id] = prev;
      continue;
    }

    let updated = { ...prev };

    switch (quest.id) {
      // ── Mapping ───────────────────────────────────────────────────────────
      case 'cartographer':
      case 'veteran': {
        // Track unique vote placements by GPS grid (~11m resolution)
        if (event.type === 'vote:saved') {
          const key = `${event.vote.lat.toFixed(4)},${event.vote.lon.toFixed(4)}`;
          if (!updated.trackedIds.includes(key)) {
            updated = {
              ...updated,
              trackedIds: [...updated.trackedIds, key],
              currentCount: updated.currentCount + 1,
            };
          }
        }
        break;
      }

      // ── Exploration ───────────────────────────────────────────────────────
      case 'explorer':
      case 'globetrotter': {
        // Track unique beer regions by ID (hovered or clicked)
        if (event.type === 'region:hovered' || event.type === 'region:clicked') {
          const regionId = event.region.id;
          if (!updated.trackedIds.includes(regionId)) {
            updated = {
              ...updated,
              trackedIds: [...updated.trackedIds, regionId],
              currentCount: updated.currentCount + 1,
            };
          }
        }
        break;
      }

      case 'border-patrol': {
        // Track contested regions (low margin) — hovered or clicked
        if (event.type === 'region:hovered' || event.type === 'region:clicked') {
          const region = event.region;
          if (region.avgMargin <= settings.closeMarginThreshold) {
            const regionId = region.id;
            if (!updated.trackedIds.includes(regionId)) {
              updated = {
                ...updated,
                trackedIds: [...updated.trackedIds, regionId],
                currentCount: updated.currentCount + 1,
              };
            }
          }
        }
        break;
      }

      // ── On The Road ───────────────────────────────────────────────────────
      case 'wanderer': {
        if (event.type === 'otr:created') {
          const voteId = event.vote.id;
          if (!updated.trackedIds.includes(voteId)) {
            updated = {
              ...updated,
              trackedIds: [...updated.trackedIds, voteId],
              currentCount: updated.currentCount + 1,
            };
          }
        }
        break;
      }

      // ── Drink check-ins ───────────────────────────────────────────────────
      case 'regular':
      case 'bar-legend': {
        // Track unique drink check-ins by placeKey (~100m grid cell)
        if (event.type === 'drink:created') {
          const key = event.vote.placeKey;
          if (!updated.trackedIds.includes(key)) {
            updated = {
              ...updated,
              trackedIds: [...updated.trackedIds, key],
              currentCount: updated.currentCount + 1,
            };
          }
        }
        break;
      }

      // ── Social ────────────────────────────────────────────────────────────
      case 'networker':
      case 'socialite': {
        if (event.type === 'friend:added') {
          const fsId = event.friendship.id;
          if (!updated.trackedIds.includes(fsId)) {
            updated = {
              ...updated,
              trackedIds: [...updated.trackedIds, fsId],
              currentCount: updated.currentCount + 1,
            };
          }
        }
        break;
      }

      case 'chatterbox': {
        // Count outgoing chat messages (event only emitted on send, not receive)
        if (event.type === 'chat:message') {
          const msgId = event.message.id;
          if (!updated.trackedIds.includes(msgId)) {
            updated = {
              ...updated,
              trackedIds: [...updated.trackedIds, msgId],
              currentCount: updated.currentCount + 1,
            };
          }
        }
        break;
      }

      // ── Teams & Duels ─────────────────────────────────────────────────────
      case 'team-player': {
        if (event.type === 'team:joined') {
          // One-shot: just reaching count 1 completes it
          if (updated.currentCount === 0) {
            updated = { ...updated, currentCount: 1 };
          }
        }
        break;
      }

      case 'duelist': {
        // Count accepted duels (status flips to 'active')
        if (event.type === 'duel:updated' && event.duel.status === 'active') {
          const duelId = event.duel.id;
          if (!updated.trackedIds.includes(duelId)) {
            updated = {
              ...updated,
              trackedIds: [...updated.trackedIds, duelId],
              currentCount: updated.currentCount + 1,
            };
          }
        }
        break;
      }
    }

    // Check for completion
    if (!updated.completed && updated.currentCount >= quest.targetCount) {
      updated = { ...updated, completed: true, completedAt: Date.now() };
      completions.push(quest);
    }

    newProgress[quest.id] = updated;
  }

  return { newState: { progress: newProgress }, completions };
}
