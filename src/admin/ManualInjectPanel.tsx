import { useState, useEffect } from 'react';
import type { StorageInterface } from '../storage/StorageInterface';
import type { DrinkVote } from '../domain/types';
import { BEERS } from '../domain/beers';
import { getNow } from '../domain/clock';
import { roundToPlaceKey } from '../domain/placeKey';
import { GAME } from '../config/constants';

interface Props {
  store: StorageInterface;
}

export function ManualInjectPanel({ store }: Props) {
  const [lat, setLat] = useState('48.137');
  const [lon, setLon] = useState('11.576');
  const [beerId, setBeerId] = useState(BEERS[0]?.id ?? '');
  const [userId, setUserId] = useState('');
  const [userIds, setUserIds] = useState<string[]>([]);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    (async () => {
      const users = await store.getAllUsers();
      const ids = users.map(u => u.id);
      setUserIds(ids);
      if (ids.length > 0 && !userId) setUserId(ids[0]);
    })();
  }, [store, userId]);

  const handleInject = async () => {
    if (!userId || !beerId) {
      setMsg('User und Bier ausw\u00e4hlen.');
      return;
    }

    const parsedLat = parseFloat(lat);
    const parsedLon = parseFloat(lon);
    if (isNaN(parsedLat) || isNaN(parsedLon)) {
      setMsg('Ung\u00fcltige Koordinaten.');
      return;
    }

    const now = getNow();
    const vote: DrinkVote = {
      id: `inject_${now}_${Math.random().toString(36).slice(2, 8)}`,
      userId,
      beerId,
      lat: parsedLat,
      lon: parsedLon,
      placeKey: roundToPlaceKey(parsedLat, parsedLon),
      createdAt: now,
      expiresAt: now + GAME.DRINK_TTL_HOURS * 60 * 60 * 1000,
      gpsAccuracyM: 5,
      proofType: 'gps',
    };

    await store.saveDrinkVote(vote);
    setMsg(`Drink Vote injected: ${beerId} @ ${parsedLat.toFixed(3)}, ${parsedLon.toFixed(3)}`);
    setTimeout(() => setMsg(''), 3000);
  };

  return (
    <div className="admin-section">
      <h3>Manual Inject (Bypasses Rate Limits)</h3>

      <div className="admin-row">
        <label>Lat:</label>
        <input className="admin-input" value={lat} onChange={e => setLat(e.target.value)} />
        <label>Lon:</label>
        <input className="admin-input" value={lon} onChange={e => setLon(e.target.value)} />
      </div>

      <div className="admin-row">
        <label>Bier:</label>
        <select className="admin-select" value={beerId} onChange={e => setBeerId(e.target.value)}>
          {BEERS.map(b => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
      </div>

      <div className="admin-row">
        <label>User:</label>
        <select className="admin-select" value={userId} onChange={e => setUserId(e.target.value)}>
          {userIds.map(id => (
            <option key={id} value={id}>{id.slice(0, 20)}...</option>
          ))}
        </select>
      </div>

      <div className="admin-row">
        <button className="admin-btn" onClick={handleInject}>Inject Drink Vote</button>
      </div>

      {msg && <p className="admin-success">{msg}</p>}
    </div>
  );
}
