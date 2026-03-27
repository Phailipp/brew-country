import type { QuestDefinition } from './types';

export const QUEST_CATALOG: QuestDefinition[] = [
  {
    id: 'cartographer',
    title: 'Kartograph',
    description: 'Setze Votes an 10 verschiedenen Orten',
    icon: '\uD83D\uDDFA\uFE0F', // 🗺️
    targetCount: 10,
  },
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
    description: 'Besuche 3 hart umkämpfte Grenzgebiete',
    icon: '\u2694\uFE0F',       // ⚔️
    targetCount: 3,
  },
  {
    id: 'regular',
    title: 'Stammgast',
    description: 'Check-in an 3 verschiedenen Orten mit einem Drink',
    icon: '\uD83C\uDF7A',       // 🍺
    targetCount: 3,
  },
  {
    id: 'networker',
    title: 'Netzwerker',
    description: 'F\u00FCge 2 Freunde hinzu',
    icon: '\uD83E\uDD1D',       // 🤝
    targetCount: 2,
  },
  {
    id: 'globetrotter',
    title: 'Weltenbummler',
    description: 'Entdecke 20 verschiedene Bier-Regionen',
    icon: '\uD83C\uDF0D',       // 🌍
    targetCount: 20,
  },
];
