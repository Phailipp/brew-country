import { describe, it, expect } from 'vitest';
import { evaluateEvent } from '../domain/questEngine';
import { QUEST_CATALOG } from '../domain/quests';
import type {
  AppEvent,
  QuestState,
  OverlaySettings,
  Region,
  Vote,
  DrinkVote,
  Friendship,
} from '../domain/types';

// ── Shared settings ───────────────────────────────────────────────────────────

const settings: OverlaySettings = {
  showBorders: true,
  showLogos: true,
  showSwords: true,
  borderWidth: 2,
  closeMarginThreshold: 0.08,
  smoothingIterations: 3,
  mergeIslandSize: 10,
};

// ── Builder helpers ───────────────────────────────────────────────────────────

const NOW = 1700000000000;

function makeEmptyState(): QuestState {
  return { progress: {} };
}

function makeVote(overrides: Partial<Vote> = {}): Vote {
  return {
    id: 'v1',
    lat: 48.1371,
    lon: 11.5754,
    beerId: 'beer1',
    timestamp: NOW,
    ...overrides,
  };
}

function makeRegion(overrides: Partial<Region> = {}): Region {
  return {
    id: 'region-1',
    beerId: 'beer1',
    cellCount: 10,
    centroidLat: 48.14,
    centroidLon: 11.58,
    boundingBox: { minRow: 0, maxRow: 5, minCol: 0, maxCol: 5 },
    avgMargin: 0.5,
    totalVotes: 100,
    runnerUpBeerId: 'beer2',
    ...overrides,
  };
}

function makeDrinkVote(overrides: Partial<DrinkVote> = {}): DrinkVote {
  return {
    id: 'dv1',
    userId: 'u1',
    beerId: 'beer1',
    lat: 48.2,
    lon: 11.6,
    placeKey: '48.2000_11.6000',
    createdAt: NOW,
    expiresAt: NOW + 24 * 60 * 60 * 1000,
    gpsAccuracyM: 15,
    proofType: 'gps',
    ...overrides,
  };
}

function makeFriendship(overrides: Partial<Friendship> = {}): Friendship {
  return {
    id: 'fs_u1_u2',
    userIds: ['u1', 'u2'],
    status: 'accepted',
    requestedBy: 'u1',
    createdAt: NOW,
    ...overrides,
  };
}

// ── cartographer ──────────────────────────────────────────────────────────────

