import { useState, useEffect, useCallback } from 'react';
import type { User, Friendship, UserPresence } from '../domain/types';
import type { StorageInterface } from '../storage/StorageInterface';
import { GAME } from '../config/constants';
import { appEvents } from '../domain/events';
import {
  addFriend,
  removeFriend,
  acceptFriend,
  declineFriend,
  makeFriendshipId,
  getUserProfile,
} from '../services/firestoreService';
import { BeerBadge } from './kit/BeerBadge';
import { beerName } from './kit/beer';
import { haptic } from './kit/haptics';
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
  if (diff < 3600_000) return `Vor ${Math.floor(diff / 60_000)} Min. aktiv`;
  if (diff < 86400_000) return `Vor ${Math.floor(diff / 3600_000)} Std. aktiv`;
  const days = Math.floor(diff / 86400_000);
  return `Vor ${days} ${days === 1 ? 'Tag' : 'Tagen'} aktiv`;
}

const Icon = {
  chat: (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12a8 8 0 1 1 3.2 6.4L4 19.5l1.1-3.2A7.96 7.96 0 0 1 4 12z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /></svg>
  ),
  pin: (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /><circle cx="12" cy="10" r="2.3" fill="currentColor" /></svg>
  ),
  remove: (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7l10 10M17 7L7 17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
  ),
  check: (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
  ),
  add: (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" /></svg>
  ),
};

