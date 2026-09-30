import { useState } from 'react';
import { BeerPicker } from './BeerPicker';
import type { Vote } from '../domain/types';
import { BEERS } from '../domain/beers';
import { WORLD_CITIES, nearestCity } from '../domain/worldCities';
import { t } from '../i18n';
import './SimulationPanel.css';

interface Props {
  onAddVotes: (votes: Vote[]) => void;
  onClearVotes: () => void;
  /** Beer used when placing a demo vote by tapping the map. */
  demoBeerId: string | null;
  onDemoBeerChange: (beerId: string) => void;
  voteCount: number;
  /** Current map centre (simulations around "here"). */
  getCenter: () => { lat: number; lon: number };
  /** Let simulated regulars visit the pubs on screen. */
  onSimulateVenues: () => void;
}

type Spread = 'here' | 'world';

/** Gaussian-ish offset: sum of two uniforms, in degrees. */
const jitter = (spread: number) => (Math.random() + Math.random() - 1) * spread;

/** 75 % local brands, the rest from anywhere: that's what a real bar menu looks like. */
function pickBeer(country: string) {
  const local = BEERS.filter((b) => b.country === country);
  const pool = local.length > 0 && Math.random() < 0.75 ? local : BEERS;
  return pool[Math.floor(Math.random() * pool.length)];
}

function generateRandomVotes(count: number, spread: Spread, center: { lat: number; lon: number }): Vote[] {
  const votes: Vote[] = [];
  const hereCountry = nearestCity(center.lat, center.lon).country;
  // A handful of neighbourhood hotspots so "here" looks like a real city
  const hotspots = Array.from({ length: 6 }, () => ({ lat: center.lat + jitter(0.12), lon: center.lon + jitter(0.18) }));

  for (let i = 0; i < count; i++) {
    let lat: number;
    let lon: number;
    let country: string;

    if (spread === 'here') {
      const h = hotspots[i % hotspots.length];
      const s = Math.random() < 0.7 ? 0.03 : 0.15;
      lat = h.lat + jitter(s);
      lon = h.lon + jitter(s * 1.5);
      country = hereCountry;
    } else {
      const city = WORLD_CITIES[Math.floor(Math.random() * WORLD_CITIES.length)];
      const s = 0.1 + Math.random() * 0.4;
      lat = city.lat + jitter(s);
      lon = city.lon + jitter(s * 1.4);
      country = city.country;
    }

    votes.push({
      id: `sim_${Date.now()}_${i}_${Math.random().toString(36).substring(2, 6)}`,
      lat: Math.max(-84, Math.min(84, lat)),
      lon: ((lon + 540) % 360) - 180,
      beerId: pickBeer(country).id,
      timestamp: Date.now() - Math.floor(Math.random() * 86400000),
    });
  }

  return votes;
}

export function SimulationPanel({ onAddVotes, onClearVotes, demoBeerId, onDemoBeerChange, voteCount, getCenter, onSimulateVenues }: Props) {
  const [count, setCount] = useState(300);
  const [spread, setSpread] = useState<Spread>('here');

  return (
    <section className="section sim">
      <h2 className="section-title">
        {t('sim.title')} <small>{t('sim.localOnly')}</small>
      </h2>

      <div className="card">
        <p className="eyebrow">{t('sim.votes')}</p>
        <div className="sim-count">
          <input
            type="range"
            min={10}
            max={2000}
            step={10}
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
            aria-label={t('sim.count')}
          />
          <span className="num sim-count-value">{count}</span>
        </div>
        <div className="segmented" role="group" aria-label={t('sim.spread')}>
          <button aria-pressed={spread === 'here'} onClick={() => setSpread('here')}>{t('sim.here')}</button>
          <button aria-pressed={spread === 'world'} onClick={() => setSpread('world')}>{t('sim.world')}</button>
        </div>
        <div className="sim-actions">
          <button className="btn btn-primary" onClick={() => onAddVotes(generateRandomVotes(count, spread, getCenter()))}>
            {t('sim.generate', { count })}
          </button>
          <button className="btn btn-danger" onClick={onClearVotes} disabled={voteCount === 0}>
            {t('sim.reset')}
          </button>
        </div>
        <p className="muted sim-hint num">{t('sim.onMap', { count: voteCount })}</p>
      </div>

      <div className="card">
        <p className="eyebrow">{t('sim.pubLife')}</p>
        <p className="muted">{t('sim.pubLifeText')}</p>
        <button className="btn btn-secondary" onClick={onSimulateVenues}>{t('sim.simulate')}</button>
      </div>

      <div className="card">
        <p className="eyebrow">{t('sim.tapVote')}</p>
        <BeerPicker value={demoBeerId} onChange={onDemoBeerChange} layout="carousel" country={nearestCity(getCenter().lat, getCenter().lon).country} label={t('sim.pickerLabel')} />
        <p className="muted">{t('sim.tapHint')}</p>
      </div>
    </section>
  );
}