describe('cartographer quest', () => {
  const catalog = QUEST_CATALOG.filter(q => q.id === 'cartographer');

  it('increments progress for a new unique location', () => {
    const event: AppEvent = { type: 'vote:saved', vote: makeVote() };
    const { newState } = evaluateEvent(event, makeEmptyState(), catalog, settings);
    expect(newState.progress['cartographer'].currentCount).toBe(1);
  });

  it('does not double-count the same GPS location (same lat/lon to 4dp)', () => {
    const vote = makeVote({ lat: 48.1371, lon: 11.5754 });
    const event: AppEvent = { type: 'vote:saved', vote };

    const { newState: after1 } = evaluateEvent(event, makeEmptyState(), catalog, settings);
    const { newState: after2 } = evaluateEvent(event, after1, catalog, settings);

    expect(after2.progress['cartographer'].currentCount).toBe(1);
    expect(after2.progress['cartographer'].trackedIds).toHaveLength(1);
  });

  it('counts two votes as distinct when they differ beyond 4 dp', () => {
    const e1: AppEvent = { type: 'vote:saved', vote: makeVote({ id: 'v1', lat: 48.1371, lon: 11.5754 }) };
    const e2: AppEvent = { type: 'vote:saved', vote: makeVote({ id: 'v2', lat: 48.1380, lon: 11.5760 }) };

    const { newState: s1 } = evaluateEvent(e1, makeEmptyState(), catalog, settings);
    const { newState: s2 } = evaluateEvent(e2, s1, catalog, settings);

    expect(s2.progress['cartographer'].currentCount).toBe(2);
  });

  it('deduplicates votes that round to the same 4-dp key', () => {
    // 48.13710 and 48.13714 both round to "48.1371"
    const e1: AppEvent = { type: 'vote:saved', vote: makeVote({ id: 'v1', lat: 48.13710, lon: 11.5754 }) };
    const e2: AppEvent = { type: 'vote:saved', vote: makeVote({ id: 'v2', lat: 48.13714, lon: 11.5754 }) };

    const { newState: s1 } = evaluateEvent(e1, makeEmptyState(), catalog, settings);
    const { newState: s2 } = evaluateEvent(e2, s1, catalog, settings);

    expect(s2.progress['cartographer'].currentCount).toBe(1);
  });

  it('marks quest completed and returns it in completions when target (10) is reached', () => {
    let state = makeEmptyState();
    // Feed 9 distinct votes first
    for (let i = 0; i < 9; i++) {
      const event: AppEvent = {
        type: 'vote:saved',
        vote: makeVote({ id: `v${i}`, lat: 48.0 + i * 0.01, lon: 11.0 }),
      };
      ({ newState: state } = evaluateEvent(event, state, catalog, settings));
    }
    expect(state.progress['cartographer'].completed).toBe(false);

    // 10th unique vote triggers completion
    const finalEvent: AppEvent = {
      type: 'vote:saved',
      vote: makeVote({ id: 'v9', lat: 49.0, lon: 11.0 }),
    };
    const { newState, completions } = evaluateEvent(finalEvent, state, catalog, settings);

    expect(newState.progress['cartographer'].completed).toBe(true);
    expect(newState.progress['cartographer'].completedAt).not.toBeNull();
    expect(completions).toHaveLength(1);
    expect(completions[0].id).toBe('cartographer');
  });

  it('ignores non-matching event types', () => {
    const event: AppEvent = { type: 'drink:created', vote: makeDrinkVote() };
    const { newState } = evaluateEvent(event, makeEmptyState(), catalog, settings);
    expect(newState.progress['cartographer']?.currentCount ?? 0).toBe(0);
  });
});

// ── explorer ──────────────────────────────────────────────────────────────────

describe('explorer quest', () => {
  const catalog = QUEST_CATALOG.filter(q => q.id === 'explorer');

  it('increments for a newly seen region on region:hovered', () => {
    const event: AppEvent = { type: 'region:hovered', region: makeRegion(), cell: null };
    const { newState } = evaluateEvent(event, makeEmptyState(), catalog, settings);
    expect(newState.progress['explorer'].currentCount).toBe(1);
  });

  it('increments for a newly seen region on region:clicked', () => {
    const event: AppEvent = { type: 'region:clicked', region: makeRegion(), cell: null };
    const { newState } = evaluateEvent(event, makeEmptyState(), catalog, settings);
    expect(newState.progress['explorer'].currentCount).toBe(1);
  });

  it('does not double-count the same regionId', () => {
    const region = makeRegion({ id: 'region-1' });
    const e1: AppEvent = { type: 'region:hovered', region, cell: null };
    const e2: AppEvent = { type: 'region:clicked', region, cell: null };

    const { newState: s1 } = evaluateEvent(e1, makeEmptyState(), catalog, settings);
    const { newState: s2 } = evaluateEvent(e2, s1, catalog, settings);

    expect(s2.progress['explorer'].currentCount).toBe(1);
    expect(s2.progress['explorer'].trackedIds).toHaveLength(1);
  });

  it('counts distinct region ids independently', () => {
    let state = makeEmptyState();
    for (let i = 0; i < 3; i++) {
      const event: AppEvent = {
        type: 'region:hovered',
        region: makeRegion({ id: `region-${i}` }),
        cell: null,
      };
      ({ newState: state } = evaluateEvent(event, state, catalog, settings));
    }
    expect(state.progress['explorer'].currentCount).toBe(3);
  });

  it('completes at 5 unique regions and surfaces the quest in completions', () => {
    let state = makeEmptyState();
    for (let i = 0; i < 4; i++) {
      const event: AppEvent = {
        type: 'region:hovered',
        region: makeRegion({ id: `region-${i}` }),
        cell: null,
      };
      ({ newState: state } = evaluateEvent(event, state, catalog, settings));
    }
    expect(state.progress['explorer'].completed).toBe(false);

    const finalEvent: AppEvent = {
      type: 'region:clicked',
      region: makeRegion({ id: 'region-4' }),
      cell: null,
    };
    const { newState, completions } = evaluateEvent(finalEvent, state, catalog, settings);

    expect(newState.progress['explorer'].completed).toBe(true);
    expect(completions[0].id).toBe('explorer');
  });
});

