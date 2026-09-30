import { useEffect, type CSSProperties } from 'react';
import confetti from 'canvas-confetti';
import { BeerBadge } from './kit/BeerBadge';
import { beerColor, beerName } from './kit/beer';
import './Celebration.css';

export interface CelebrationData {
  id: number;
  beerId: string;
  title: string;
  subtitle: string;
  /** Bigger party for conquering territory. */
  epic?: boolean;
}

interface Props {
  data: CelebrationData;
  onDone: () => void;
}

const REDUCED_MOTION = typeof window !== 'undefined'
  && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export function Celebration({ data, onDone }: Props) {
  useEffect(() => {
    const color = beerColor(data.beerId);
    if (!REDUCED_MOTION) {
      const colors = [color, '#ffd166', '#fff6e8'];
      confetti({ particleCount: data.epic ? 160 : 90, spread: 80, startVelocity: 42, origin: { y: 0.72 }, colors, scalar: 1.05, disableForReducedMotion: true });
      if (data.epic) {
        setTimeout(() => {
          confetti({ particleCount: 80, angle: 60, spread: 60, origin: { x: 0, y: 0.8 }, colors });
          confetti({ particleCount: 80, angle: 120, spread: 60, origin: { x: 1, y: 0.8 }, colors });
        }, 250);
      }
    }
    const t = setTimeout(onDone, data.epic ? 3400 : 2600);
    return () => clearTimeout(t);
  }, [data, onDone]);

  return (
    <div
      className={`celebration${data.epic ? ' epic' : ''}`}
      style={{ '--beer': beerColor(data.beerId) } as CSSProperties}
      role="status"
      aria-live="assertive"
      onClick={onDone}
    >
      <div className="celebration-rays" aria-hidden="true" />
      <div className="celebration-card">
        <div className="celebration-badge">
          <BeerBadge beerId={data.beerId} size="xl" />
        </div>
        <p className="eyebrow">{beerName(data.beerId)}</p>
        <h2 className="celebration-title">{data.title}</h2>
        <p className="celebration-sub">{data.subtitle}</p>
      </div>
    </div>
  );
}