export function FriendsPanel({ user, store, friendships, onOpenChat, friendPresence, unreadCounts, onLocateFriend }: Props) {
  const [friendUsers, setFriendUsers] = useState<Map<string, User>>(new Map());
  const [addInput, setAddInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Resolve friend user data when friendships change
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
    setSuccess(null);

    if (!friendId) {
      setError('Gib die Freundes-ID deines Kumpels ein.');
      return;
    }
    if (friendId === user.id) {
      setError('Das bist du selbst – such dir lieber Trinkkumpanen. 😉');
      return;
    }
    if (friendships.length >= GAME.MAX_FRIENDS) {
      setError(`Deine Crew ist voll (max. ${GAME.MAX_FRIENDS}).`);
      return;
    }

    const existingId = makeFriendshipId(user.id, friendId);
    if (friendships.some(f => f.id === existingId)) {
      setError('Mit dieser Person bist du schon verbunden oder hast angefragt.');
      return;
    }

    setAdding(true);
    try {
      const friendship = await addFriend(user.id, friendId);
      appEvents.emit({ type: 'friend:added', friendship });
      setAddInput('');
      setSuccess('Anfrage verschickt! 🍻');
      haptic('success');
    } catch (e) {
      setError('Anfrage konnte nicht gesendet werden. Stimmt die ID?');
      console.error('addFriend error:', e);
    } finally {
      setAdding(false);
    }
  }, [addInput, user.id, friendships]);

  const runAction = useCallback(async (friendId: string, fn: () => Promise<void>, failMsg: string) => {
    setBusyId(friendId);
    setError(null);
    setSuccess(null);
    try {
      await fn();
    } catch (e) {
      console.error(e);
      setError(failMsg);
    } finally {
      setBusyId(null);
    }
  }, []);

  const handleAccept = useCallback((friendId: string) => runAction(friendId, async () => {
    await acceptFriend(user.id, friendId);
    haptic('success');
  }, 'Annehmen hat nicht geklappt. Versuch es nochmal.'), [user.id, runAction]);

  const handleDecline = useCallback((friendId: string) => runAction(friendId, async () => {
    await declineFriend(user.id, friendId);
  }, 'Das hat nicht geklappt. Versuch es nochmal.'), [user.id, runAction]);

  const handleRemove = useCallback((friendId: string) => runAction(friendId, async () => {
    await removeFriend(user.id, friendId);
    const friendshipId = makeFriendshipId(user.id, friendId);
    appEvents.emit({ type: 'friend:removed', friendshipId });
    setConfirmRemove(null);
    haptic('medium');
  }, 'Entfernen hat nicht geklappt. Versuch es nochmal.'), [user.id, runAction]);

  const handleOpenChat = useCallback((friendId: string) => {
    const friendUser = friendUsers.get(friendId);
    if (!friendUser) return;
    const friendshipId = makeFriendshipId(user.id, friendId);
    haptic('light');
    onOpenChat(friendshipId, friendUser);
  }, [friendUsers, user.id, onOpenChat]);

  const isOnline = (userId: string): boolean => {
    const p = friendPresence.get(userId);
    if (!p) return false;
    return Date.now() - p.lastSeen < GAME.PRESENCE_ONLINE_THRESHOLD_MS;
  };

  const getFriendId = (fs: Friendship) =>
    fs.userIds[0] === user.id ? fs.userIds[1] : fs.userIds[0];

  const displayName = (friendId: string) => {
    const fu = friendUsers.get(friendId);
    if (!fu) return `${friendId.slice(0, 8)}…`;
    return fu.nickname || `${beerName(fu.beerId)}-Fan`;
  };

  const hasAnything = friendships.length > 0;

  return (
    <>
      <section className="section friends" aria-labelledby="friends-title">
        <h2 className="section-title" id="friends-title">
          Deine Crew
          <small className="num">{acceptedFriends.length}/{GAME.MAX_FRIENDS}</small>
        </h2>

        <form
          className="friends-add"
          onSubmit={(e) => { e.preventDefault(); handleAdd(); }}
        >
          <label htmlFor="friends-add-input" className="sr-only">Freundes-ID</label>
          <input
            id="friends-add-input"
            type="text"
            className="friends-add-input"
            placeholder="Freundes-ID einfügen"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            value={addInput}
            onChange={(e) => { setAddInput(e.target.value); setError(null); setSuccess(null); }}
            disabled={adding}
          />
          <button
            type="submit"
            className="btn btn-primary friends-add-btn"
            disabled={adding || !addInput.trim()}
            aria-label="Freund hinzufügen"
          >
            {adding ? <span className="spinner" aria-hidden="true" /> : Icon.add}
          </button>
        </form>
        <div aria-live="polite">
          {error && <p className="friends-msg error" role="alert">{error}</p>}
          {success && <p className="friends-msg success">{success}</p>}
        </div>
      </section>

      {incomingRequests.length > 0 && (
        <section className="section" aria-labelledby="friends-req-title">
          <h2 className="section-title" id="friends-req-title">
            Anfragen <span className="chip chip-accent num">{incomingRequests.length}</span>
          </h2>
          <ul className="friends-list">
            {incomingRequests.map((fs) => {
              const friendId = getFriendId(fs);
              const fu = friendUsers.get(friendId);
              const busy = busyId === friendId;
              return (
                <li key={fs.id} className="row friends-request">
                  <BeerBadge beerId={fu?.beerId} />
                  <div className="row-main">
                    <div className="row-title">{displayName(friendId)}</div>
                    <div className="row-sub">möchte in deine Crew</div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-sm btn-primary"
                    onClick={() => handleAccept(friendId)}
                    disabled={busy}
                  >
                    Annehmen
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => handleDecline(friendId)}
                    disabled={busy}
                    aria-label={`Anfrage von ${displayName(friendId)} ablehnen`}
                  >
                    {Icon.remove}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {acceptedFriends.length > 0 && (
        <section className="section" aria-labelledby="friends-list-title">
          {(incomingRequests.length > 0 || sentRequests.length > 0) && (
            <h2 className="section-title" id="friends-list-title">Freunde</h2>
          )}
          <ul className="friends-list stagger" aria-label="Freunde">
            {acceptedFriends.map((fs) => {
              const friendId = getFriendId(fs);
              const friendUser = friendUsers.get(friendId);
              const online = isOnline(friendId);
              const presence = friendPresence.get(friendId);
              const unread = unreadCounts?.get(makeFriendshipId(user.id, friendId)) ?? 0;
              const name = displayName(friendId);
              const confirming = confirmRemove === friendId;
              const busy = busyId === friendId;

              if (confirming) {
                return (
                  <li key={fs.id} className="row friends-confirm" role="group" aria-label={`${name} entfernen?`}>
                    <div className="row-main">
                      <div className="row-title">{name} entfernen?</div>
                      <div className="row-sub">Ihr seht euch dann nicht mehr auf der Karte.</div>
                    </div>
                    <button type="button" className="btn btn-sm btn-ghost" onClick={() => setConfirmRemove(null)} disabled={busy}>
                      Abbrechen
                    </button>
                    <button type="button" className="btn btn-sm btn-danger" onClick={() => handleRemove(friendId)} disabled={busy}>
                      Entfernen
                    </button>
                  </li>
                );
              }

              return (
                <li key={fs.id} className="row friends-row">
                  <button
                    type="button"
                    className="friends-who"
                    onClick={() => handleOpenChat(friendId)}
                    disabled={!friendUser}
                    aria-label={`Chat mit ${name} öffnen`}
                  >
                    <span className="friends-avatar">
                      <BeerBadge beerId={friendUser?.beerId} />
                      <span className={`friends-dot${online ? ' online' : ''}`} aria-hidden="true" />
                    </span>
                    <span className="row-main">
                      <span className="row-title">{name}</span>
                      <span className={`row-sub${online ? ' friends-online' : ''}`}>
                        {online ? 'Online' : presence ? formatLastActive(presence.lastSeen) : friendUser ? beerName(friendUser.beerId) : '…'}
                      </span>
                    </span>
                  </button>
                  <div className="friends-actions">
                    <button
                      type="button"
                      className="icon-btn friends-chat"
                      onClick={() => handleOpenChat(friendId)}
                      disabled={!friendUser}
                      aria-label={unread > 0 ? `Chat mit ${name}, ${unread} ungelesen` : `Chat mit ${name}`}
                    >
                      {Icon.chat}
                      {unread > 0 && <span className="friends-unread num" aria-hidden="true">{unread > 9 ? '9+' : unread}</span>}
                    </button>
                    {friendUser && friendUser.homeLat !== 0 && onLocateFriend && (
                      <button
                        type="button"
                        className="icon-btn"
                        onClick={() => { haptic('light'); onLocateFriend(friendUser.homeLat, friendUser.homeLon); }}
                        aria-label={`${name} auf der Karte zeigen`}
                      >
                        {Icon.pin}
                      </button>
                    )}
                    <button
                      type="button"
                      className="icon-btn friends-remove"
                      onClick={() => setConfirmRemove(friendId)}
                      aria-label={`${name} entfernen`}
                    >
                      {Icon.remove}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {sentRequests.length > 0 && (
        <section className="section" aria-labelledby="friends-sent-title">
          <h2 className="section-title" id="friends-sent-title">Gesendet</h2>
          <ul className="friends-list">
            {sentRequests.map((fs) => {
              const friendId = getFriendId(fs);
              const fu = friendUsers.get(friendId);
              return (
                <li key={fs.id} className="row friends-sent">
                  <BeerBadge beerId={fu?.beerId} />
                  <div className="row-main">
                    <div className="row-title">{displayName(friendId)}</div>
                    <div className="row-sub">Wartet auf Antwort …</div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-sm btn-ghost"
                    onClick={() => handleDecline(friendId)}
                    disabled={busyId === friendId}
                  >
                    Zurückziehen
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {!hasAnything && (
        <div className="empty friends-empty">
          <span className="empty-icon" aria-hidden="true">🍻</span>
          <span className="empty-title">Noch keine Crew</span>
          <p>Teile deine Freundes-ID (findest du unter „Dein Revier“) oder füg oben die ID eines Kumpels ein.</p>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => document.getElementById('friends-add-input')?.focus()}
          >
            ID eingeben
          </button>
        </div>
      )}
    </>
  );
}
