import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { Vote, DominanceResult, GridSpec, OverlaySettings, ViewportBounds, Region, SharePayload, WeightedVote, User, Friendship } from './domain/types';
import { getDefaultBoundingBox, getViewportGridSpec } from './domain/geo';
import { GAME } from './config/constants';
import type { StorageInterface } from './storage/StorageInterface';
import { BEER_MAP } from './domain/beers';
import { extractRegions } from './domain/regions';
import { appEvents } from './domain/events';
import { buildWeightedVotes } from './domain/weights';
import { decodeShareLink, clearShareParams } from './domain/shareLink';
import { useAuth } from './auth/AuthProvider';
import { GoogleLogin } from './auth/GoogleLogin';
import { GoogleRedirectStart } from './auth/GoogleRedirectStart';
import { Onboarding } from './auth/Onboarding';
import { ResetLocation } from './auth/ResetLocation';
import { MapView, type MapViewHandle } from './ui/MapView';
import { BeerPicker } from './ui/BeerPicker';
import { SimulationPanel } from './ui/SimulationPanel';
import { Legend } from './ui/Legend';
import { QuestsPanel } from './ui/QuestsPanel';
import { ExploreFeed } from './ui/ExploreFeed';
import { ShareModal } from './ui/ShareModal';
import { HomeStatus } from './ui/HomeStatus';
import { DuelPanel } from './ui/DuelPanel';
import { OnTheRoadButton } from './ui/OnTheRoadButton';
import { DrinkVoteButton } from './ui/DrinkVoteButton';
import { TeamPanel } from './ui/TeamPanel';
import { FriendsPanel } from './ui/FriendsPanel';
import { ChatPanel } from './ui/ChatPanel';
import { useToast } from './ui/Toast';
import { useQuests } from './hooks/useQuests';
import { useFeed } from './hooks/useFeed';
import { usePresence } from './hooks/usePresence';
import { useChatNotifications } from './hooks/useChatNotifications';
import { isFirebaseConfigured } from './config/firebase';
import {
  clearLegacyVotes,
  saveLegacyVote,
  saveLegacyVotes,
  saveUserProfile,
  subscribeAllUsers,
  subscribeFriends,
  subscribeLegacyVotes,
  type FirestoreUserProfile,
} from './services/firestoreService';
import './App.css';

const fallbackGridSpec: GridSpec = getDefaultBoundingBox();
const RADIUS_KM = GAME.HOME_RADIUS_KM;

const FIXED_OVERLAY_SETTINGS: OverlaySettings = {
  showBorders: true,
  showLogos: true,
  showSwords: true,
  borderWidth: GAME.BORDER_WIDTH,
  closeMarginThreshold: GAME.CLOSE_MARGIN_THRESHOLD,
  smoothingIterations: GAME.SMOOTHING_ITERATIONS,
  mergeIslandSize: GAME.MERGE_ISLAND_SIZE,
};

interface AppProps {
  store: StorageInterface;
}

export default function App({ store }: AppProps) {
  const { auth, updateUser, updateLastActive } = useAuth();

  // Show auth screens if not authenticated
  if (auth.status === 'loading') {
    return (
      <div className="auth-screen">
        <div className="auth-card" style={{ textAlign: 'center' }}>
          <h1 className="auth-title">Brew Country</h1>
          <p className="auth-subtitle">Laden...</p>
        </div>
      </div>
    );
  }

  if (auth.status === 'unauthenticated') {
    if (window.location.hash === '#google-login-start') {
      return <GoogleRedirectStart />;
    }
    return <GoogleLogin />;
  }

  if (auth.status === 'onboarding') {
    return <Onboarding />;
  }

  // User authenticated but home location missing (e.g. admin wiped data)
  if (auth.user.homeLat === 0 && auth.user.homeLon === 0) {
    return (
      <ResetLocation
        user={auth.user}
        onLocationSet={async (updatedUser) => {
          await updateUser(updatedUser);
        }}
      />
    );
  }

  return <GameApp user={auth.user} store={store} onActivity={updateLastActive} />;
}

// ── Main game app (after auth) ──────────────────────────

interface GameAppProps {
  user: User;
  store: StorageInterface;
  onActivity: () => Promise<void>;
}

