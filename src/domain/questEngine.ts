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
      case 'cartographer': {
        // Track unique vote placements by GPS location (~11 m resolution)
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

      case 'explorer':
      case 'globetrotter': {
        // Track unique beer regions visited (hovered or clicked)
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
        // Track close-margin (contested) regions visited
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

      case 'regular': {
        // Track unique drink check-ins by placeKey (one place = one location grid cell ~100m)
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

      case 'networker': {
        // Track unique friendships added
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
