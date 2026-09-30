import { useCallback, useEffect, useMemo, useState } from 'react';
import type { StorageInterface } from '../storage/StorageInterface';
import type { ViewportBounds, WeightedVote } from '../domain/types';
import { tilesForViewport, type MyVisit, type Venue, type VenueCheckin } from '../domain/venues';
import { computeStanding, INFLUENCE, type VenueStanding } from '../domain/influence';
import { loadVenues } from '../services/venueService';

/** Venues load from this (legacy) zoom on: roughly one neighbourhood on screen. */
export const VENUE_MIN_ZOOM = 13.5;
const MAX_TILES = 30;
const DAY_MS = 86_400_000;

export interface VenueState {
  /** Every venue loaded this session (they keep shaping territories when zoomed out) */
  venues: Venue[];
  standings: Map<string, VenueStanding>;
  myVisits: MyVisit[];
  /** Venue influence as input for the territory worker */
  venueVotes: WeightedVote[];
  status: 'idle' | 'loading' | 'ready' | 'error' | 'zoom';
  reload: () => void;
  checkIn: (venue: Venue, beerId: string, alcoholFree: boolean) => Promise<{ visit: MyVisit; before: VenueStanding; after: VenueStanding }>;
  /** Demo: add simulated visits and recompute */
  addCheckins: (visits: VenueCheckin[]) => void;
  /** Make venues known (e.g. found via GPS outside the viewport) */
  addVenues: (venues: Venue[]) => void;
}

export function useVenues(
  store: StorageInterface,
  userId: string,
  viewport: ViewportBounds | null,
  zoom: number,
): VenueState {
  const [venueMap, setVenueMap] = useState<Map<string, Venue>>(() => new Map());
  const [checkins, setCheckins] = useState<VenueCheckin[]>([]);
  const [myVisits, setMyVisits] = useState<MyVisit[]>([]);
  const [loadStatus, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [nonce, setNonce] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  // Clock for decay; a minute is plenty
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let cancelled = false;
    store.getMyVisits(userId).then((v) => { if (!cancelled) setMyVisits(v); }).catch(() => {});
    return () => { cancelled = true; };
  }, [store, userId, nonce]);

  const tiles = useMemo(
    () => (viewport && zoom >= VENUE_MIN_ZOOM ? tilesForViewport(viewport, MAX_TILES) : []),
    [viewport, zoom],
  );
  const tilesKey = tiles.join(',');

  useEffect(() => {
    if (tiles.length === 0) return;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setStatus('loading');
      try {
        const [venues, visits] = await Promise.all([
          loadVenues(tiles, ctrl.signal),
          store.getVenueCheckins(tiles, Date.now() - INFLUENCE.WINDOW_DAYS * DAY_MS).catch(() => [] as VenueCheckin[]),
        ]);
        if (ctrl.signal.aborted) return;
        setVenueMap((prev) => {
          const next = new Map(prev);
          for (const v of venues) next.set(v.id, v);
          return next;
        });
        setCheckins((prev) => {
          const byId = new Map(prev.map((c) => [c.id, c]));
          for (const c of visits) byId.set(c.id, c);
          return [...byId.values()];
        });
        setStatus('ready');
      } catch {
        if (!ctrl.signal.aborted) setStatus('error');
      }
    }, 450);
    return () => { clearTimeout(t); ctrl.abort(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the tile set
  }, [tilesKey, store, nonce]);

  const venues = useMemo(() => [...venueMap.values()], [venueMap]);

  const standings = useMemo(() => {
    const byVenue = new Map<string, VenueCheckin[]>();
    for (const c of checkins) {
      const list = byVenue.get(c.venueId);
      if (list) list.push(c);
      else byVenue.set(c.venueId, [c]);
    }
    const out = new Map<string, VenueStanding>();
    for (const v of venues) out.set(v.id, computeStanding(v, byVenue.get(v.id) ?? [], now));
    return out;
  }, [venues, checkins, now]);

  const venueVotes = useMemo<WeightedVote[]>(() => {
    const out: WeightedVote[] = [];
    for (const v of venues) {
      const s = standings.get(v.id);
      if (!s?.ownerBeerId) continue;
      const pts = s.scores[0]?.points ?? 0;
      out.push({
        id: `venue_${v.id}`,
        lat: v.lat,
        lon: v.lon,
        beerId: s.ownerBeerId,
        // A busy, well-defended pub radiates further than a quiet one
        weight: 0.6 + Math.min(pts, 40) / 20,
        radiusKm: v.kind === 'brewery' || v.kind === 'biergarten' ? 0.45 : 0.3,
        source: 'venue',
      });
    }
    return out;
  }, [venues, standings]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  // Without tiles to load, the status follows the view (zoomed out vs. nothing to do)
  const status: VenueState['status'] = tiles.length > 0
    ? loadStatus
    : viewport && zoom < VENUE_MIN_ZOOM ? 'zoom' : 'idle';

  const checkIn = useCallback(async (venue: Venue, beerId: string, alcoholFree: boolean) => {
    const at = Date.now();
    const venueCheckins = checkins.filter((c) => c.venueId === venue.id);
    const before = computeStanding(venue, venueCheckins, at);
    const visit = await store.checkInAtVenue(userId, venue, beerId, alcoholFree);
    // Show our own visit immediately; the next load brings the pseudonymous copy
    const mine: VenueCheckin = { id: visit.id, player: `me:${venue.id}`, venueId: venue.id, tile: venue.tile, beerId, alcoholFree, createdAt: visit.createdAt };
    const after = computeStanding(venue, [...venueCheckins, mine], at);
    setCheckins((prev) => [...prev, mine]);
    setMyVisits((prev) => [visit, ...prev]);
    setNow(Date.now());
    return { visit, before, after };
  }, [checkins, store, userId]);

  const addCheckins = useCallback((visits: VenueCheckin[]) => {
    setCheckins((prev) => [...prev, ...visits]);
  }, []);

  const addVenues = useCallback((list: Venue[]) => {
    setVenueMap((prev) => {
      if (list.every((v) => prev.has(v.id))) return prev;
      const next = new Map(prev);
      for (const v of list) next.set(v.id, v);
      return next;
    });
  }, []);

  return { venues, standings, myVisits, venueVotes, status, reload, checkIn, addCheckins, addVenues };
}
