import type { QuestDefinition } from './types';

export const QUEST_CATALOG: QuestDefinition[] = [
  {
    id: 'explorer',
    title: 'Entdecker',
    description: 'Entdecke 5 verschiedene Bier-Regionen',
    icon: '\uD83E\uDDED',       // 🧭
    targetCount: 5,
  },
  {
    id: 'border-patrol',
    title: 'Grenzpatrouille',
    description: 'Besuche 3 knappe Grenzgebiete',
    icon: '\u2694\uFE0F',       // ⚔️
    targetCount: 3,
  },
  {
    id: 'cartographer',
    title: 'Kartograph',
    description: 'Setze 10 Votes',
    icon: '\uD83D\uDDFA\uFE0F', // 🗺️
    targetCount: 10,
  },
];
