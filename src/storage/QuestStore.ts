import type { QuestState } from '../domain/types';

const QUESTS_KEY = 'brewcountry_quests';

const EMPTY_STATE: QuestState = { progress: {} };

export function getQuestState(): QuestState {
  try {
    const raw = localStorage.getItem(QUESTS_KEY);
    return raw ? JSON.parse(raw) : { ...EMPTY_STATE };
  } catch {
    return { ...EMPTY_STATE };
  }
}

export function saveQuestState(state: QuestState): void {
  localStorage.setItem(QUESTS_KEY, JSON.stringify(state));
}

export function resetQuestState(): void {
  localStorage.removeItem(QUESTS_KEY);
}
