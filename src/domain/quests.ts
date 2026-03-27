import type { QuestDefinition } from './types';

export const QUEST_CATALOG: QuestDefinition[] = [
  // ── Mapping ──────────────────────────────────────────────
  {
    id: 'cartographer',
    title: 'Kartograph',
    description: 'Setze Votes an 10 verschiedenen Orten',
    icon: '🗺️',
    targetCount: 10,
  },
  {
    id: 'veteran',
    title: 'Veteran',
    description: 'Markiere 50 verschiedene Orte mit deinem Vote',
    icon: '🎖️',
    targetCount: 50,
  },

  // ── Exploration ──────────────────────────────────────────
  {
    id: 'explorer',
    title: 'Entdecker',
    description: 'Erkunde 5 verschiedene Bier-Regionen',
    icon: '🧭',
    targetCount: 5,
  },
  {
    id: 'globetrotter',
    title: 'Weltenbummler',
    description: 'Erkunde 20 verschiedene Bier-Regionen',
    icon: '🌍',
    targetCount: 20,
  },
  {
    id: 'border-patrol',
    title: 'Grenzpatrouille',
    description: 'Besuche 3 hart umkämpfte Grenzgebiete',
    icon: '⚔️',
    targetCount: 3,
  },

  // ── On The Road ──────────────────────────────────────────
  {
    id: 'wanderer',
    title: 'Wanderer',
    description: 'Platziere 3 OTR-Votes außerhalb deines Heimatgebiets',
    icon: '🚗',
    targetCount: 3,
  },

  // ── Drink Check-ins ──────────────────────────────────────
  {
    id: 'regular',
    title: 'Stammgast',
    description: 'Check-in an 3 verschiedenen Orten',
    icon: '🍺',
    targetCount: 3,
  },
  {
    id: 'bar-legend',
    title: 'Bar-Legende',
    description: 'Check-in an 15 verschiedenen Orten',
    icon: '🏅',
    targetCount: 15,
  },

  // ── Social ───────────────────────────────────────────────
  {
    id: 'networker',
    title: 'Netzwerker',
    description: 'Füge 2 Freunde hinzu',
    icon: '🤝',
    targetCount: 2,
  },
  {
    id: 'socialite',
    title: 'Gesellschaftslöwe',
    description: 'Füge 5 Freunde hinzu',
    icon: '👑',
    targetCount: 5,
  },
  {
    id: 'chatterbox',
    title: 'Plaudertasche',
    description: 'Sende 20 Chat-Nachrichten',
    icon: '💬',
    targetCount: 20,
  },

  // ── Teams & Duels ────────────────────────────────────────
  {
    id: 'team-player',
    title: 'Teamplayer',
    description: 'Tritt einer Biergemeinschaft bei',
    icon: '🫂',
    targetCount: 1,
  },
  {
    id: 'duelist',
    title: 'Duellant',
    description: 'Nimm an 3 Duellen teil',
    icon: '🗡️',
    targetCount: 3,
  },
];
