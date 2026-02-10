export interface Beer {
  id: string;
  name: string;
  color: string;
  svgLogo: string;
  /** Optional URL to a real brewery logo image */
  logoUrl?: string;
}

export interface Vote {
  id: string;
  lat: number;
  lon: number;
  beerId: string;
  timestamp: number;
}

export interface GridSpec {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
  cellSizeMeters: number;
}

export interface GridCell {
  row: number;
  col: number;
  centerLat: number;
  centerLon: number;
}

export interface CellResult {
  row: number;
  col: number;
  winnerBeerId: string | null;
  /** Winner's summed weight (was: count) */
  winnerCount: number;
  /** Total summed weight across all beers (was: total count) */
  totalCount: number;
  /** Per-beer summed weights (was: vote counts) */
  voteCounts: Record<string, number>;
  /** Runner-up beer id (second place) */
  runnerUpBeerId: string | null;
  /** Runner-up weight */
  runnerUpCount: number;
  /** Margin: (winnerWeight - runnerUpWeight) / max(totalWeight, 0.001), 0..1 */
  margin: number;
}

export interface DominanceResult {
  rows: number;
  cols: number;
  cells: CellResult[];
  gridSpec: GridSpec;
}

export interface OverlaySettings {
  showBorders: boolean;
  showLogos: boolean;
  showSwords: boolean;
  borderWidth: number;
  closeMarginThreshold: number;
  smoothingIterations: number;
  mergeIslandSize: number;
}

export interface WorkerInput {
  votes: Vote[];
  weightedVotes?: WeightedVote[];
  gridSpec: GridSpec;
  radiusKm: number;
  smoothingIterations: number;
  mergeIslandSize: number;
}

export interface WorkerOutput {
  type: 'result';
  data: DominanceResult;
}

// ── Regions ──────────────────────────────────────────────
export interface Region {
  id: string;
  beerId: string;
  cellCount: number;
  centroidLat: number;
  centroidLon: number;
  boundingBox: { minRow: number; maxRow: number; minCol: number; maxCol: number };
  avgMargin: number;
  totalVotes: number;
  /** Runner-up beer across the region (most common) */
  runnerUpBeerId: string | null;
}

export interface ViewportBounds {
  south: number;
  north: number;
  west: number;
  east: number;
}

// ── User ────────────────────────────────────────────────
export interface User {
  id: string;
  phone: string | null;
  email?: string | null;
  nickname?: string | null;
  createdAt: number;
  lastActiveAt: number;
  homeLat: number;
  homeLon: number;
  beerId: string;
  standYourGroundEnabled: boolean;
  ageVerified: boolean;
}

// ── Weighted Vote (for worker input) ────────────────────
export interface WeightedVote {
  id: string;
  lat: number;
  lon: number;
  beerId: string;
  weight: number;
  radiusKm: number;
  source: 'home' | 'otr' | 'drink';
}

// ── On The Road Vote ────────────────────────────────────
export interface OnTheRoadVote {
  id: string;
  userId: string;
  lat: number;
  lon: number;
  beerId: string;
  createdAt: number;
  expiresAt: number;
}

// ── Duel ────────────────────────────────────────────────
export type DuelStatus =
  | 'pending'
  | 'active'
  | 'completed'
  | 'declined'
  | 'timeout';

export interface Duel {
  id: string;
  challengerUserId: string;
  defenderUserId: string;
  challengerBeerId: string;
  defenderBeerId: string;
  status: DuelStatus;
  createdAt: number;
  acceptedAt: number | null;
  resolvedAt: number | null;
  winnerId: string | null;
  loserId: string | null;
  roundCount: number;
  lastActionAt: number;
  lastActionByUserId: string | null;
  regionLat: number;
  regionLon: number;
}

// ── Duel Message ────────────────────────────────────────
export interface DuelMessage {
  id: string;
  duelId: string;
  senderUserId: string;
  imageUrl: string;
  createdAt: number;
}