// ── globetrotter ──────────────────────────────────────────────────────────────

describe('globetrotter quest', () => {
  const catalog = QUEST_CATALOG.filter(q => q.id === 'globetrotter');

  it('tracks progress independently from explorer', () => {
    const event: AppEvent = {
      type: 'region:hovered',
      region: makeRegion({ id: 'region-1' }),
      cell: null,
    };
    const { newState } = evaluateEvent(event, makeEmptyState(), catalog, settings);
    expect(newState.progress['globetrotter'].currentCount).toBe(1);
    expect(newState.progress['explorer']).toBeUndefined();
  });

  it('deduplicates the same regionId', () => {
    const region = makeRegion({ id: 'region-x' });
    const event: AppEvent = { type: 'region:hovered', region, cell: null };

    const { newState: s1 } = evaluateEvent(event, makeEmptyState(), catalog, settings);
    const { newState: s2 } = evaluateEvent(event, s1, catalog, settings);

    expect(s2.progress['globetrotter'].currentCount).toBe(1);
  });

  it('explorer and globetrotter maintain separate counts when both in catalog', () => {
    const explorerAndGlobe = QUEST_CATALOG.filter(
      q => q.id === 'explorer' || q.id === 'globetrotter',
    );
    let state = makeEmptyState();

    // Visit 5 distinct regions — explorer should complete, globetrotter should not
    for (let i = 0; i < 5; i++) {
      const event: AppEvent = {
        type: 'region:hovered',
        region: makeRegion({ id: `region-${i}` }),
        cell: null,
      };
      ({ newState: state } = evaluateEvent(event, state, explorerAndGlobe, settings));
    }

    expect(state.progress['explorer'].completed).toBe(true);
    expect(state.progress['globetrotter'].currentCount).toBe(5);
    expect(state.progress['globetrotter'].completed).toBe(false);
  });

  it('completes only after 20 unique regions', () => {
    let state = makeEmptyState();
    for (let i = 0; i < 20; i++) {
      const event: AppEvent = {
        type: 'region:hovered',
        region: makeRegion({ id: `r-${i}` }),
        cell: null,
      };
      const result = evaluateEvent(event, state, catalog, settings);
      state = result.newState;
      if (i < 19) {
        expect(result.completions).toHaveLength(0);
      } else {
        expect(result.completions[0].id).toBe('globetrotter');
        expect(state.progress['globetrotter'].completed).toBe(true);
      }
    }
  });
});

// ── border-patrol ─────────────────────────────────────────────────────────────

describe('border-patrol quest', () => {
  const catalog = QUEST_CATALOG.filter(q => q.id === 'border-patrol');
  const THRESHOLD = settings.closeMarginThreshold; // 0.08

  it('counts a contested region (avgMargin exactly at threshold)', () => {
    const region = makeRegion({ id: 'bp-1', avgMargin: THRESHOLD });
    const event: AppEvent = { type: 'region:hovered', region, cell: null };
    const { newState } = evaluateEvent(event, makeEmptyState(), catalog, settings);
    expect(newState.progress['border-patrol'].currentCount).toBe(1);
  });

  it('counts a contested region (avgMargin below threshold)', () => {
    const region = makeRegion({ id: 'bp-2', avgMargin: 0.05 });
    const event: AppEvent = { type: 'region:clicked', region, cell: null };
    const { newState } = evaluateEvent(event, makeEmptyState(), catalog, settings);
    expect(newState.progress['border-patrol'].currentCount).toBe(1);
  });

  it('ignores a region with avgMargin above threshold', () => {
    const region = makeRegion({ id: 'bp-safe', avgMargin: 0.5 });
    const event: AppEvent = { type: 'region:hovered', region, cell: null };
    const { newState } = evaluateEvent(event, makeEmptyState(), catalog, settings);
    expect(newState.progress['border-patrol']?.currentCount ?? 0).toBe(0);
  });

  it('ignores a region just above threshold', () => {
    const region = makeRegion({ id: 'bp-just-over', avgMargin: THRESHOLD + 0.001 });
    const event: AppEvent = { type: 'region:hovered', region, cell: null };
    const { newState } = evaluateEvent(event, makeEmptyState(), catalog, settings);
    expect(newState.progress['border-patrol']?.currentCount ?? 0).toBe(0);
  });

  it('deduplicates the same contested regionId', () => {
    const region = makeRegion({ id: 'bp-dup', avgMargin: 0.02 });
    const e1: AppEvent = { type: 'region:hovered', region, cell: null };
    const e2: AppEvent = { type: 'region:clicked', region, cell: null };

    const { newState: s1 } = evaluateEvent(e1, makeEmptyState(), catalog, settings);
    const { newState: s2 } = evaluateEvent(e2, s1, catalog, settings);

    expect(s2.progress['border-patrol'].currentCount).toBe(1);
  });

  it('completes at 3 contested regions', () => {
    let state = makeEmptyState();
    for (let i = 0; i < 3; i++) {
      const event: AppEvent = {
        type: 'region:hovered',
        region: makeRegion({ id: `bp-${i}`, avgMargin: 0.01 }),
        cell: null,
      };
      ({ newState: state } = evaluateEvent(event, state, catalog, settings));
    }
    expect(state.progress['border-patrol'].completed).toBe(true);
  });
});

