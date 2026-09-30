import { useState, useEffect, useCallback } from 'react';
import type { User, Friendship, UserPresence } from '../domain/types';
import type { StorageInterface } from '../storage/StorageInterface';
import { GAME } from '../config/constants';
import { BEER_MAP } from '../domain/beers';
import { appEvents } from '../domain/events';
import {
  addFriend,
  removeFriend,
  acceptFriend,
  declineFriend,
  makeFriendshipId,
  getUserProfile,
} from '../services/firestoreService';
import './FriendsPanel.css';

interface Props {
  user: User;
  store: StorageInterface;
  /** Live friendships, subscribed once in the app shell. */
  friendships: Friendship[];
  onOpenChat: (friendshipId: string, friendUser: User) => void;
  friendPresence: Map<string, UserPresence>;
  unreadCounts?: Map<string, number>;
  onLocateFriend?: (lat: number, lon: number) => void;
}

function formatLastActive(lastSeen: number): string {
  const diff = Date.now() - lastSeen;
  if (diff < 60_000) return 'Gerade aktiv';
  if (diff < 3600_000) return `Vor ${Math.floor(diff / 60_000)} Min.`;
  if (diff < 86400_000) return `Vor ${Math.floor(diff / 3600_000)} Std.`;
  return `Vor ${Math.floor(diff / 86400_000)} Tagen`;
}

export function FriendsPanel({ user, store, friendships, onOpenChat, friendPresence, unreadCounts, onLocateFriend }: Props) {
  const [friendUsers, setFriendUsers] = useState<Map<string, User>>(new Map());
  const [addInput, setAddInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);

  // Resolve friend user data from Firestore when friendships change
  useEffect(() => {
    let cancelled = false;
    const loadFriendUsers = async () => {
      const map = new Map<string, User>();

      for (const fs of friendships) {
        const friendId = fs.userIds[0] === user.id ? fs.userIds[1] : fs.userIds[0];

        let friendUser = await store.getUser(friendId);
        if (!friendUser) {
          const profile = await getUserProfile(friendId);
          if (profile) {
            friendUser = {
              id: profile.userId,
              phone: null,
              createdAt: profile.createdAt,
              lastActiveAt: profile.lastActiveAt,
              homeLat: profile.homeLat,
              homeLon: profile.homeLon,
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

      if (!cancelled) setFriendUsers(map);
    };

    loadFriendUsers().catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [friendships, user.id, store]);

  // Split friendships into categories
  const incomingRequests = friendships.filter(
    (fs) => fs.status === 'pending' && fs.requestedBy !== user.id
  );
  const sentRequests = friendships.filter(
    (fs) => fs.status === 'pending' && fs.requestedBy === user.id
  );
  const acceptedFriends = friendships.filter(
    (fs) => fs.status === 'accepted'
  );

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

    const existingId = makeFriendshipId(user.id, friendId);
    if (friendships.some(f => f.id === existingId)) {
      setError('Anfrage existiert bereits');
      return;
    }

    setAdding(true);
    try {
      const friendship = await addFriend(user.id, friendId);
      appEvents.emit({ type: 'friend:added', friendship });
      setAddInput('');
    } catch (e) {
      setError('Fehler beim Senden der Anfrage');
      console.error('addFriend error:', e);
    } finally {
      setAdding(false);
    }
  }, [addInput, user.id, friendships]);

  const handleAccept = useCallback(async (friendId: string) => {
    try {
      await acceptFriend(user.id, friendId);
    } catch (e) {
      console.error('acceptFriend error:', e);
    }
  }, [user.id]);

  const handleDecline = useCallback(async (friendId: string) => {
    try {
      await declineFriend(user.id, friendId);
    } catch (e) {
      console.error('declineFriend error:', e);
    }
  }, [user.id]);

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

  const getFriendId = (fs: Friendship) =>
    fs.userIds[0] === user.id ? fs.userIds[1] : fs.userIds[0];

  const renderFriendLabel = (friendId: string) => {
    const friendUser = friendUsers.get(friendId);
    const beer = friendUser ? BEER_MAP.get(friendUser.beerId) : null;
    return (
      <div className="friend-info-label">
        <div className="friend-avatar">
          {beer && <img src={beer.svgLogo} alt={beer.name} className="friend-beer-logo" />}
        </div>
        <span className="friend-name">
          {friendUser ? (beer?.name ?? friendUser.beerId) : friendId.substring(0, 12) + '...'}
        </span>
      </div>
    );
  };

  return (
    <div className="friends-panel">
      <h3>Freunde <span className="friends-count">{acceptedFriends.length}/{GAME.MAX_FRIENDS}</span></h3>

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

      {/* Incoming requests */}
      {incomingRequests.length > 0 && (
        <div className="friends-section">
          <h4 className="friends-section-title">Eingehende Anfragen</h4>
          {incomingRequests.map((fs) => {
            const friendId = getFriendId(fs);
            return (
              <div key={fs.id} className="friend-item request-incoming">
                {renderFriendLabel(friendId)}
                <div className="friend-actions">
                  <button
                    className="friend-accept-btn"
                    onClick={() => handleAccept(friendId)}
                    title="Annehmen"
                  >
                    ✅
                  </button>
                  <button
                    className="friend-decline-btn"
                    onClick={() => handleDecline(friendId)}
                    title="Ablehnen"
                  >
                    ❌
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Sent requests (pending) */}
      {sentRequests.length > 0 && (
        <div className="friends-section">
          <h4 className="friends-section-title">Gesendet</h4>
          {sentRequests.map((fs) => {
            const friendId = getFriendId(fs);
            return (
              <div key={fs.id} className="friend-item request-sent">
                {renderFriendLabel(friendId)}
                <div className="friend-actions">
                  <span className="friend-pending-label">Warte...</span>
                  <button
                    className="friend-decline-btn"
                    onClick={() => handleDecline(friendId)}
                    title="Zurückziehen"
                  >
                    ✕
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Accepted friends */}
      {acceptedFriends.length === 0 && incomingRequests.length === 0 && sentRequests.length === 0 ? (
        <p className="friends-empty">Noch keine Freunde. Teile deine ID!</p>
      ) : acceptedFriends.length > 0 && (
        <div className="friends-section">
          {(incomingRequests.length > 0 || sentRequests.length > 0) && (
            <h4 className="friends-section-title">Freunde</h4>
          )}
          <div className="friends-list">
            {acceptedFriends.map((fs) => {
              const friendId = getFriendId(fs);
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
                    {friendUser && friendUser.homeLat !== 0 && onLocateFriend && (
                      <button
                        className="friend-locate-btn"
                        onClick={() => onLocateFriend(friendUser.homeLat, friendUser.homeLon)}
                        title="Auf Karte zeigen"
                      >
                        📍
                      </button>
                    )}
                    <button
                      className="friend-chat-btn"
                      onClick={() => handleOpenChat(friendId)}
                      title="Chat"
                    >
                      💬
                      {(() => {
                        const fsId = makeFriendshipId(user.id, friendId);
                        const count = unreadCounts?.get(fsId) ?? 0;
                        return count > 0 ? (
                          <span className="friend-unread-badge">{count > 9 ? '9+' : count}</span>
                        ) : null;
                      })()}
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
        </div>
      )}
    </div>
  );
}
