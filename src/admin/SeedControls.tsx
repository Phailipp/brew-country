import { useState } from 'react';
import type { StorageInterface } from '../storage/StorageInterface';
import type { User, DrinkVote } from '../domain/types';
import { BEERS } from '../domain/beers';
import { getNow } from '../domain/clock';
import { roundToPlaceKey } from '../domain/placeKey';
import { GAME } from '../config/constants';
import { WORLD_CITIES } from '../domain/worldCities';

interface Props {
  store: StorageInterface;
}

// Beer capitals worldwide for clustering
const CITIES = WORLD_CITIES;

function randomCity() {
  return CITIES[Math.floor(Math.random() * CITIES.length)];
}

function randomBeer() {
  return BEERS[Math.floor(Math.random() * BEERS.length)];
}

function jitter(val: number, range: number) {
  return val + (Math.random() - 0.5) * range;
}

export function SeedControls({ store }: Props) {
  const [userCount, setUserCount] = useState(20);
  const [drinkCount, setDrinkCount] = useState(50);
  const [msg, setMsg] = useState('');

  const seedUsers = async () => {
    const now = getNow();
    for (let i = 0; i < userCount; i++) {
      const city = randomCity();
      const beer = randomBeer();
      const user: User = {
        id: `seed_user_${now}_${i}`,
        phone: null,
        createdAt: now - Math.random() * 30 * 24 * 60 * 60 * 1000,
        lastActiveAt: now - Math.random() * 2 * 24 * 60 * 60 * 1000,
        homeLat: jitter(city.lat, 0.15),
        homeLon: jitter(city.lon, 0.25),
        beerId: beer.id,
        standYourGroundEnabled: Math.random() < 0.3,
        ageVerified: true,
      };
      await store.saveUser(user);
    }
    setMsg(`${userCount} Users erstellt`);
  };

  const seedDrinkVotes = async () => {
    const now = getNow();
    const users = await store.getAllUsers();
    if (users.length === 0) {
      setMsg('Keine User vorhanden. Erstelle zuerst Users.');
      return;
    }

    for (let i = 0; i < drinkCount; i++) {
      const user = users[Math.floor(Math.random() * users.length)];
      const city = randomCity();
      const lat = jitter(city.lat, 0.1);
      const lon = jitter(city.lon, 0.15);
      const beer = randomBeer();
      const createdAt = now - Math.random() * 20 * 60 * 60 * 1000; // last 20h

      const vote: DrinkVote = {
        id: `seed_drink_${now}_${i}`,
        userId: user.id,
        beerId: beer.id,
        lat,
        lon,
        placeKey: roundToPlaceKey(lat, lon),
        createdAt,
        expiresAt: createdAt + GAME.DRINK_TTL_HOURS * 60 * 60 * 1000,
        gpsAccuracyM: 10 + Math.random() * 40,
        proofType: 'gps',
      };
      await store.saveDrinkVote(vote);
    }
    setMsg(`${drinkCount} Drink Votes erstellt`);
  };

  const clearSeeded = async () => {
    // Clear all drink votes (seeded or real)
    const all = await store.getAllDrinkVotes();
    for (const v of all) {
      await store.removeDrinkVote(v.id);
    }
    setMsg(`${all.length} Drink Votes gel\u00f6scht`);
  };

  return (
    <div className="admin-section">
      <h3>Seed Data</h3>

      <div className="admin-row">
        <input
          type="number"
          className="admin-input"
          value={userCount}
          onChange={e => setUserCount(Number(e.target.value))}
          min={1}
          max={500}
        />
        <button className="admin-btn" onClick={seedUsers}>Users erstellen</button>
      </div>

      <div className="admin-row">
        <input
          type="number"
          className="admin-input"
          value={drinkCount}
          onChange={e => setDrinkCount(Number(e.target.value))}
          min={1}
          max={500}
        />
        <button className="admin-btn" onClick={seedDrinkVotes}>Drink Votes erstellen</button>
      </div>

      <div className="admin-row">
        <button className="admin-btn danger" onClick={clearSeeded}>Alle Drink Votes l\u00f6schen</button>
      </div>

      {msg && <p className="admin-success">{msg}</p>}
    </div>
  );
}
