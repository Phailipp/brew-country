import { useState } from 'react';
import type { Vote, User } from '../domain/types';
import type { StorageInterface } from '../storage/StorageInterface';
import { BEERS } from '../domain/beers';
import { getDefaultBoundingBox } from '../domain/geo';
import './SimulationPanel.css';

interface Props {
  onAddVotes: (votes: Vote[]) => void;
  onClearVotes: () => void;
  user: User;
  store: StorageInterface;
  onUserUpdate: (user: User) => void;
}

/** Always use the full DACH region for vote generation, not the viewport grid */
const FULL_DACH = getDefaultBoundingBox();

function randomInRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

// Major DACH cities for clustered simulation + teleport
const DACH_CITIES = [
  { lat: 48.135, lon: 11.582, name: 'München' },
  { lat: 52.520, lon: 13.405, name: 'Berlin' },
  { lat: 50.938, lon: 6.960,  name: 'Köln' },
  { lat: 48.776, lon: 9.183,  name: 'Stuttgart' },
  { lat: 50.111, lon: 8.682,  name: 'Frankfurt' },
  { lat: 53.551, lon: 9.994,  name: 'Hamburg' },
  { lat: 51.234, lon: 6.784,  name: 'Düsseldorf' },
  { lat: 51.340, lon: 12.375, name: 'Leipzig' },
  { lat: 51.050, lon: 13.738, name: 'Dresden' },
  { lat: 49.453, lon: 11.078, name: 'Nürnberg' },
  { lat: 48.208, lon: 16.374, name: 'Wien' },
  { lat: 47.076, lon: 15.421, name: 'Graz' },
  { lat: 47.264, lon: 11.394, name: 'Innsbruck' },
  { lat: 47.811, lon: 13.055, name: 'Salzburg' },
  { lat: 47.377, lon: 8.542,  name: 'Zürich' },
  { lat: 46.948, lon: 7.448,  name: 'Bern' },
  { lat: 46.204, lon: 6.143,  name: 'Genf' },
  { lat: 47.559, lon: 7.589,  name: 'Basel' },
];

function generateRandomVotes(count: number, clustered: boolean): Vote[] {
  const votes: Vote[] = [];

  for (let i = 0; i < count; i++) {
    let lat: number;
    let lon: number;

    if (clustered && Math.random() < 0.7) {
      // 70% clustered around random DACH cities
      const city = DACH_CITIES[Math.floor(Math.random() * DACH_CITIES.length)];
      const spread = 0.3 + Math.random() * 0.5; // ~30–80 km spread
      lat = city.lat + (Math.random() + Math.random() - 1) * spread;
      lon = city.lon + (Math.random() + Math.random() - 1) * spread;
    } else {
      lat = randomInRange(FULL_DACH.minLat, FULL_DACH.maxLat);
      lon = randomInRange(FULL_DACH.minLon, FULL_DACH.maxLon);
    }

    const beer = BEERS[Math.floor(Math.random() * BEERS.length)];

    votes.push({
      id: `sim_${Date.now()}_${i}_${Math.random().toString(36).substring(2, 6)}`,
      lat,
      lon,
      beerId: beer.id,
      timestamp: Date.now() - Math.floor(Math.random() * 86400000),
    });
  }

  return votes;
}

export function SimulationPanel({ onAddVotes, onClearVotes, user, store, onUserUpdate }: Props) {
  const [count, setCount] = useState(100);
  const [clustered, setClustered] = useState(true);

  // Location teleport state
  const [latInput, setLatInput] = useState(user.homeLat.toFixed(4));
  const [lonInput, setLonInput] = useState(user.homeLon.toFixed(4));
  const [teleportMsg, setTeleportMsg] = useState('');

  const handleGenerate = () => {
    const votes = generateRandomVotes(count, clustered);
    onAddVotes(votes);
  };

  const handleAddOne = () => {
    const votes = generateRandomVotes(1, clustered);
    onAddVotes(votes);
  };

  const handleTeleport = async () => {
    const lat = parseFloat(latInput);
    const lon = parseFloat(lonInput);
    if (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      setTeleportMsg('Ungültige Koordinaten');
      return;
    }
    const updated: User = { ...user, homeLat: lat, homeLon: lon };
    await store.saveUser(updated);
    onUserUpdate(updated);
    setTeleportMsg(`Teleportiert nach ${lat.toFixed(4)}, ${lon.toFixed(4)}`);
    setTimeout(() => setTeleportMsg(''), 2500);
  };

  const handleCitySelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const idx = Number(e.target.value);
    if (idx < 0) return;
    const city = DACH_CITIES[idx];
    setLatInput(city.lat.toFixed(4));
    setLonInput(city.lon.toFixed(4));
  };

  return (
    <div className="simulation-panel">
      {/* ── Location teleport ─────────────────────── */}
      <h3>Standort</h3>
      <div className="sim-location">
        <p className="sim-location-current">
          Aktuell: {user.homeLat.toFixed(4)}, {user.homeLon.toFixed(4)}
        </p>
        <select className="sim-city-select" defaultValue="-1" onChange={handleCitySelect}>
          <option value="-1">Stadt wählen…</option>
          {DACH_CITIES.map((c, i) => (
            <option key={c.name} value={i}>{c.name}</option>
          ))}
        </select>
        <div className="sim-coord-row">
          <input
            className="sim-coord-input"
            type="number"
            step="0.0001"
            placeholder="Breitengrad"
            value={latInput}
            onChange={(e) => setLatInput(e.target.value)}
          />
          <input
            className="sim-coord-input"
            type="number"
            step="0.0001"
            placeholder="Längengrad"
            value={lonInput}
            onChange={(e) => setLonInput(e.target.value)}
          />
        </div>
        <button className="sim-btn primary" onClick={handleTeleport}>
          📍 Teleportieren
        </button>
        {teleportMsg && <p className="sim-teleport-msg">{teleportMsg}</p>}
      </div>

      {/* ── Vote simulation ───────────────────────── */}
      <h3>Simulation</h3>
      <div className="sim-controls">
        <label>
          Anzahl:
          <input
            type="number"
            min={1}
            max={1000}
            value={count}
            onChange={(e) => setCount(Math.max(1, Math.min(1000, Number(e.target.value))))}
          />
        </label>
        <label className="sim-checkbox">
          <input
            type="checkbox"
            checked={clustered}
            onChange={(e) => setClustered(e.target.checked)}
          />
          Geclustert (Ballungszentren)
        </label>
      </div>
      <div className="sim-buttons">
        <button className="sim-btn primary" onClick={handleGenerate}>
          Generate {count} Votes
        </button>
        <button className="sim-btn" onClick={handleAddOne}>
          +1 Random Vote
        </button>
        <button className="sim-btn danger" onClick={onClearVotes}>
          Clear All Votes
        </button>
      </div>
    </div>
  );
}