// ── regular (Stammgast) ───────────────────────────────────────────────────────

describe('regular quest', () => {
  const catalog = QUEST_CATALOG.filter(q => q.id === 'regular');

  it('increments on drink:created with a unique placeKey', () => {
    const event: AppEvent = { type: 'drink:created', vote: makeDrinkVote() };
    const { newState } = evaluateEvent(event, makeEmptyState(), catalog, settings);
    expect(newState.progress['regular'].currentCount).toBe(1);
  });

  it('does not double-count the same placeKey', () => {
    const vote = makeDrinkVote({ placeKey: 'place-A' });
    const event: AppEvent = { type: 'drink:created', vote };

    const { newState: s1 } = evaluateEvent(event, makeEmptyState(), catalog, settings);
    const { newState: s2 } = evaluateEvent(event, s1, catalog, settings);

    expect(s2.progress['regular'].currentCount).toBe(1);
    expect(s2.progress['regular'].trackedIds).toHaveLength(1);
  });

  it('counts distinct placeKeys separately', () => {
    let state = makeEmptyState();
    const places = ['place-A', 'place-B', 'place-C'];
    for (const placeKey of places) {
      const event: AppEvent = { type: 'drink:created', vote: makeDrinkVote({ placeKey }) };
      ({ newState: state } = evaluateEvent(event, state, catalog, settings));
    }
    expect(state.progress['regular'].currentCount).toBe(3);
  });

  it('completes at 3 unique places', () => {
    let state = makeEmptyState();
    let completions: typeof QUEST_CATALOG = [];
    const places = ['place-A', 'place-B', 'place-C'];
    for (const placeKey of places) {
      const event: AppEvent = { type: 'drink:created', vote: makeDrinkVote({ placeKey }) };
      ({ newState: state, completions } = evaluateEvent(event, state, catalog, settings));
    }
    expect(state.progress['regular'].completed).toBe(true);
    expect(completions[0].id).toBe('regular');
  });

  it('ignores non-matching event types', () => {
    const event: AppEvent = { type: 'vote:saved', vote: makeVote() };
    const { newState } = evaluateEvent(event, makeEmptyState(), catalog, settings);
    expect(newState.progress['regular']?.currentCount ?? 0).toBe(0);
  });
});

// ── networker (Netzwerker) ────────────────────────────────────────────────────

