import type { Venue } from './venues';
import { INFLUENCE, type VenueStanding } from './influence';
import { collator } from '../i18n/locale';

/**
 * The brewery's view of the game: where does our beer rule, where are we
 * about to lose a pub, where could we win one? This is what breweries pay
 * for — the same data players create, turned into field-sales actions.
 */
export interface VenueInsight {
  venue: Venue;
  standing: VenueStanding;
  /** Our points at the venue */
  ours: number;
  /** Strongest other beer at the venue */
  rivalBeerId: string | null;
  /** Points between us and the flip (either direction) */
  gap: number;
}

export interface BreweryReport {
  beerId: string;
  venuesTotal: number;
  /** Venues with any ruler */
  venuesClaimed: number;
  ruled: number;
  /** ruled / claimed */
  shareOfVoice: number;
  /** Tapped (OSM) venues of this beer */
  tapped: number;
  /** Influence earned from player visits (beyond the tap head start) */
  visitPoints: number;
  /** Ruled venues a rival could take soon: send the field rep */
  atRisk: VenueInsight[];
  /** Venues we could take with a small push: promotion targets */
  opportunities: VenueInsight[];
  /** We are poured here but nobody checks in with us: activation targets */
  sleeping: VenueInsight[];
  /** Beers ruling the most venues, us included */
  rivals: { beerId: string; venues: number }[];
}

/** A flip within this many points counts as "close". */
export const CLOSE_GAP = 6;

export function breweryReport(beerId: string, venues: Venue[], standings: Map<string, VenueStanding>): BreweryReport {
  const atRisk: VenueInsight[] = [];
  const opportunities: VenueInsight[] = [];
  const sleeping: VenueInsight[] = [];
  const rulers = new Map<string, number>();
  let claimed = 0;
  let ruled = 0;
  let tapped = 0;
  let visitPoints = 0;

  for (const venue of venues) {
    const st = standings.get(venue.id);
    if (!st) continue;
    if (st.ownerBeerId) {
      claimed++;
      rulers.set(st.ownerBeerId, (rulers.get(st.ownerBeerId) ?? 0) + 1);
    }
    const ours = st.scores.find((s) => s.beerId === beerId)?.points ?? 0;
    const rival = st.scores.find((s) => s.beerId !== beerId) ?? null;
    const isTapped = venue.beerIds.includes(beerId);
    if (isTapped) tapped++;

    if (st.ownerBeerId === beerId) {
      ruled++;
      // How far is the strongest rival from taking over?
      const gap = st.challengerBeerId ? st.toFlip : Infinity;
      if (gap <= CLOSE_GAP) {
        atRisk.push({ venue, standing: st, ours, rivalBeerId: st.challengerBeerId, gap });
      }
      if (isTapped && st.visits === 0) {
        sleeping.push({ venue, standing: st, ours, rivalBeerId: rival?.beerId ?? null, gap: 0 });
      }
    } else if (ours > 0 || isTapped) {
      // Points we still need: beat the ruler by the hysteresis (or just lead)
      const leader = st.scores[0]?.points ?? 0;
      const need = st.ownerBeerId ? Math.max(0, leader * INFLUENCE.HYSTERESIS - ours) : Math.max(0, leader - ours);
      if (need <= CLOSE_GAP) {
        opportunities.push({ venue, standing: st, ours, rivalBeerId: st.ownerBeerId, gap: Math.round(need * 10) / 10 });
      }
    }
  }

  for (const venue of venues) {
    const ours = standings.get(venue.id)?.scores.find((s) => s.beerId === beerId)?.points ?? 0;
    const base = venue.beerIds.includes(beerId) ? (venue.kind === 'brewery' ? INFLUENCE.BREWERY_BASE : INFLUENCE.TAP_BASE) : 0;
    visitPoints += Math.max(0, ours - base);
  }

  const byGap = (a: VenueInsight, b: VenueInsight) => a.gap - b.gap || b.standing.visits - a.standing.visits;
  return {
    beerId,
    venuesTotal: venues.length,
    venuesClaimed: claimed,
    ruled,
    shareOfVoice: claimed > 0 ? ruled / claimed : 0,
    tapped,
    visitPoints: Math.round(visitPoints),
    atRisk: atRisk.sort(byGap),
    opportunities: opportunities.sort(byGap),
    sleeping: sleeping.sort((a, b) => collator().compare(a.venue.name, b.venue.name)),
    rivals: [...rulers.entries()].map(([id, n]) => ({ beerId: id, venues: n })).sort((a, b) => b.venues - a.venues).slice(0, 6),
  };
}
