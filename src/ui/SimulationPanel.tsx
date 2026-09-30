import { useState } from 'react';
import { BeerPicker } from './BeerPicker';
import type { Vote } from '../domain/types';
import { BEERS } from '../domain/beers';
import { getDefaultBoundingBox } from '../domain/geo';
import './SimulationPanel.css';

interface Props {
  onAddVotes: (votes: Vote[]) => void;
  onClearVotes: () => void;
  /** Beer used when placing a demo vote by tapping the map. */
  demoBeerId: string | null;
  onDemoBeerChange: (beerId: string) => void;
  voteCount: number;
}

/** Always use the full DACH region for vote generation, not the viewport grid */
const FULL_DACH = getDefaultBoundingBox();

function randomInRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

// Major DACH cities for clustered simulation
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

export function SimulationPanel({ onAddVotes, onClearVotes, demoBeerId, onDemoBeerChange, voteCount }: Props) {
  const [count, setCount] = useState(300);
  const [clustered, setClustered] = useState(true);

  return (
    <section className="section sim">
      <h2 className="section-title">
        Demo-Werkzeuge <small>nur lokal, nichts wird gespeichert</small>
      </h2>

      <div className="card">
        <p className="eyebrow">Stimmen simulieren</p>
        <div className="sim-count">
          <input
            type="range"
            min={10}
            max={2000}
            step={10}
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
            aria-label="Anzahl Stimmen"
          />
          <span className="num sim-count-value">{count}</span>
        </div>
        <div className="segmented" role="group" aria-label="Verteilung">
          <button aria-pressed={clustered} onClick={() => setClustered(true)}>Städte</button>
          <button aria-pressed={!clustered} onClick={() => setClustered(false)}>Zufällig</button>
        </div>
        <div className="sim-actions">
          <button className="btn btn-primary" onClick={() => onAddVotes(generateRandomVotes(count, clustered))}>
            {count} Stimmen erzeugen
          </button>
          <button className="btn btn-danger" onClick={onClearVotes} disabled={voteCount === 0}>
            Zurücksetzen
          </button>
        </div>
        <p className="muted sim-hint num">{voteCount.toLocaleString('de-DE')} Demo-Stimmen auf der Karte</p>
      </div>

      <div className="card">
        <p className="eyebrow">Per Tipp auf die Karte abstimmen</p>
        <BeerPicker value={demoBeerId} onChange={onDemoBeerChange} layout="carousel" label="Bier für Demo-Stimmen" />
        <p className="muted">Tipp auf die Karte → Gebiet ansehen → „Demo: Stimme setzen“.</p>
      </div>
    </section>
  );
}
