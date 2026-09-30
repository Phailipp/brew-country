import { useCallback, useEffect, useState } from 'react';
import { BEER_MAP } from '../domain/beers';
import {
  approveBeerSubmission,
  listBeerSubmissions,
  rejectBeerSubmission,
  type BeerSubmission,
} from '../services/firestoreService';

/** URL-safe, stable id for a new catalogue beer. */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

/** Pick a hue that is far from the existing catalogue colours. */
function suggestColor(seed: string): string {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return `hsl(${h} 72% 62%)`;
}

export function SubmissionReview() {
  const [items, setItems] = useState<BeerSubmission[] | null>(null);
  const [error, setError] = useState('');
  const [colors, setColors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError('');
    try {
      setItems(await listBeerSubmissions('pending'));
    } catch (e) {
      setError(`Laden fehlgeschlagen (Admin-Rechte?): ${(e as Error).message}`);
      setItems([]);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const approve = async (s: BeerSubmission) => {
    const id = slugify(s.name);
    if (BEER_MAP.has(id)) {
      setError(`„${s.name}“ gibt es schon im Katalog (id ${id}).`);
      return;
    }
    setBusy(s.id);
    try {
      await approveBeerSubmission(s.id, {
        id,
        name: s.name,
        brewery: s.brewery,
        city: s.city,
        country: s.country,
        color: colors[s.id] ?? suggestColor(s.name),
      });
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const reject = async (s: BeerSubmission) => {
    const reason = window.prompt('Grund für die Ablehnung (optional):') ?? '';
    setBusy(s.id);
    try {
      await rejectBeerSubmission(s.id, reason);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  if (items === null) return <p className="admin-muted">Lade Einreichungen …</p>;

  return (
    <div className="admin-section">
      <h2>Bier-Einreichungen</h2>
      {error && <p className="admin-error">{error}</p>}
      {items.length === 0 && <p className="admin-muted">Keine offenen Vorschläge.</p>}
      {items.map((s) => (
        <div key={s.id} className="admin-card submission">
          <div className="submission-main">
            <strong>{s.name}</strong> · {s.brewery}, {s.city} ({s.country})
            {s.website && <> · <a href={s.website} target="_blank" rel="noreferrer noopener">Website</a></>}
            {s.note && <p className="admin-muted">„{s.note}“</p>}
            <p className="admin-muted">
              id: <code>{slugify(s.name)}</code> · von {s.submittedBy.slice(0, 8)}… ·{' '}
              {s.createdAt ? new Date(s.createdAt).toLocaleString('de-DE') : '–'}
            </p>
          </div>
          <label className="submission-color">
            Farbe
            <input
              type="color"
              value={colors[s.id] ?? '#e0a040'}
              onChange={(e) => setColors((c) => ({ ...c, [s.id]: e.target.value }))}
            />
          </label>
          <div className="submission-actions">
            <button className="btn btn-primary btn-sm" disabled={busy === s.id} onClick={() => approve(s)}>Freigeben</button>
            <button className="btn btn-danger btn-sm" disabled={busy === s.id} onClick={() => reject(s)}>Ablehnen</button>
          </div>
        </div>
      ))}
    </div>
  );
}