describe('networker quest', () => {
  const catalog = QUEST_CATALOG.filter(q => q.id === 'networker');

  it('increments on friend:added with a new friendship', () => {
    const event: AppEvent = { type: 'friend:added', friendship: makeFriendship() };
    const { newState } = evaluateEvent(event, makeEmptyState(), catalog, settings);
    expect(newState.progress['networker'].currentCount).toBe(1);
  });

  it('deduplicates the same friendship.id', () => {
    const friendship = makeFriendship({ id: 'fs_u1_u2' });
    const event: AppEvent = { type: 'friend:added', friendship };

    const { newState: s1 } = evaluateEvent(event, makeEmptyState(), catalog, settings);
    const { newState: s2 } = evaluateEvent(event, s1, catalog, settings);

    expect(s2.progress['networker'].currentCount).toBe(1);
    expect(s2.progress['networker'].trackedIds).toHaveLength(1);
  });

  it('completes at 2 distinct friendships and includes quest in completions', () => {
    const fs1 = makeFriendship({ id: 'fs_u1_u2', userIds: ['u1', 'u2'] });
    const fs2 = makeFriendship({ id: 'fs_u1_u3', userIds: ['u1', 'u3'] });

    const e1: AppEvent = { type: 'friend:added', friendship: fs1 };
    const e2: AppEvent = { type: 'friend:added', friendship: fs2 };

    const { newState: s1, completions: c1 } = evaluateEvent(e1, makeEmptyState(), catalog, settings);
    expect(s1.progress['networker'].completed).toBe(false);
    expect(c1).toHaveLength(0);

    const { newState: s2, completions: c2 } = evaluateEvent(e2, s1, catalog, settings);
    expect(s2.progress['networker'].completed).toBe(true);
    expect(s2.progress['networker'].completedAt).not.toBeNull();
    expect(c2).toHaveLength(1);
    expect(c2[0].id).toBe('networker');
  });

  it('ignores non-matching event types', () => {
    const event: AppEvent = { type: 'vote:saved', vote: makeVote() };
    const { newState } = evaluateEvent(event, makeEmptyState(), catalog, settings);
    expect(newState.progress['networker']?.currentCount ?? 0).toBe(0);
  });
});

// ── already-completed quests ──────────────────────────────────────────────────

describe('already-completed quests', () => {
  it('are not re-evaluated and do not re-appear in completions', () => {
    const catalog = QUEST_CATALOG.filter(q => q.id === 'networker');

    // Pre-populate state with a completed networker quest
    const completedState: QuestState = {
      progress: {
        networker: {
          questId: 'networker',
          currentCount: 2,
          completed: true,
          completedAt: NOW - 1000,
          trackedIds: ['fs_u1_u2', 'fs_u1_u3'],
        },
      },
    };

    const event: AppEvent = {
      type: 'friend:added',
      friendship: makeFriendship({ id: 'fs_u1_u4', userIds: ['u1', 'u4'] }),
    };

    const { newState, completions } = evaluateEvent(event, completedState, catalog, settings);

    // Count must stay at 2 (no re-processing)
    expect(newState.progress['networker'].currentCount).toBe(2);
    expect(completions).toHaveLength(0);
  });

  it('preserves the original progress object for the completed quest (reference equality)', () => {
    const catalog = QUEST_CATALOG.filter(q => q.id === 'networker');

    const completedProgress = {
      questId: 'networker',
      currentCount: 2,
      completed: true,
      completedAt: NOW - 1000,
      trackedIds: ['fs_u1_u2', 'fs_u1_u3'],
    };
    const completedState: QuestState = { progress: { networker: completedProgress } };

    const event: AppEvent = {
      type: 'friend:added',
      friendship: makeFriendship({ id: 'fs_u1_u4', userIds: ['u1', 'u4'] }),
    };

    const { newState } = evaluateEvent(event, completedState, catalog, settings);
    expect(newState.progress['networker']).toBe(completedProgress);
  });

  it('preserves completedAt timestamp for an already-completed quest', () => {
    const catalog = QUEST_CATALOG.filter(q => q.id === 'regular');
    const completedAt = NOW - 5000;

    const completedState: QuestState = {
      progress: {
        regular: {
          questId: 'regular',
          currentCount: 3,
          completed: true,
          completedAt,
          trackedIds: ['p1', 'p2', 'p3'],
        },
      },
    };

    const event: AppEvent = { type: 'drink:created', vote: makeDrinkVote({ placeKey: 'p-new' }) };
    const { newState } = evaluateEvent(event, completedState, catalog, settings);

    expect(newState.progress['regular'].completedAt).toBe(completedAt);
    expect(newState.progress['regular'].currentCount).toBe(3);
  });
});

