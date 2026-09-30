import { useState, useEffect, useCallback, useRef, useMemo, type CSSProperties, type ReactNode } from 'react';
import type {
  Vote, GridSpec, ViewportBounds, Region, SharePayload, WeightedVote, User, Friendship,
  WorkerInput, WorkerOutput, WorkerResult, DrinkVote, CellResult,
} from './domain/types';
import { getDefaultBoundingBox, getViewportGridSpec, cellAt, specStepDeg, haversineDistanceKm } from './domain/geo';
import { GAME } from './config/constants';
import type { StorageInterface } from './storage/StorageInterface';
import { BEERS, BEER_MAP, registerBeers } from './domain/beers';
import { findRegionForCell } from './domain/regions';
import { appEvents } from './domain/events';
import { buildWeightedVotes } from './domain/weights';
import { decodeShareLink, clearShareParams } from './domain/shareLink';
import { useAuth, isDemoUserId } from './auth/authContext';
import { GoogleLogin } from './auth/GoogleLogin';
import { Onboarding } from './auth/Onboarding';
import { ResetLocation } from './auth/ResetLocation';
import { MapView, type MapViewHandle, type FriendMarker, type VenuePoint } from './ui/MapView';
import { Sheet } from './ui/shell/Sheet';
import { TabBar, type TabId } from './ui/shell/TabBar';
import { ProstPanel } from './ui/ProstPanel';
import { Celebration, type CelebrationData } from './ui/Celebration';
import { TerritoryCard } from './ui/TerritoryCard';
import { Leaderboard, type LeaderboardEntry } from './ui/Leaderboard';
import { SimulationPanel } from './ui/SimulationPanel';
import { VenueCard } from './ui/VenueCard';
import { venueKindLabel } from './ui/kit/venueKind';
import { PassportPanel } from './ui/PassportPanel';
import { ErrorBoundary } from './ui/ErrorBoundary';
import { LegalLinks } from './legal/LegalPage';
import { RESPONSIBLE_DRINKING_URL } from './config/legal';
import { PubFinder, type LocateResult } from './ui/PubFinder';
import { LEGACY_FEATURES } from './config/env';
import { weeklyChallenges } from './domain/weeklyChallenges';
import { BreweryCockpit } from './ui/BreweryCockpit';
import { WeeklyPanel } from './ui/WeeklyPanel';
import { useVenues, VENUE_MIN_ZOOM } from './hooks/useVenues';
import { utcWeek, venuePlayerId } from './domain/visitIds';
import { nearestCity } from './domain/worldCities';
import { CHECKIN_RADIUS_M, tilesForViewport, type VenueCheckin } from './domain/venues';
import { loadVenues } from './services/venueService';
import { acquireGpsSamples } from './domain/gpsVerify';
import { QuestsPanel } from './ui/QuestsPanel';
import { ExploreFeed } from './ui/ExploreFeed';
import { ShareModal } from './ui/ShareModal';
import { HomeStatus } from './ui/HomeStatus';
import { DuelPanel } from './ui/DuelPanel';
import { OnTheRoadButton } from './ui/OnTheRoadButton';
import { TeamPanel } from './ui/TeamPanel';
import { FriendsPanel } from './ui/FriendsPanel';
import { ChatPanel } from './ui/ChatPanel';
import { BeerBadge } from './ui/kit/BeerBadge';
import { beerColor, beerName, pointsLabel } from './ui/kit/beer';
import { haptic } from './ui/kit/haptics';
import { conquer, setSoundEnabled, soundEnabled } from './ui/kit/sound';
import NumberFlow from '@number-flow/react';
import { useToast } from './ui/toastContext';
import { useQuests } from './hooks/useQuests';
import { useFeed } from './hooks/useFeed';
import { usePresence } from './hooks/usePresence';
import { useChatNotifications } from './hooks/useChatNotifications';
import { isFirebaseConfigured } from './config/firebase';
import { t, useLocale, setLocale, percentSuffix, intlLocale, LOCALES, LOCALE_NAMES, type Key } from './i18n';
import { INFLUENCE } from './domain/influence';
import {
  clearLegacyVotes,
  saveLegacyVote,
  saveLegacyVotes,
  saveUserProfile,
  subscribeAllUsers,
  subscribeFriends,
  subscribeLegacyVotes,
  subscribeCatalogBeers,
  profileToUser,
  deleteMyAccount,
  reauthenticate,
  SYNC_ERROR_EVENT,
  type FirestoreUserProfile,
} from './services/firestoreService';
import './App.css';

const fallbackGridSpec: GridSpec = getDefaultBoundingBox();

const OVERLAY = {
  smoothingIterations: GAME.SMOOTHING_ITERATIONS,
  mergeIslandSize: GAME.MERGE_ISLAND_SIZE,
  closeMarginThreshold: GAME.CLOSE_MARGIN_THRESHOLD,
  closeMarginMinWeight: GAME.CLOSE_MARGIN_MIN_WEIGHT,
};

const QUEST_SETTINGS = {
  showBorders: true,
  showLogos: true,
  showSwords: true,
  borderWidth: GAME.BORDER_WIDTH,
  ...OVERLAY,
};

interface AppProps {
  store: StorageInterface;
}

export default function App({ store }: AppProps) {
  const { auth, updateUser, updateLastActive } = useAuth();
  // Re-render the whole app when the language changes
  useLocale();

  if (auth.status === 'loading') {
    return (
      <div className="boot-screen" aria-live="polite">
        <img src="./favicon.svg" alt="" width="72" height="72" className="boot-logo" />
        <p className="boot-title">{t('common.brand')}</p>
        <span className="spinner" role="status" aria-label={t('common.loading')} />
      </div>
    );
  }

  if (auth.status === 'unauthenticated' || auth.status === 'verify-email') {
    return <GoogleLogin />;
  }

  if (auth.status === 'onboarding') {
    return <Onboarding />;
  }

  // Authenticated but home location missing (e.g. admin wiped data)
  if (auth.user.homeLat === 0 && auth.user.homeLon === 0) {
    return <ResetLocation user={auth.user} onLocationSet={updateUser} />;
  }

  return <GameApp key={auth.user.id} user={auth.user} store={store} onActivity={updateLastActive} />;
}