// ── Team ────────────────────────────────────────────────
export interface Team {
  id: string;
  beerId: string;
  memberUserIds: string[];
}

// ── Duel Outcome (active boost/penalty) ─────────────────
export interface DuelOutcome {
  duelId: string;
  userId: string;
  delta: number;
  expiresAt: number;
}

// ── Weight Breakdown (for UI display) ───────────────────
export interface WeightBreakdown {
  baseMultiplier: number;
  sygMultiplier: number;
  teamBoost: number;
  duelDelta: number;
  finalWeight: number;
  effectiveRadius: number;
  decayDaysRemaining: number;
}

// ── Drink Vote (Check-in) ────────────────────────────────
export interface DrinkVote {
  id: string;
  userId: string;
  beerId: string;
  lat: number;
  lon: number;
  placeKey: string;
  createdAt: number;
  expiresAt: number;
  gpsAccuracyM: number;
  proofPhotoUrl?: string;
  proofType: 'gps' | 'gps+photo';
}

// ── Friendship ───────────────────────────────────────────
export interface Friendship {
  id: string;                     // deterministic: sorted "{userA}_{userB}"
  userIds: [string, string];      // alphabetically sorted
  status: 'pending' | 'accepted'; // pending = request sent, accepted = mutual friends
  requestedBy: string;            // userId of the person who sent the request
  createdAt: number;
}

// ── Chat Message ─────────────────────────────────────────
export interface ChatMessage {
  id: string;
  senderId: string;
  text: string;
  createdAt: number;
}

// ── Presence ─────────────────────────────────────────────
export interface UserPresence {
  userId: string;
  lastSeen: number;               // epoch ms
}

// ── Events ───────────────────────────────────────────────
export type AppEvent =
  | { type: 'vote:saved'; vote: Vote }
  | { type: 'region:clicked'; region: Region; cell: CellResult | null }
  | { type: 'region:hovered'; region: Region; cell: CellResult | null }
  | { type: 'dominance:computed'; data: DominanceResult; regions: Region[] }
  | { type: 'user:updated'; user: User }
  | { type: 'duel:updated'; duel: Duel }
  | { type: 'otr:created'; vote: OnTheRoadVote }
  | { type: 'otr:expired'; voteId: string }
  | { type: 'drink:created'; vote: DrinkVote }
  | { type: 'drink:expired'; voteId: string }
  | { type: 'friend:added'; friendship: Friendship }
  | { type: 'friend:removed'; friendshipId: string }
  | { type: 'chat:message'; message: ChatMessage; friendshipId: string };

// ── Quests ───────────────────────────────────────────────
export interface QuestDefinition {
  id: string;
  title: string;
  description: string;
  icon: string;
  targetCount: number;
}

export interface QuestProgress {
  questId: string;
  currentCount: number;
  completed: boolean;
  completedAt: number | null;
  trackedIds: string[];
}

export interface QuestState {
  progress: Record<string, QuestProgress>;
}

// ── Feed ─────────────────────────────────────────────────
export type FeedItemType = 'battlefront' | 'flip-watch' | 'trending';

export interface FeedItem {
  id: string;
  type: FeedItemType;
  title: string;
  subtitle: string;
  beerId: string | null;
  secondaryBeerId: string | null;
  lat: number;
  lon: number;
  zoom: number;
  priority: number;
  icon: string;
}

// ── Share ─────────────────────────────────────────────────
export interface SharePayload {
  regionId: string;
  beerId: string;
  beerName: string;
  centroidLat: number;
  centroidLon: number;
  zoom: number;
  cellCount: number;
  totalVotes: number;
  avgMargin: number;
  runnerUpName: string | null;
}

// ── Auth state ───────────────────────────────────────────
export type AuthState =
  | { status: 'loading' }
  | { status: 'unauthenticated' }
  | { status: 'verify-email'; userId: string; email: string; nickname: string }
  | { status: 'onboarding'; userId: string }
  | { status: 'authenticated'; userId: string; user: User };