// ── irrelevant event types ────────────────────────────────────────────────────

describe('irrelevant event types', () => {
  it('do not advance cartographer on a non-vote event', () => {
    const catalog = QUEST_CATALOG.filter(q => q.id === 'cartographer');

    const state: QuestState = {
      progress: {
        cartographer: {
          questId: 'cartographer',
          currentCount: 3,
          completed: false,
          completedAt: null,
          trackedIds: ['48.1371,11.5754', '48.1500,11.5800', '48.1600,11.5900'],
        },
      },
    };

    const event: AppEvent = { type: 'friend:added', friendship: makeFriendship() };
    const { newState, completions } = evaluateEvent(event, state, catalog, settings);

    expect(newState.progress['cartographer'].currentCount).toBe(3);
    expect(completions).toHaveLength(0);
  });

  it('drink:expired and friend:removed do not advance any quest', () => {
    const catalog = QUEST_CATALOG;
    const state = makeEmptyState();

    const e1: AppEvent = { type: 'drink:expired', voteId: 'dv-old' };
    const e2: AppEvent = { type: 'friend:removed', friendshipId: 'fs_u1_u2' };

    const { newState: s1, completions: c1 } = evaluateEvent(e1, state, catalog, settings);
    const { newState: s2, completions: c2 } = evaluateEvent(e2, s1, catalog, settings);

    for (const q of catalog) {
      expect(s2.progress[q.id]?.currentCount ?? 0).toBe(0);
    }
    expect(c1).toHaveLength(0);
    expect(c2).toHaveLength(0);
  });
});

// ── completions array ─────────────────────────────────────────────────────────

describe('completions array', () => {
  it('contains the full QuestDefinition when a quest is newly completed', () => {
    const catalog = QUEST_CATALOG.filter(q => q.id === 'networker');

    const almostDone: QuestState = {
      progress: {
        networker: {
          questId: 'networker',
          currentCount: 1,
          completed: false,
          completedAt: null,
          trackedIds: ['fs_u1_u2'],
        },
      },
    };

    const event: AppEvent = {
      type: 'friend:added',
      friendship: makeFriendship({ id: 'fs_u1_u3', userIds: ['u1', 'u3'] }),
    };

    const { completions } = evaluateEvent(event, almostDone, catalog, settings);

    expect(completions).toHaveLength(1);
    expect(completions[0]).toMatchObject({ id: 'networker', targetCount: 2 });
    expect(typeof completions[0].title).toBe('string');
    expect(typeof completions[0].icon).toBe('string');
  });

  it('returns an empty completions array when no quest completes', () => {
    const catalog = QUEST_CATALOG.filter(q => q.id === 'explorer');
    const event: AppEvent = {
      type: 'region:hovered',
      region: makeRegion({ id: 'r-1' }),
      cell: null,
    };
    const { completions } = evaluateEvent(event, makeEmptyState(), catalog, settings);
    expect(completions).toHaveLength(0);
  });

  it('can complete multiple quests in a single event', () => {
    // Both explorer (target 5) and globetrotter (target 20) share the same trigger.
    // Seed both to one short of completion, then fire the final event.
    const catalog = QUEST_CATALOG.filter(
      q => q.id === 'explorer' || q.id === 'globetrotter',
    );

    const trackedIds = Array.from({ length: 19 }, (_, i) => `r-${i}`);
    const state: QuestState = {
      progress: {
        explorer: {
          questId: 'explorer',
          currentCount: 4,
          completed: false,
          completedAt: null,
          trackedIds: trackedIds.slice(0, 4),
        },
        globetrotter: {
          questId: 'globetrotter',
          currentCount: 19,
          completed: false,
          completedAt: null,
          trackedIds,
        },
      },
    };

    const event: AppEvent = {
      type: 'region:hovered',
      region: makeRegion({ id: 'r-19' }),
      cell: null,
    };

    const { completions } = evaluateEvent(event, state, catalog, settings);

    expect(completions).toHaveLength(2);
    const ids = completions.map(c => c.id);
    expect(ids).toContain('explorer');
    expect(ids).toContain('globetrotter');
  });
});
