import { useState } from 'react';
import type { StorageInterface } from '../storage/StorageInterface';
import type { User, DrinkVote } from '../domain/types';
import { BEERS } from '../domain/beers';
import { getNow } from '../domain/clock';
import { roundToPlaceKey } from '../domain/placeKey';
import { GAME } from '../config/constants';

interface Props {
  store: StorageInterface;
}

// Major DACH cities for clustering
const CITIES = [
  { name: 'Berlin', lat: 52.52, lon: 13.405 },
  { name: 'M\u00fcnchen', lat: 48.137, lon: 11.576 },
  { name: 'Wien', lat: 48.208, lon: 16.373 },
  { name: 'Z\u00fcrich', lat: 47.377, lon: 8.541 },
  { name: 'Hamburg', lat: 53.551, lon: 9.994 },
  { name: 'K\u00f6ln', lat: 50.938, lon: 6.960 },
  { name: 'Frankfurt', lat: 50.111, lon: 8.682 },
  { name: 'Stuttgart', lat: 48.776, lon: 9.183 },
  { name: 'D\u00fcsseldorf', lat: 51.227, lon: 6.774 },
  { name: 'Salzburg', lat: 47.811, lon: 13.055 },
  { name: 'Bern', lat: 46.948, lon: 7.448 },
  { name: 'Graz', lat: 47.071, lon: 15.439 },
  { name: 'Innsbruck', lat: 47.263, lon: 11.394 },
  { name: 'Leipzig', lat: 51.340, lon: 12.375 },
  { name: 'Dresden', lat: 51.051, lon: 13.738 },
];

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