function GameApp({ user: initialUser, store, onActivity }: GameAppProps) {
  const [user, setUser] = useState<User>(initialUser);
  const [votes, setVotes] = useState<Vote[]>([]);
  const [weightedVotes, setWeightedVotes] = useState<WeightedVote[]>([]);
  const [selectedBeerId, setSelectedBeerId] = useState<string | null>(user.beerId);
  const [dominanceData, setDominanceData] = useState<DominanceResult | null>(null);
  const [computing, setComputing] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [overlaySettings] = useState<OverlaySettings>(FIXED_OVERLAY_SETTINGS);
  const [viewportBounds, setViewportBounds] = useState<ViewportBounds | null>(null);
  const [gridSpec, setGridSpec] = useState<GridSpec>(fallbackGridSpec);
  const [sharePayload, setSharePayload] = useState<SharePayload | null>(null);
  const [chatTarget, setChatTarget] = useState<{ friendshipId: string; friendUser: User } | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const mapRef = useRef<MapViewHandle>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Toast system
  const { showToast } = useToast();

  // Presence hook (heartbeat + online count + friend presence)
  const { onlineCount, friendPresence, setFriendIds } = usePresence(user.id);

  // All remote users from Firestore (for shared map)
  const [remoteUsers, setRemoteUsers] = useState<FirestoreUserProfile[]>([]);

  // Friendships state (for chat notifications)
  const [friendships, setFriendships] = useState<Friendship[]>([]);

  // Subscribe to friendships for notification tracking
  useEffect(() => {
    if (!isFirebaseConfigured()) return;
    const unsub = subscribeFriends(user.id, (fs) => {
      setFriendships(fs);
    });
    return () => unsub();
  }, [user.id]);

  // Chat notifications — toast on new message + unread badge
  const { unreadCounts } = useChatNotifications({
    userId: user.id,
    friendships,
    openChatFriendshipId: chatTarget?.friendshipId ?? null,
    onNewMessage: useCallback((_friendshipId: string, message: { text: string }) => {
      // Truncate long messages for the toast
      const preview = message.text.length > 60
        ? message.text.slice(0, 57) + '...'
        : message.text;
      showToast('💬', preview);
    }, [showToast]),
  });

  // Sync user profile to Firestore (with location) so other users see us on the map
  useEffect(() => {
    if (isFirebaseConfigured() && user.id && user.beerId) {
      saveUserProfile(user.id, user.beerId, user.homeLat, user.homeLon).catch(() => {});
    }
  }, [user.id, user.beerId, user.homeLat, user.homeLon]);

  // Subscribe to all users from Firestore for shared map
  useEffect(() => {
    if (!isFirebaseConfigured()) return;
    const unsub = subscribeAllUsers((users) => {
      setRemoteUsers(users);
    });
    return () => unsub();
  }, []);

  // Subscribe to legacy simulation votes in Firestore
  useEffect(() => {
    if (!isFirebaseConfigured()) return;
    const unsub = subscribeLegacyVotes((serverVotes) => {
      setVotes(serverVotes);
    });
    return () => unsub();
  }, []);

  const userId = user.id;
  const userVotePosition = { lat: user.homeLat, lon: user.homeLon };

  // Build friend locations for map markers (accepted friends only)
  const friendLocations = useMemo(() => {
    const accepted = friendships.filter((f) => f.status === 'accepted');
    const locations: { userId: string; lat: number; lon: number; beerId: string; online: boolean }[] = [];

    for (const fs of accepted) {
      const friendId = fs.userIds[0] === user.id ? fs.userIds[1] : fs.userIds[0];
      const profile = remoteUsers.find((u) => u.userId === friendId);
      if (!profile || (profile.homeLat === 0 && profile.homeLon === 0)) continue;

      const presence = friendPresence.get(friendId);
      const online = presence ? Date.now() - presence.lastSeen < GAME.PRESENCE_ONLINE_THRESHOLD_MS : false;

      locations.push({
        userId: friendId,
        lat: profile.homeLat,
        lon: profile.homeLon,
        beerId: profile.beerId,
        online,
      });
    }

    return locations;
  }, [friendships, remoteUsers, friendPresence, user.id]);

  // Extract regions whenever dominance data changes
  const regions: Region[] = useMemo(() => {
    if (!dominanceData) return [];
    return extractRegions(dominanceData);
  }, [dominanceData]);

  // Quests hook
  const { questState, catalog } = useQuests(user.id, overlaySettings);

  // Feed hook
  const feedItems = useFeed(dominanceData, regions, votes, viewportBounds);

  // Update last active on mount
  useEffect(() => {
    onActivity();
  }, [onActivity]);

  // Build weighted votes from Firestore users (shared map) + local data
  const loadWeightedVotes = useCallback(async () => {
    // Convert remote Firestore profiles to User objects for weight calculation
    const firestoreUsers: User[] = remoteUsers.map((p) => ({
      id: p.userId,
      phone: null,
      createdAt: p.createdAt,
      lastActiveAt: p.lastActiveAt,
      homeLat: p.homeLat,
      homeLon: p.homeLon,
      beerId: p.beerId,
      standYourGroundEnabled: false,
      ageVerified: true,
    }));

    // Merge: use Firestore users as base, overlay local user data for self
    const localUsers = await store.getAllUsers();
    const mergedMap = new Map<string, User>();
    for (const u of firestoreUsers) {
      mergedMap.set(u.id, u);
    }
    // Local user data takes priority for the current user (has more fields)
    for (const u of localUsers) {
      mergedMap.set(u.id, u);
    }
    const allUsers = Array.from(mergedMap.values());

    const allOTR = await store.getAllOTRVotes();
    const allTeams = await store.getAllTeams();
    const allDrink = await store.getAllDrinkVotes();

    // Build outcomes map
    const outcomesMap = new Map<string, Awaited<ReturnType<typeof store.getDuelOutcomes>>>();
    for (const u of allUsers) {
      const o = await store.getDuelOutcomes(u.id);
      outcomesMap.set(u.id, o);
    }

    const wv = buildWeightedVotes(allUsers, allOTR, allTeams, outcomesMap, allDrink);
    setWeightedVotes(wv);
  }, [store, remoteUsers]);

  // Reload weighted votes when remote users or local user changes
  useEffect(() => {
    loadWeightedVotes();
  }, [loadWeightedVotes, user]);

  // Periodic cleanup of expired votes/outcomes (every 5 min + on mount)
  useEffect(() => {
    const cleanup = async () => {
      await store.removeExpiredOTRVotes();
      await store.removeExpiredDrinkVotes();
      await store.removeExpiredOutcomes();
    };
    cleanup();
    const id = setInterval(cleanup, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [store]);

  // Worker lifecycle
  useEffect(() => {
    const worker = new Worker(
      new URL('./workers/dominanceWorker.ts', import.meta.url),
      { type: 'module' }
    );

    worker.onmessage = (e: MessageEvent) => {
      if (e.data.type === 'result') {
        const d = e.data.data;
        setDominanceData(d);
        setComputing(false);
      }
    };

    workerRef.current = worker;

    return () => {
      worker.terminate();
    };
  }, []);

  // Emit dominance:computed event when data + regions change
  useEffect(() => {
    if (dominanceData && regions.length > 0) {
      appEvents.emit({ type: 'dominance:computed', data: dominanceData, regions });
    }
  }, [dominanceData, regions]);

  // ── Debounced viewport/zoom → dynamic gridSpec ──────────
  const handleViewportChange = useCallback(
    (bounds: ViewportBounds, zoom: number) => {
      // Always store raw values for feed etc.
      setViewportBounds(bounds);

      // Debounce the heavy grid recomputation
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(() => {
        const newSpec = getViewportGridSpec(bounds, zoom);
        setGridSpec(newSpec);
      }, GAME.VIEWPORT_DEBOUNCE_MS);
    },
    [],
  );

  // Recompute dominance when gridSpec, votes, or weighted votes change
  useEffect(() => {
    const worker = workerRef.current;
    if (!worker) return;

    setComputing(true);
    worker.postMessage({
      votes,
      weightedVotes: weightedVotes.length > 0 ? weightedVotes : undefined,
      gridSpec,
      radiusKm: RADIUS_KM,
      smoothingIterations: overlaySettings.smoothingIterations,
      mergeIslandSize: overlaySettings.mergeIslandSize,
    });
  }, [votes, weightedVotes, gridSpec, overlaySettings.smoothingIterations, overlaySettings.mergeIslandSize]);

  // Handle share link on load
  useEffect(() => {
    const shareData = decodeShareLink();
    if (shareData) {
      setTimeout(() => {
        mapRef.current?.flyTo(shareData.centroidLat, shareData.centroidLon, shareData.zoom);
      }, 500);
      clearShareParams();
    }
  }, []);

  // Map click is disabled in production — home location is fixed via GPS onboarding.
  // Only in DEV mode can you click to place simulation votes.
  const handleMapClick = useCallback(
    (lat: number, lon: number) => {
      if (!import.meta.env.DEV) return; // Production: no click-to-vote
      if (!selectedBeerId) return;

      const vote: Vote = {
        id: userId,
        lat,
        lon,
        beerId: selectedBeerId,
        timestamp: Date.now(),
      };

      saveLegacyVote(vote).catch(() => {});
      appEvents.emit({ type: 'vote:saved', vote });
    },
    [selectedBeerId, userId]
  );

  const handleAddVotes = useCallback((newVotes: Vote[]) => {
    if (!import.meta.env.DEV) return;
    saveLegacyVotes(newVotes).catch(() => {});

    for (const v of newVotes) {
      appEvents.emit({ type: 'vote:saved', vote: v });
    }
  }, []);

  const handleClearVotes = useCallback(() => {
    if (!import.meta.env.DEV) return;
    clearLegacyVotes().catch(() => {});
    setVotes([]);
    setDominanceData(null);
  }, []);

  const handleFeedNavigate = useCallback((lat: number, lon: number, zoom: number) => {
    mapRef.current?.flyTo(lat, lon, zoom);
  }, []);

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
    loadWeightedVotes();
  }, [loadWeightedVotes]);

  const handleOTRCreated = useCallback(() => {
    loadWeightedVotes();
  }, [loadWeightedVotes]);

  const handleDrinkVoteCreated = useCallback(() => {
    loadWeightedVotes();
  }, [loadWeightedVotes]);

  return (
    <div className="app">
      <header className="app-header">
        <h1>Brew Country</h1>
        <span className="app-subtitle">Bier-Dominanz-Karte</span>
        {computing && <span className="computing-badge">Berechne...</span>}
        {isFirebaseConfigured() && onlineCount > 0 && (
          <span className="online-badge">
            <span className="online-dot" />
            {onlineCount} online
          </span>
        )}
        <button
          className="sidebar-toggle"
          onClick={() => setSidebarOpen(!sidebarOpen)}
        >
          {sidebarOpen ? '\u2715' : '\u2630'}
        </button>
      </header>

      <div className="app-body">
        <MapView
          ref={mapRef}
          votes={votes}
          dominanceData={dominanceData}
          regions={regions}
          gridSpec={gridSpec}
          userVotePosition={userVotePosition}
          onMapClick={handleMapClick}
          overlaySettings={overlaySettings}
          onViewportChange={handleViewportChange}
          onShareRegion={handleShareRegion}
          friendLocations={friendLocations}
        />

        {sidebarOpen && (
          <aside className="sidebar">
            {chatTarget ? (
              <ChatPanel
                user={user}
                friendshipId={chatTarget.friendshipId}
                friendUser={chatTarget.friendUser}
                friendPresence={friendPresence.get(chatTarget.friendUser.id)}
                onBack={() => setChatTarget(null)}
              />
            ) : (
              <div className="sidebar-scroll">
                <HomeStatus
                  user={user}
                  store={store}
                  onUserUpdate={handleUserUpdate}
                />
                <DuelPanel user={user} store={store} />
                <OnTheRoadButton
                  user={user}
                  store={store}
                  onVoteCreated={handleOTRCreated}
                />
                <DrinkVoteButton
                  user={user}
                  store={store}
                  onVoteCreated={handleDrinkVoteCreated}
                />
                <TeamPanel user={user} store={store} />
                <FriendsPanel
                  user={user}
                  store={store}
                  onOpenChat={(friendshipId, friendUser) => setChatTarget({ friendshipId, friendUser })}
                  friendPresence={friendPresence}
                  onFriendIdsChange={setFriendIds}
                  unreadCounts={unreadCounts}
                  onLocateFriend={(lat, lon) => mapRef.current?.flyTo(lat, lon, 12)}
                />
                <BeerPicker
                  selectedBeerId={selectedBeerId}
                  onSelect={setSelectedBeerId}
                />
                <Legend
                  voteCount={votes.length}
                  showSwords={overlaySettings.showSwords}
                />
                <QuestsPanel
                  questState={questState}
                  catalog={catalog}
                />
                <ExploreFeed
                  items={feedItems}
                  onNavigate={handleFeedNavigate}
                />
                {import.meta.env.DEV && (
                  <SimulationPanel
                    onAddVotes={handleAddVotes}
                    onClearVotes={handleClearVotes}
                  />
                )}
              </div>
            )}
          </aside>
        )}
      </div>

      {sharePayload && (
        <ShareModal
          payload={sharePayload}
          onClose={() => setSharePayload(null)}
        />
      )}
    </div>
  );
}
