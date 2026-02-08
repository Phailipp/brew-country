import type { User, OnTheRoadVote, DrinkVote, DuelOutcome, Team, WeightedVote, WeightBreakdown } from './types';
import { haversineDistanceKm } from './geo';
import { GAME } from '../config/constants';
import { getNow } from './clock';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Compute the base multiplier for a home vote based on creation time and last active.
 */
function computeBaseMultiplier(user: User, now: number): number {
  const daysSinceCreation = (now - user.createdAt) / DAY_MS;

  // Initial boost: 2.0× for the first N days
  if (daysSinceCreation < GAME.HOME_BOOST_INITIAL_DAYS) {
    return GAME.HOME_BOOST_MAX;
  }

  // Decay based on missed days since last active
  const missedDays = Math.floor((now - user.lastActiveAt) / DAY_MS);
  const decayed = GAME.HOME_BOOST_MAX - missedDays * GAME.DECAY_PER_MISSED_DAY;
  return Math.max(GAME.HOME_BOOST_MIN, Math.min(GAME.HOME_BOOST_MAX, decayed));
}

/**
 * Compute the team boost for a user.
 * +0.1 per teammate whose home circle overlaps with the user's.
 */
function computeTeamBoost(user: User, team: Team | null, allUsers: User[]): number {
  if (!team) return 0;

  let boost = 0;
  const userRadius = user.standYourGroundEnabled
    ? GAME.HOME_RADIUS_KM / GAME.SYG_RADIUS_DIVISOR
    : GAME.HOME_RADIUS_KM;

  for (const memberId of team.memberUserIds) {
    if (memberId === user.id) continue;

    const member = allUsers.find(u => u.id === memberId);
    if (!member) continue;

    const memberRadius = member.standYourGroundEnabled
      ? GAME.HOME_RADIUS_KM / GAME.SYG_RADIUS_DIVISOR
      : GAME.HOME_RADIUS_KM;

    const dist = haversineDistanceKm(user.homeLat, user.homeLon, member.homeLat, member.homeLon);
    if (dist <= userRadius + memberRadius) {
      boost += GAME.TEAM_BOOST_PER_OVERLAP;
    }
  }

  return Math.min(boost, GAME.TEAM_MAX_BOOST);
}

/**
 * Sum active duel outcome deltas for a user, clamped to allowed range.
 */
function computeDuelDelta(outcomes: DuelOutcome[], now: number): number {
  let sum = 0;
  for (const o of outcomes) {
    if (o.expiresAt > now) {
      sum += o.delta;
    }
  }
  return Math.max(GAME.DUEL_DELTA_MIN, Math.min(GAME.DUEL_DELTA_MAX, sum));
}

/**
 * Compute full weight breakdown for a user's home vote.
 */
export function computeWeightBreakdown(
  user: User,
  team: Team | null,
  allUsers: User[],
  duelOutcomes: DuelOutcome[],
  now: number = getNow()
): WeightBreakdown {
  const baseMultiplier = computeBaseMultiplier(user, now);

  // Stand Your Ground
  const sygActive = user.standYourGroundEnabled;
  const sygMultiplier = sygActive ? GAME.SYG_MULTIPLIER : 1.0;
  const effectiveMultiplier = Math.min(
    sygActive ? 4.0 : GAME.HOME_BOOST_MAX,
    baseMultiplier * sygMultiplier
  );

  const teamBoost = computeTeamBoost(user, team, allUsers);
  const teamMultiplier = 1.0 + teamBoost;

  const duelDelta = computeDuelDelta(duelOutcomes, now);

  const rawWeight = 1.0 * effectiveMultiplier * teamMultiplier + duelDelta;
  const finalWeight = Math.max(GAME.WEIGHT_MIN, rawWeight);

  const effectiveRadius = sygActive
    ? GAME.HOME_RADIUS_KM / GAME.SYG_RADIUS_DIVISOR
    : GAME.HOME_RADIUS_KM;

  // Days until decay kicks in
  const missedDays = Math.floor((now - user.lastActiveAt) / DAY_MS);
  const daysUntilNextDecay = missedDays < 1
    ? Math.max(0, Math.ceil(((user.lastActiveAt + DAY_MS) - now) / DAY_MS))
    : 0;

  return {
    baseMultiplier,
    sygMultiplier,
    teamBoost,
    duelDelta,
    finalWeight,
    effectiveRadius,
    decayDaysRemaining: daysUntilNextDecay,
  };
}

/**
 * Build weighted votes for ALL users + their OTR votes.
 * This is the input the worker needs.
 */
export function buildWeightedVotes(
  allUsers: User[],
  allOTRVotes: OnTheRoadVote[],
  allTeams: Team[],
  allOutcomes: Map<string, DuelOutcome[]>,
  allDrinkVotes: DrinkVote[] = [],
  now: number = getNow()
): WeightedVote[] {
  const votes: WeightedVote[] = [];

  for (const user of allUsers) {
    // Find user's team
    const team = allTeams.find(t => t.beerId === user.beerId && t.memberUserIds.includes(user.id)) ?? null;
    const outcomes = allOutcomes.get(user.id) ?? [];
    const breakdown = computeWeightBreakdown(user, team, allUsers, outcomes, now);

    // Home vote
    votes.push({
      id: `home_${user.id}`,
      lat: user.homeLat,
      lon: user.homeLon,
      beerId: user.beerId,
      weight: breakdown.finalWeight,
      radiusKm: breakdown.effectiveRadius,
      source: 'home',
    });
  }

  // OTR votes (expired ones should already be filtered out)
  for (const otr of allOTRVotes) {
    if (otr.expiresAt <= now) continue;

    const user = allUsers.find(u => u.id === otr.userId);
    if (!user) continue;

    const baseMultiplier = computeBaseMultiplier(user, now);
    const otrWeight = Math.max(
      GAME.WEIGHT_MIN,
      1.0 * baseMultiplier * GAME.OTR_WEIGHT_SCALE
    );

    votes.push({
      id: otr.id,
      lat: otr.lat,
      lon: otr.lon,
      beerId: otr.beerId,
      weight: otrWeight,
      radiusKm: GAME.OTR_RADIUS_KM,
      source: 'otr',
    });
  }

  // Drink votes (check-ins) — fixed weight, smaller radius, TTL-based
  for (const dv of allDrinkVotes) {
    if (dv.expiresAt <= now) continue;

    votes.push({
      id: dv.id,
      lat: dv.lat,
      lon: dv.lon,
      beerId: dv.beerId,
      weight: GAME.DRINK_WEIGHT,
      radiusKm: GAME.DRINK_RADIUS_KM,
      source: 'drink',
    });
  }

  return votes;
}