// ── Main game (after auth) ──────────────────────────────

interface GameAppProps {
  user: User;
  store: StorageInterface;
  onActivity: () => Promise<void>;
}

type SheetMode =
  | { kind: 'tab'; tab: TabId }
  | { kind: 'prost' }
  | { kind: 'territory' }
  | { kind: 'venue'; venueId: string }
  | { kind: 'brewery' };

interface DominanceState {
  result: WorkerResult;
  /** Grid spec the result belongs to. */
  spec: GridSpec;
}

const SHEET_TITLES: Record<TabId, Key> = {
  explore: 'sheet.explore',
  crew: 'sheet.crew',
  quests: 'sheet.quests',
  profile: 'sheet.profile',
};

function winnerAt(state: DominanceState | null, lat: number, lon: number): CellResult | null {
  if (!state) return null;
  const { data } = state.result;
  const pos = cellAt(data.gridSpec, data.rows, data.cols, lat, lon);
  return pos ? data.cells[pos.row * data.cols + pos.col] ?? null : null;
}

function GameApp({ user: initialUser, store, onActivity }: GameAppProps) {
  const isDemo = isDemoUserId(initialUser.id);
  const online = isFirebaseConfigured() && !isDemo;
  const devTools = isDemo || import.meta.env.DEV;

  const [user, setUser] = useState<User>(initialUser);
  const [votes, setVotes] = useState<Vote[]>([]);
  const [weightedVotes, setWeightedVotes] = useState<WeightedVote[]>([]);
  const [dominance, setDominance] = useState<DominanceState | null>(null);
  const [computing, setComputing] = useState(false);
  const [viewportBounds, setViewportBounds] = useState<ViewportBounds | null>(null);
  const [viewZoom, setViewZoom] = useState(11);
  const [gridSpec, setGridSpec] = useState<GridSpec>(fallbackGridSpec);
  const [sharePayload, setSharePayload] = useState<SharePayload | null>(null);
  const [chatTarget, setChatTarget] = useState<{ friendshipId: string; friendUser: User } | null>(null);
  const [sheet, setSheet] = useState<SheetMode | null>(() =>
    window.innerWidth >= 900 ? { kind: 'tab', tab: 'explore' } : null);
  const [selectedPoint, setSelectedPoint] = useState<{ lat: number; lon: number } | null>(null);
  const [celebration, setCelebration] = useState<CelebrationData | null>(null);
  const [demoBeerId, setDemoBeerId] = useState<string | null>(initialUser.beerId);
  const [is3d, setIs3d] = useState(false);
  const [remoteUsers, setRemoteUsers] = useState<FirestoreUserProfile[]>([]);
  const [friendships, setFriendships] = useState<Friendship[]>([]);

  const workerRef = useRef<Worker | null>(null);
  const requestIdRef = useRef(0);
  const mapRef = useRef<MapViewHandle>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingFlipRef = useRef<{ lat: number; lon: number; beerId: string; prevWinner: string | null } | null>(null);
  const mapCenterRef = useRef<{ lat: number; lon: number }>({ lat: initialUser.homeLat, lon: initialUser.homeLon });

  const getMapCenter = useCallback(() => mapCenterRef.current, []);

  const { showToast } = useToast();
  const { onlineCount, friendPresence, setFriendIds } = usePresence(user.id);

  // Player's beer colour drives the accent of the whole UI
  useEffect(() => {
    document.documentElement.style.setProperty('--c-beer', beerColor(user.beerId));
  }, [user.beerId]);

  // ── Firestore subscriptions (shared world)
  useEffect(() => {
    if (!online) return;
    return subscribeFriends(user.id, setFriendships);
  }, [user.id, online]);

  useEffect(() => {
    const ids = friendships
      .filter((f) => f.status === 'accepted')
      .map((f) => (f.userIds[0] === user.id ? f.userIds[1] : f.userIds[0]));
    setFriendIds(ids);
  }, [friendships, user.id, setFriendIds]);

  const { unreadCounts } = useChatNotifications({
    userId: user.id,
    friendships,
    openChatFriendshipId: chatTarget?.friendshipId ?? null,
    onNewMessage: useCallback((_friendshipId: string, message: { text: string }) => {
      const preview = message.text.length > 60 ? `${message.text.slice(0, 57)}…` : message.text;
      showToast('💬', preview);
    }, [showToast]),
  });

  useEffect(() => {
    if (online && user.beerId) {
      saveUserProfile(user.id, user.beerId, user.homeLat, user.homeLon, user.createdAt, user.standYourGroundEnabled).catch(() => {});
    }
  }, [online, user.id, user.beerId, user.homeLat, user.homeLon, user.createdAt, user.standYourGroundEnabled]);

  useEffect(() => {
    if (!online) return;
    return subscribeAllUsers(setRemoteUsers);
  }, [online]);

  // Raw votes only exist for demo/dev simulations
  useEffect(() => {
    if (!online || !devTools) return;
    return subscribeLegacyVotes(setVotes);
  }, [online, devTools]);

  // A live listener died (permissions, expired session, quota): say so once
  useEffect(() => {
    let warned = false;
    const onSyncError = () => {
      if (warned) return;
      warned = true;
      showToast('📡', t('toast.syncLost'), 'error');
    };
    window.addEventListener(SYNC_ERROR_EVENT, onSyncError);
    return () => window.removeEventListener(SYNC_ERROR_EVENT, onSyncError);
  }, [showToast]);

  // Approved community beers join the catalogue live
  useEffect(() => {
    if (!online) return;
    return subscribeCatalogBeers((beers) => registerBeers(beers));
  }, [online]);

  useEffect(() => {
    onActivity().catch(() => {});
  }, [onActivity]);

  // ── Weighted votes (debounced, latest-wins)
  const weightsSeqRef = useRef(0);
  const loadWeightedVotes = useCallback(async () => {
    const seq = ++weightsSeqRef.current;

    const firestoreUsers: User[] = remoteUsers.map(profileToUser);

    // Launch model: home turf + pubs. Legacy flags, teams and drink votes are
    // neither shown nor read (saves N full-collection reads per player).
    const [localUsers, allOTR, allTeams, allDrink] = await Promise.all([
      store.getAllUsers(),
      LEGACY_FEATURES ? store.getAllOTRVotes() : Promise.resolve([]),
      LEGACY_FEATURES ? store.getAllTeams() : Promise.resolve([]),
      LEGACY_FEATURES ? store.getAllDrinkVotes() : Promise.resolve([]),
    ]);

    // Public (coarse) profiles for everyone; the player's own full record wins
    const merged = new Map<string, User>();
    for (const u of firestoreUsers) merged.set(u.id, u);
    for (const u of localUsers) merged.set(u.id, u);
    merged.set(user.id, user);
    const allUsers = Array.from(merged.values()).filter((u) => u.homeLat !== 0 || u.homeLon !== 0);

    const outcomeLists = LEGACY_FEATURES
      ? await Promise.all(allUsers.map((u) => store.getDuelOutcomes(u.id)))
      : allUsers.map(() => []);
    const outcomesMap = new Map(allUsers.map((u, i) => [u.id, outcomeLists[i]]));

    if (seq !== weightsSeqRef.current) return; // superseded
    setWeightedVotes(buildWeightedVotes(allUsers, allOTR, allTeams, outcomesMap, allDrink));
  }, [store, remoteUsers, user]);

  useEffect(() => {
    const t = setTimeout(() => { loadWeightedVotes().catch(() => {}); }, 400);
    return () => clearTimeout(t);
  }, [loadWeightedVotes, user]);

  // Periodic cleanup of expired legacy votes/outcomes (Firestore TTL does this in production)
  useEffect(() => {
    if (!LEGACY_FEATURES && online) return;
    const cleanup = () => Promise.all([
      store.removeExpiredOTRVotes(),
      store.removeExpiredDrinkVotes(),
      store.removeExpiredOutcomes(),
    ]).catch(() => {});
    cleanup();
    const id = setInterval(cleanup, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [store, online]);

  // ── Venues (pubs, bars, beer gardens from OpenStreetMap)
  const venueState = useVenues(store, user.id, viewportBounds, viewZoom);
  const { venueVotes } = venueState;

  // ── Dominance worker
  useEffect(() => {
    const worker = new Worker(new URL('./workers/dominanceWorker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e: MessageEvent<WorkerOutput>) => {
      if (e.data.requestId !== requestIdRef.current) return; // stale
      if (e.data.type === 'error') {
        console.warn('[territories] computation failed:', e.data.message);
        setComputing(false);
        return;
      }
      setDominance({ result: e.data, spec: e.data.data.gridSpec });
      setComputing(false);
    };
    worker.onerror = (e) => {
      console.warn('[territories] worker crashed:', e.message);
      setComputing(false);
    };
    workerRef.current = worker;
    return () => worker.terminate();
  }, []);

  useEffect(() => {
    const worker = workerRef.current;
    if (!worker) return;
    const requestId = ++requestIdRef.current;
    setComputing(true);
    const input: WorkerInput = {
      requestId,
      votes,
      weightedVotes: venueVotes.length > 0 ? [...weightedVotes, ...venueVotes] : weightedVotes,
      gridSpec,
      radiusKm: GAME.HOME_RADIUS_KM,
      ...OVERLAY,
    };
    worker.postMessage(input);
  }, [votes, weightedVotes, venueVotes, gridSpec]);

  const regions = useMemo(() => dominance?.result.regions ?? [], [dominance]);
  const dominanceData = dominance?.result.data ?? null;

  useEffect(() => {
    if (dominance && regions.length > 0) {
      appEvents.emit({ type: 'dominance:computed', data: dominance.result.data, regions });
    }
  }, [dominance, regions]);

  // Territory flip after a check-in → the big moment
  useEffect(() => {
    const pending = pendingFlipRef.current;
    if (!pending || !dominance) return;
    const cell = winnerAt(dominance, pending.lat, pending.lon);
    if (!cell) return;
    pendingFlipRef.current = null;
    if (cell.winnerBeerId === pending.beerId && pending.prevWinner !== pending.beerId) {
      haptic('heavy');
      conquer();
      mapRef.current?.pulseAt(pending.lat, pending.lon, beerColor(pending.beerId));
      setCelebration({
        id: Date.now(),
        beerId: pending.beerId,
        title: t('celebrate.conquered'),
        subtitle: pending.prevWinner
          ? t('celebrate.conqueredFrom', { beer: beerName(pending.beerId), prev: beerName(pending.prevWinner) })
          : t('celebrate.conqueredFree', { beer: beerName(pending.beerId) }),
        epic: true,
      });
    }
  }, [dominance]);

  // ── Viewport → grid spec
  const handleViewportChange = useCallback((bounds: ViewportBounds, zoom: number) => {
    setViewportBounds(bounds);
    setViewZoom(zoom);
    mapCenterRef.current = { lat: (bounds.south + bounds.north) / 2, lon: (bounds.west + bounds.east) / 2 };
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      setGridSpec(getViewportGridSpec(bounds, zoom));
    }, GAME.VIEWPORT_DEBOUNCE_MS);
  }, []);

  useEffect(() => () => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
  }, []);

  // Deep link for brewery pitches: …/#brauerei opens the cockpit
  useEffect(() => {
    if (window.location.hash === '#brauerei') setSheet({ kind: 'brewery' });
  }, []);

  // Share link on load
  useEffect(() => {
    const shareData = decodeShareLink();
    if (!shareData) return;
    const t = setTimeout(() => mapRef.current?.flyTo(shareData.centroidLat, shareData.centroidLon, shareData.zoom), 800);
    clearShareParams();
    return () => clearTimeout(t);
  }, []);

  // ── Derived UI data
  const questState = useQuests(user.id, QUEST_SETTINGS);
  const feedItems = useFeed(dominanceData, regions, votes, viewportBounds);
  const [sessionStart] = useState(() => Date.now());
  const weeklyDone = useMemo(
    () => weeklyChallenges(venueState.myVisits, sessionStart).filter((c) => c.done).length,
    [venueState.myVisits, sessionStart],
  );
  const questsDone = LEGACY_FEATURES
    ? Object.values(questState.questState.progress).filter((p) => p.completed).length
    : weeklyDone;

  const leaderboard = useMemo<LeaderboardEntry[]>(() => {
    if (!dominance || !viewportBounds) return [];
    const { data } = dominance.result;
    const { dLat, dLon } = specStepDeg(data.gridSpec);
    const counts = new Map<string, number>();
    let total = 0;
    for (let r = 0; r < data.rows; r++) {
      const lat = data.gridSpec.minLat + (r + 0.5) * dLat;
      if (lat < viewportBounds.south || lat > viewportBounds.north) continue;
      for (let c = 0; c < data.cols; c++) {
        const lon = data.gridSpec.minLon + (c + 0.5) * dLon;
        if (lon < viewportBounds.west || lon > viewportBounds.east) continue;
        const w = data.cells[r * data.cols + c].winnerBeerId;
        if (!w) continue;
        counts.set(w, (counts.get(w) ?? 0) + 1);
        total++;
      }
    }
    return Array.from(counts, ([beerId, n]) => ({ beerId, share: n / total }))
      .sort((a, b) => b.share - a.share);
  }, [dominance, viewportBounds]);

  const homeCell = winnerAt(dominance, user.homeLat, user.homeLon);

  // Scene light takes the colour of whoever rules the map centre
  const centerWinner = viewportBounds
    ? winnerAt(dominance, (viewportBounds.south + viewportBounds.north) / 2, (viewportBounds.west + viewportBounds.east) / 2)?.winnerBeerId ?? null
    : null;
  useEffect(() => {
    mapRef.current?.setAmbient(centerWinner ? beerColor(centerWinner) : null);
  }, [centerWinner]);

  const selected = useMemo(() => {
    if (!selectedPoint || !dominance) return { cell: null, region: null };
    const { data, regions: rs, labels } = dominance.result;
    const pos = cellAt(data.gridSpec, data.rows, data.cols, selectedPoint.lat, selectedPoint.lon);
    if (!pos) return { cell: null, region: null };
    return {
      cell: data.cells[pos.row * data.cols + pos.col] ?? null,
      region: findRegionForCell(pos.row, pos.col, { regions: rs, labels }, data),
    };
  }, [selectedPoint, dominance]);

  const friendMarkers = useMemo<FriendMarker[]>(() => {
    const out: FriendMarker[] = [];
    for (const fs of friendships) {
      if (fs.status !== 'accepted') continue;
      const friendId = fs.userIds[0] === user.id ? fs.userIds[1] : fs.userIds[0];
      const profile = remoteUsers.find((u) => u.userId === friendId);
      if (!profile || (profile.homeLat === 0 && profile.homeLon === 0)) continue;
      const presence = friendPresence.get(friendId);
      out.push({
        userId: friendId,
        lat: profile.homeLat,
        lon: profile.homeLon,
        beerId: profile.beerId,
        online: presence ? Date.now() - presence.lastSeen < GAME.PRESENCE_ONLINE_THRESHOLD_MS : false,
      });
    }
    return out;
  }, [friendships, remoteUsers, friendPresence, user.id]);

  const visitedVenueIds = useMemo(() => new Set(venueState.myVisits.map((v) => v.venueId)), [venueState.myVisits]);
  const venuePoints = useMemo<VenuePoint[]>(() => venueState.venues.map((v) => {
    const st = venueState.standings.get(v.id);
    return {
      id: v.id,
      lat: v.lat,
      lon: v.lon,
      name: v.name,
      beerId: st?.ownerBeerId ?? null,
      points: st?.scores[0]?.points ?? 0,
      contested: !!st?.ownerBeerId && !!st.challengerBeerId && st.toFlip > 0 && st.toFlip <= 6,
      visited: visitedVenueIds.has(v.id),
    };
  }), [venueState.venues, venueState.standings, visitedVenueIds]);

  const selectedVenueId = sheet?.kind === 'venue' ? sheet.venueId : null;
  const selectedVenue = selectedVenueId ? venueState.venues.find((v) => v.id === selectedVenueId) ?? null : null;

  const home = useMemo(() => ({ lat: user.homeLat, lon: user.homeLon, beerId: user.beerId }),
    [user.homeLat, user.homeLon, user.beerId]);

  const hasUnread = Array.from(unreadCounts.values()).some((c) => c > 0);

  // ── Actions
  const openTab = useCallback((tab: TabId) => {
    haptic('light');
    setSelectedPoint(null);
    setSheet((prev) => (prev?.kind === 'tab' && prev.tab === tab ? null : { kind: 'tab', tab }));
  }, []);

  const openProst = useCallback(() => {
    haptic('medium');
    setSheet((prev) => (prev?.kind === 'prost' ? null : { kind: 'prost' }));
  }, []);

  const closeSheet = useCallback(() => {
    setSheet(null);
    setSelectedPoint(null);
  }, []);

  const handleVenueTap = useCallback((venueId: string) => {
    haptic('light');
    setSelectedPoint(null);
    setSheet({ kind: 'venue', venueId });
  }, []);

  const handleMapTap = useCallback((lat: number, lon: number) => {
    haptic('light');
    setSelectedPoint({ lat, lon });
    setSheet({ kind: 'territory' });
  }, []);

  const placeDemoVote = useCallback(() => {
    if (!devTools || !demoBeerId || !selectedPoint) return;
    const vote: Vote = {
      id: `${user.id}_${Date.now()}`,
      lat: selectedPoint.lat,
      lon: selectedPoint.lon,
      beerId: demoBeerId,
      timestamp: Date.now(),
    };
    if (online) saveLegacyVote(vote).catch(() => {});
    setVotes((prev) => [...prev, vote]);
    appEvents.emit({ type: 'vote:saved', vote });
    haptic('light');
    mapRef.current?.pulseAt(vote.lat, vote.lon, beerColor(vote.beerId));
  }, [devTools, demoBeerId, selectedPoint, user.id, online]);

  const handleAddVotes = useCallback((newVotes: Vote[]) => {
    if (!devTools) return;
    if (online) saveLegacyVotes(newVotes).catch(() => {});
    setVotes((prev) => [...prev, ...newVotes]);
    for (const v of newVotes) appEvents.emit({ type: 'vote:saved', vote: v });
  }, [devTools, online]);

  const handleClearVotes = useCallback(() => {
    if (!devTools) return;
    if (online) clearLegacyVotes().catch(() => {});
    setVotes([]);
  }, [devTools, online]);

  const handleShareRegion = useCallback((region: Region) => {
    const beer = BEER_MAP.get(region.beerId);
    const runner = region.runnerUpBeerId ? BEER_MAP.get(region.runnerUpBeerId) : null;
    setSharePayload({
      regionId: region.id,
      beerId: region.beerId,
      beerName: beer?.name ?? region.beerId,
      centroidLat: region.centroidLat,
      centroidLon: region.centroidLon,
      zoom: 12,
      cellCount: region.cellCount,
      totalVotes: region.totalVotes,
      avgMargin: region.avgMargin,
      runnerUpName: runner?.name ?? null,
    });
  }, []);

  const handleUserUpdate = useCallback((updated: User) => {
    setUser(updated);
  }, []);

  const handleCheckedIn = useCallback((vote: DrinkVote) => {
    const prev = winnerAt(dominance, vote.lat, vote.lon);
    pendingFlipRef.current = { lat: vote.lat, lon: vote.lon, beerId: vote.beerId, prevWinner: prev?.winnerBeerId ?? null };
    setSheet(null);
    mapRef.current?.flyTo(vote.lat, vote.lon, 13);
    setTimeout(() => mapRef.current?.pulseAt(vote.lat, vote.lon, beerColor(vote.beerId)), 900);
    setCelebration({
      id: Date.now(),
      beerId: vote.beerId,
      title: t('celebrate.prost'),
      subtitle: t('celebrate.drinkCheckIn', { beer: beerName(vote.beerId) }),
    });
    loadWeightedVotes().catch(() => {});
  }, [dominance, loadWeightedVotes]);

  const { checkIn: venueCheckIn, addCheckins, addVenues } = venueState;
  const handleVenueCheckIn = useCallback(async (beerId: string, alcoholFree: boolean) => {
    if (!selectedVenue) return;
    const { before, after } = await venueCheckIn(selectedVenue, beerId, alcoholFree);
    const v = selectedVenue;
    mapRef.current?.pulseAt(v.lat, v.lon, beerColor(beerId));
    if (after.ownerBeerId === beerId && before.ownerBeerId !== beerId) {
      haptic('heavy');
      conquer();
      setCelebration({
        id: Date.now(),
        beerId,
        title: t('celebrate.takenOver'),
        subtitle: before.ownerBeerId
          ? t('celebrate.takeoverFrom', { venue: v.name, beer: beerName(beerId), prev: beerName(before.ownerBeerId) })
          : t('celebrate.takeoverFree', { venue: v.name, beer: beerName(beerId) }),
        epic: true,
      });
    } else {
      const flip = after.ownerBeerId !== beerId && after.challengerBeerId === beerId && after.toFlip > 0
        ? ` ${t('celebrate.toFlip', { points: pointsLabel(after.toFlip) })}`
        : '';
      setCelebration({
        id: Date.now(),
        beerId,
        title: t('celebrate.prost'),
        subtitle: after.ownerBeerId === beerId
          ? t('celebrate.defend', { venue: v.name, beer: beerName(beerId) })
          : t('celebrate.visit', { points: INFLUENCE.VISIT, beer: beerName(beerId), venue: v.name }) + flip,
      });
    }
  }, [selectedVenue, venueCheckIn]);

  // Prost → "Which pub am I in?": GPS (demo: map centre), pubs within reach
  const locateNearby = useCallback(async (): Promise<LocateResult> => {
    let pos: { lat: number; lon: number };
    try {
      pos = await acquireGpsSamples(1);
    } catch {
      if (!isDemo) return { ok: false, reason: 'no-location' };
      pos = mapCenterRef.current;
    }
    const d = 0.004;
    const tiles = tilesForViewport({ south: pos.lat - d, north: pos.lat + d, west: pos.lon - d * 1.5, east: pos.lon + d * 1.5 });
    let venues;
    try {
      venues = await loadVenues(tiles);
    } catch {
      return { ok: false, reason: 'network' };
    }
    const nearby = venues
      .map((v) => ({ venue: v, distance: haversineDistanceKm(pos.lat, pos.lon, v.lat, v.lon) * 1000 }))
      .filter((x) => x.distance <= (isDemo ? 400 : CHECKIN_RADIUS_M + 90))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 6);
    addVenues(nearby.map((x) => x.venue));
    return { ok: true, nearby };
  }, [isDemo, addVenues]);

  const openVenue = useCallback((v: { id: string; lat: number; lon: number }) => {
    mapRef.current?.flyTo(v.lat, v.lon, 17);
    setSheet({ kind: 'venue', venueId: v.id });
  }, []);

  // Legacy prost panel: jump straight to the nearest pub
  const findVenueHere = useCallback(async () => {
    const r = await locateNearby();
    if (!r.ok || r.nearby.length === 0) {
      showToast('🍺', t('toast.noPubNearby'));
      return;
    }
    openVenue(r.nearby[0].venue);
  }, [locateNearby, openVenue, showToast]);

  // Demo: a crowd of simulated regulars visits the venues on screen
  const simulateVenueCrowd = useCallback(async () => {
    if (!devTools) return;
    const bounds = viewportBounds;
    const inView = venueState.venues.filter((v) => !bounds
      || (v.lat >= bounds.south && v.lat <= bounds.north && v.lon >= bounds.west && v.lon <= bounds.east));
    if (inView.length === 0) {
      showToast('🔍', t('toast.zoomCloser'));
      return;
    }
    const country = nearestCity(mapCenterRef.current.lat, mapCenterRef.current.lon).country;
    const local = BEERS.filter((b) => b.country === country);
    const pool = local.length >= 3 ? local : BEERS;
    const now = Date.now();
    const visits: VenueCheckin[] = [];
    for (const v of inView) {
      const favourite = v.beerIds[0] ?? pool[Math.floor(Math.random() * pool.length)].id;
      const rival = pool[Math.floor(Math.random() * pool.length)].id;
      const n = Math.floor(Math.random() * 7);
      for (let i = 0; i < n; i++) {
        const player = await venuePlayerId(`sim_${Math.floor(Math.random() * 40)}`, v.id, utcWeek(now));
        visits.push({
          id: `sim_${v.id}_${now}_${i}`,
          player,
          venueId: v.id,
          tile: v.tile,
          beerId: Math.random() < 0.55 ? rival : favourite,
          alcoholFree: Math.random() < 0.12,
          createdAt: now - Math.floor(Math.random() * 20 * 86_400_000),
        });
      }
    }
    const demoStore = store as StorageInterface & { simulateVenueCrowd?: (v: VenueCheckin[]) => Promise<void> };
    await demoStore.simulateVenueCrowd?.(visits).catch(() => {});
    addCheckins(visits);
    showToast('🍻', t('toast.simulated', { visits: visits.length, venues: inView.length }));
  }, [devTools, viewportBounds, venueState.venues, store, addCheckins, showToast]);

  const endCelebration = useCallback(() => setCelebration(null), []);

  const toggle3d = () => {
    haptic('light');
    setIs3d(mapRef.current?.toggle3d() ?? false);
  };

  // ── Sheet content
  let sheetTitle: string = '';
  let sheetBody: ReactNode = null;
  if (sheet?.kind === 'prost') {
    sheetTitle = t('sheet.prost');
    sheetBody = !LEGACY_FEATURES ? (
      <PubFinder locate={locateNearby} standings={venueState.standings} onOpen={openVenue} />
    ) : (
      <ProstPanel
        user={user}
        store={store}
        onCheckedIn={handleCheckedIn}
        demoLocation={isDemo ? mapCenterRef.current : null}
        onFindVenue={findVenueHere}
      />
    );
  } else if (sheet?.kind === 'venue') {
    const standing = selectedVenue ? venueState.standings.get(selectedVenue.id) : undefined;
    sheetTitle = selectedVenue ? venueKindLabel(selectedVenue.kind) : t('sheet.venue');
    sheetBody = selectedVenue && standing ? (
      <VenueCard
        key={selectedVenue.id}
        venue={selectedVenue}
        standing={standing}
        myVisits={venueState.myVisits}
        playerBeerId={user.beerId}
        isDemo={isDemo}
        onCheckIn={handleVenueCheckIn}
      />
    ) : (
      <div className="empty"><span className="spinner" /> {t('common.loadingDots')}</div>
    );
  } else if (sheet?.kind === 'brewery') {
    sheetTitle = t('sheet.brewery');
    sheetBody = (
      <BreweryCockpit
        initialBeerId={user.beerId}
        venues={venueState.venues}
        standings={venueState.standings}
        onOpenVenue={(v) => { mapRef.current?.flyTo(v.lat, v.lon, 16.5); setSheet({ kind: 'venue', venueId: v.id }); }}
      />
    );
  } else if (sheet?.kind === 'territory') {
    sheetTitle = selected.cell?.winnerBeerId ? t('sheet.territory') : t('sheet.freeLand');
    sheetBody = (
      <TerritoryCard
        cell={selected.cell}
        region={selected.region}
        isDemo={devTools}
        demoBeerId={demoBeerId}
        onShare={handleShareRegion}
        onProst={() => setSheet({ kind: 'prost' })}
        onDemoVote={placeDemoVote}
      />
    );
  } else if (sheet?.kind === 'tab') {
    sheetTitle = t(SHEET_TITLES[sheet.tab]);
    switch (sheet.tab) {
      case 'explore':
        sheetBody = (
          <>
            <button className="card cockpit-entry" onClick={() => setSheet({ kind: 'brewery' })}>
              <span className="cockpit-entry-icon" aria-hidden="true">🏭</span>
              <span className="cockpit-entry-text">
                <strong>{t('explore.cockpitTitle')}</strong>
                <span>{t('explore.cockpitSub')}</span>
              </span>
              <span className="cockpit-entry-go" aria-hidden="true">›</span>
            </button>
            <Leaderboard entries={leaderboard} ownBeerId={user.beerId} computing={computing} />
            <ExploreFeed items={feedItems} onNavigate={(lat, lon, zoom) => mapRef.current?.flyTo(lat, lon, zoom)} />
          </>
        );
        break;
      case 'crew':
        sheetBody = online ? (
          <>
            <FriendsPanel
              user={user}
              store={store}
              friendships={friendships}
              onOpenChat={(friendshipId, friendUser) => setChatTarget({ friendshipId, friendUser })}
              friendPresence={friendPresence}
              unreadCounts={unreadCounts}
              onLocateFriend={(lat, lon) => mapRef.current?.flyTo(lat, lon, 12)}
            />
            {LEGACY_FEATURES && <TeamPanel user={user} store={store} />}
          </>
        ) : (
          <>
            <div className="empty">
              <span className="empty-icon" aria-hidden="true">🍻</span>
              <span className="empty-title">{t('explore.crewDemoTitle')}</span>
              <span>{t('explore.crewDemoText')}</span>
            </div>
            {LEGACY_FEATURES && <TeamPanel user={user} store={store} />}
          </>
        );
        break;
      case 'quests':
        sheetBody = (
          <>
            <WeeklyPanel visits={venueState.myVisits} />
            {LEGACY_FEATURES && <QuestsPanel questState={questState.questState} catalog={questState.catalog} />}
          </>
        );
        break;
      case 'profile':
        sheetBody = (
          <>
            <PassportPanel visits={venueState.myVisits} onLocate={(venueId: string) => {
              const v = venueState.venues.find((x) => x.id === venueId);
              if (v) { mapRef.current?.flyTo(v.lat, v.lon, 16); handleVenueTap(v.id); }
            }} />
            {LEGACY_FEATURES && (
              <>
                <HomeStatus user={user} store={store} onUserUpdate={handleUserUpdate} />
                <OnTheRoadButton user={user} store={store} onVoteCreated={() => loadWeightedVotes().catch(() => {})} />
                <DuelPanel user={user} store={store} />
              </>
            )}
            {devTools && (
              <SimulationPanel
                onAddVotes={handleAddVotes}
                onClearVotes={handleClearVotes}
                demoBeerId={demoBeerId}
                onDemoBeerChange={setDemoBeerId}
                voteCount={votes.length}
                getCenter={getMapCenter}
                onSimulateVenues={simulateVenueCrowd}
              />
            )}
            <LogoutSection isDemo={isDemo} user={user} />
          </>
        );
        break;
    }
  }

  // Small status pill: where are the pubs?
  let venueHint: ReactNode = null;
  if (venueState.status === 'loading') venueHint = <><span className="spinner" /> {t('map.pubsLoading')}</>;
  else if (venueState.status === 'error') venueHint = <>{t('map.pubsError')} · <button onClick={venueState.reload}>{t('common.again')}</button></>;
  else if (venueState.status === 'zoom' && viewZoom >= VENUE_MIN_ZOOM - 2.5) venueHint = <>{t('map.zoomHint')}</>;

  const homeShare = homeCell && homeCell.totalCount > 0 && homeCell.winnerBeerId
    ? Math.round((homeCell.winnerCount / homeCell.totalCount) * 100)
    : null;

  return (
    <div className="app" style={{ '--c-beer': beerColor(user.beerId) } as CSSProperties}>
      <MapView
        ref={mapRef}
        geometry={dominance?.result.geometry ?? null}
        votes={votes}
        home={home}
        friends={friendMarkers}
        selectedPoint={selectedPoint}
        onMapTap={handleMapTap}
        onViewportChange={handleViewportChange}
        venues={venuePoints}
        selectedVenueId={selectedVenueId}
        onVenueTap={handleVenueTap}
      />

      <div className="map-vignette" aria-hidden="true" />

      {/* ── Top bar: home status + map controls */}
      <header className="topbar">
        <button
          className="status-chip glass"
          onClick={() => mapRef.current?.flyTo(user.homeLat, user.homeLon, 12)}
          aria-label={t('map.flyHome')}
        >
          <BeerBadge beerId={homeCell?.winnerBeerId ?? user.beerId} size="sm" />
          {isDemo && <span className="status-chip-demo">{t('common.demo')}</span>}
          <span className="status-chip-text">
            <span className="status-chip-label">
              {t('map.yourTurf')}
              {homeCell?.winnerBeerId && homeCell.winnerBeerId !== user.beerId && (
                <span className="status-chip-alert">{t('map.threatened')}</span>
              )}
            </span>
            <span className="status-chip-value">
              {homeCell?.winnerBeerId
                ? <>{beerName(homeCell.winnerBeerId)}{homeShare !== null && (
                  <span className="num status-chip-pct"> · <NumberFlow value={homeShare} locales={intlLocale()} suffix={percentSuffix()} /></span>
                )}</>
                : dominance ? t('map.notInView') : t('map.computing')}
            </span>
          </span>
        </button>

        <div className="map-controls">
          {online && onlineCount > 0 && (
            <span className="online-pill glass" role="status" aria-label={t('map.playersOnline', { count: onlineCount })}>
              <span className="online-dot" /> <span className="num">{onlineCount}</span>
            </span>
          )}
          {computing && <span className="computing glass" role="status" aria-label={t('map.computingMap')}><span className="spinner" aria-hidden="true" /></span>}
          <button className="icon-btn glass" onClick={toggle3d} aria-pressed={is3d} aria-label={t('map.toggle3d')}>
            <span className="ctrl-3d">{is3d ? '2D' : '3D'}</span>
          </button>
          <button
            className="icon-btn glass"
            onClick={() => mapRef.current?.flyTo(user.homeLat, user.homeLon, 12)}
            aria-label={t('map.goHome')}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <circle cx="12" cy="12" r="7" /><circle cx="12" cy="12" r="2" fill="currentColor" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
            </svg>
          </button>
        </div>
      </header>


      {venueHint && (
        <div className={`venue-hint-pill glass${venueState.status === 'error' ? ' is-error' : ''}`} role="status">
          {venueHint}
        </div>
      )}

      <Sheet
        open={sheet !== null}
        title={sheetTitle}
        onClose={closeSheet}
        contentKey={sheet ? (sheet.kind === 'tab' ? sheet.tab : sheet.kind === 'venue' ? `venue-${sheet.venueId}` : sheet.kind) : 'none'}
        initialSnap={sheet?.kind === 'prost' ? 'full' : 'half'}
      >
        <ErrorBoundary variant="panel" resetKey={sheet ? JSON.stringify(sheet) : 'none'}>
          {sheetBody}
        </ErrorBoundary>
      </Sheet>

      <TabBar
        active={sheet?.kind === 'tab' ? sheet.tab : null}
        onSelect={openTab}
        onProst={openProst}
        prostActive={sheet?.kind === 'prost'}
        unreadCrew={hasUnread}
        questsDone={questsDone}
      />

      {chatTarget && (
        <div className="chat-screen" role="dialog" aria-modal="true" aria-label={t('map.chat')}>
          <ChatPanel
            user={user}
            friendshipId={chatTarget.friendshipId}
            friendUser={chatTarget.friendUser}
            friendPresence={friendPresence.get(chatTarget.friendUser.id)}
            onBack={() => setChatTarget(null)}
          />
        </div>
      )}

      {sharePayload && <ShareModal payload={sharePayload} onClose={() => setSharePayload(null)} />}
      {celebration && <Celebration key={celebration.id} data={celebration} onDone={endCelebration} />}
    </div>
  );
}

