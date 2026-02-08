import { useState, useEffect, useCallback, useRef } from 'react';
import type { User, Friendship, UserPresence } from '../domain/types';
import type { StorageInterface } from '../storage/StorageInterface';
import { isFirebaseConfigured } from '../config/firebase';
import { GAME } from '../config/constants';
import { BEER_MAP } from '../domain/beers';
import { appEvents } from '../domain/events';
import {
  addFriend,
  removeFriend,
  subscribeFriends,
  makeFriendshipId,
  getUserProfile,
} from '../services/firestoreService';
import './FriendsPanel.css';

interface Props {
  user: User;
  store: StorageInterface;
  onOpenChat: (friendshipId: string, friendUser: User) => void;
  friendPresence: Map<string, UserPresence>;
  onFriendIdsChange: (ids: string[]) => void;
}

function formatLastActive(lastSeen: number): string {
  const diff = Date.now() - lastSeen;
  if (diff < 60_000) return 'Gerade aktiv';
  if (diff < 3600_000) return `Vor ${Math.floor(diff / 60_000)} Min.`;
  if (diff < 86400_000) return `Vor ${Math.floor(diff / 3600_000)} Std.`;
  return `Vor ${Math.floor(diff / 86400_000)} Tagen`;
}

export function FriendsPanel({ user, store, onOpenChat, friendPresence, onFriendIdsChange }: Props) {
  const [friendships, setFriendships] = useState<Friendship[]>([]);
  const [friendUsers, setFriendUsers] = useState<Map<string, User>>(new Map());
  const [addInput, setAddInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const prevFriendIdsRef = useRef<string>('');

  // Gate: Firebase not configured
  if (!isFirebaseConfigured()) {
    return (
      <div className="friends-panel">
        <h3>Freunde</h3>
        <p className="friends-disabled">Firebase nicht konfiguriert</p>
      </div>
    );
  }

  // Subscribe to friendships (real-time)
  useEffect(() => {
    const unsub = subscribeFriends(user.id, (fs) => {
      setFriendships(fs);
    });
    return () => unsub();
  }, [user.id]);

  // Resolve friend user data from Firestore when friendships change
  useEffect(() => {
    const loadFriendUsers = async () => {
      const map = new Map<string, User>();
      const friendIds: string[] = [];

      for (const fs of friendships) {
        const friendId = fs.userIds[0] === user.id ? fs.userIds[1] : fs.userIds[0];
        friendIds.push(friendId);

        // First try local IndexedDB, then fall back to Firestore
        let friendUser = await store.getUser(friendId);
        if (!friendUser) {
          // Load public profile from Firestore
          const profile = await getUserProfile(friendId);
          if (profile) {
            // Create a minimal User object from the Firestore profile
            friendUser = {
              id: profile.userId,
              phone: null,
              createdAt: profile.createdAt,
              lastActiveAt: profile.createdAt,
              homeLat: 0,
              homeLon: 0,
              beerId: profile.beerId,
              standYourGroundEnabled: false,
              ageVerified: true,
            };
          }
        }
        if (friendUser) {
          map.set(friendId, friendUser);
        }
      }

      setFriendUsers(map);

      // Notify parent of friend IDs (for presence subscription)
      const idsStr = friendIds.sort().join(',');
      if (idsStr !== prevFriendIdsRef.current) {
        prevFriendIdsRef.current = idsStr;
        onFriendIdsChange(friendIds);
      }
    };

    loadFriendUsers();
  }, [friendships, user.id, store, onFriendIdsChange]);

  const handleAdd = useCallback(async () => {
    const friendId = addInput.trim();
    setError(null);

    if (!friendId) {
      setError('Bitte User-ID eingeben');
      return;
    }
    if (friendId === user.id) {
      setError('Du kannst dich nicht selbst hinzufügen');
      return;
    }
    if (friendships.length >= GAME.MAX_FRIENDS) {
      setError(`Maximal ${GAME.MAX_FRIENDS} Freunde`);
      return;
    }

    // Check if already friends
    const existingId = makeFriendshipId(user.id, friendId);
    if (friendships.some(f => f.id === existingId)) {
      setError('Ihr seid bereits Freunde');
      return;
    }

    setAdding(true);
    try {
      const friendship = await addFriend(user.id, friendId);
      appEvents.emit({ type: 'friend:added', friendship });
      setAddInput('');
    } catch (e) {
      setError('Fehler beim Hinzufügen');
      console.error('addFriend error:', e);
    } finally {
      setAdding(false);
    }
  }, [addInput, user.id, friendships]);

  const handleRemove = useCallback(async (friendId: string) => {
    try {
      await removeFriend(user.id, friendId);
      const friendshipId = makeFriendshipId(user.id, friendId);
      appEvents.emit({ type: 'friend:removed', friendshipId });
      setConfirmRemove(null);
    } catch (e) {
      console.error('removeFriend error:', e);
    }
  }, [user.id]);

  const handleOpenChat = useCallback((friendId: string) => {
    const friendUser = friendUsers.get(friendId);
    if (!friendUser) return;
    const friendshipId = makeFriendshipId(user.id, friendId);
    onOpenChat(friendshipId, friendUser);
  }, [friendUsers, user.id, onOpenChat]);

  const isOnline = (userId: string): boolean => {
    const p = friendPresence.get(userId);
    if (!p) return false;
    return Date.now() - p.lastSeen < GAME.PRESENCE_ONLINE_THRESHOLD_MS;
  };

  return (
    <div className="friends-panel">
      <h3>Freunde <span className="friends-count">{friendships.length}/{GAME.MAX_FRIENDS}</span></h3>

      {/* Add friend form */}
      <div className="friends-add-form">
        <input
          type="text"
          className="friends-add-input"
          placeholder="User-ID eingeben..."
          value={addInput}
          onChange={(e) => { setAddInput(e.target.value); setError(null); }}
          onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); }}
          disabled={adding}
        />
        <button
          className="friends-add-btn"
          onClick={handleAdd}
          disabled={adding || !addInput.trim()}
        >
          {adding ? '...' : '+'}
        </button>
      </div>
      {error && <p className="friends-error">{error}</p>}

      {/* Friend list */}
      {friendships.length === 0 ? (
        <p className="friends-empty">Noch keine Freunde. Teile deine ID!</p>
      ) : (
        <div className="friends-list">
          {friendships.map((fs) => {
            const friendId = fs.userIds[0] === user.id ? fs.userIds[1] : fs.userIds[0];
            const friendUser = friendUsers.get(friendId);
            const beer = friendUser ? BEER_MAP.get(friendUser.beerId) : null;
            const online = isOnline(friendId);
            const presence = friendPresence.get(friendId);

            return (
              <div key={fs.id} className="friend-item">
                <div className="friend-info" onClick={() => handleOpenChat(friendId)}>
                  <div className="friend-avatar">
                    {beer && <img src={beer.svgLogo} alt={beer.name} className="friend-beer-logo" />}
                    <span className={`friend-online-dot ${online ? 'online' : 'offline'}`} />
                  </div>
                  <div className="friend-details">
                    <span className="friend-name">
                      {friendUser ? (beer?.name ?? friendUser.beerId) : friendId.substring(0, 8) + '...'}
                    </span>
                    <span className="friend-status">
                      {online
                        ? 'Online'
                        : presence
                          ? formatLastActive(presence.lastSeen)
                          : 'Unbekannt'}
                    </span>
                  </div>
                </div>

                <div className="friend-actions">
                  <button
                    className="friend-chat-btn"
                    onClick={() => handleOpenChat(friendId)}
                    title="Chat"
                  >
                    💬
                  </button>
                  {confirmRemove === friendId ? (
                    <button
                      className="friend-remove-btn confirm"
                      onClick={() => handleRemove(friendId)}
                      title="Wirklich entfernen?"
                    >
                      ✓
                    </button>
                  ) : (
                    <button
                      className="friend-remove-btn"
                      onClick={() => setConfirmRemove(friendId)}
                      title="Entfernen"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
