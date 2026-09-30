import type { QuestDefinition } from './types';

/** Legacy quests; titles and descriptions live in the i18n catalogue (quests.catalog.<id>). */
export const QUEST_CATALOG: QuestDefinition[] = [
  {
    id: 'explorer',
    icon: '\uD83E\uDDED',       // 🧭
    targetCount: 5,
  },
  {
    id: 'border-patrol',
    icon: '\u2694\uFE0F',       // ⚔️
    targetCount: 3,
  },
  {
    id: 'cartographer',
    icon: '\uD83D\uDDFA\uFE0F', // 🗺️
    targetCount: 10,
  },
];