/** Demo sandbox + venue cache: close the open connections, then delete. */
async function deleteLocalData(): Promise<void> {
  const { default: Dexie } = await import('dexie');
  await Promise.all(['BrewCountryDB', 'BrewCountryVenues'].map((name) => Dexie.delete(name).catch(() => {})));
}

function LogoutSection({ isDemo, user }: { isDemo: boolean; user: User }) {
  const { logout } = useAuth();
  const { showToast } = useToast();
  const [sound, setSound] = useState(soundEnabled);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [password, setPassword] = useState('');
  const locale = useLocale();

  const deleteAccount = async () => {
    setDeleting(true);
    try {
      if (isDemo) {
        await deleteLocalData();
      } else {
        // Confirm first, so we never end up with half-deleted data
        await reauthenticate(password);
        await deleteMyAccount(user.id);
        await deleteLocalData();
      }
      showToast('👋', t('profile.deleted'), 'success');
      logout();
    } catch (e) {
      const code = (e as { code?: string }).code;
      showToast('⚠️', code === 'auth/wrong-password' || code === 'auth/invalid-credential'
        ? t('profile.wrongPassword')
        : code === 'auth/requires-recent-login'
          ? t('profile.recentLogin')
          : t('profile.deleteFailed'), 'error');
      setDeleting(false);
    }
  };
  return (
    <section className="section">
      <h2 className="section-title">{t('profile.settings')}</h2>
      <div className="card settings-row">
        <span className="row-main">
          <span className="row-title" id="settings-language">{t('profile.language')}</span>
          <span className="row-sub">{t('profile.languageSub')}</span>
        </span>
        <div className="segmented settings-language" role="group" aria-labelledby="settings-language">
          {LOCALES.map((l) => (
            <button
              key={l}
              type="button"
              lang={l}
              aria-pressed={locale === l}
              onClick={() => { if (l !== locale) { setLocale(l); haptic('light'); } }}
            >
              {LOCALE_NAMES[l]}
            </button>
          ))}
        </div>
      </div>
      <div className="card settings-row">
        <span className="row-main">
          <span className="row-title">{t('profile.sounds')}</span>
          <span className="row-sub">{t('profile.soundsSub')}</span>
        </span>
        <button
          role="switch"
          aria-checked={sound}
          aria-label={t('profile.sounds')}
          className={`switch${sound ? ' on' : ''}`}
          onClick={() => { setSound(!sound); setSoundEnabled(!sound); haptic('light'); }}
        >
          <span />
        </button>
      </div>
      <p className="muted settings-responsible">
        {t('profile.responsible')}{' '}
        <a href={RESPONSIBLE_DRINKING_URL} target="_blank" rel="noopener noreferrer">kenn-dein-limit.de</a>
      </p>
      <button className="btn btn-secondary btn-block settings-logout" onClick={logout}>
        {isDemo ? t('profile.endDemo') : t('profile.logout')}
      </button>
      {!confirmDelete ? (
        <button className="btn btn-ghost btn-block settings-delete" onClick={() => setConfirmDelete(true)}>
          {t('profile.deleteAccount')}
        </button>
      ) : (
        <div className="card settings-danger" role="alert">
          <p><strong>{t('profile.deleteQuestion')}</strong> {t('profile.deleteText')}</p>
          {!isDemo && (
            <label className="field">
              <span className="field-label">{t('profile.passwordConfirm')}</span>
              <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </label>
          )}
          <div className="settings-danger-actions">
            <button className="btn btn-danger" onClick={deleteAccount} disabled={deleting || (!isDemo && password.length === 0)}>
              {deleting ? <><span className="spinner" aria-hidden="true" /> {t('profile.deleting')}</> : t('profile.deleteYes')}
            </button>
            <button className="btn btn-ghost" onClick={() => setConfirmDelete(false)} disabled={deleting}>{t('common.cancel')}</button>
          </div>
        </div>
      )}
      <LegalLinks className="settings-legal" />
    </section>
  );
}
