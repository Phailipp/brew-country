import { useEffect, useRef, useState, type FormEvent } from 'react';
import { countryFlag, sortedCountries } from '../domain/countries';
import { localeCountry } from '../domain/worldCities';
import { isDemoUserId } from '../auth/authContext';
import { submitBeerSuggestion, type BeerSubmissionInput } from '../services/firestoreService';
import { haptic } from './kit/haptics';
import './SuggestBeerDialog.css';

interface Props {
  open: boolean;
  onClose: () => void;
  userId: string;
}

/** "www.brauerei.de" → "https://www.brauerei.de"; empty stays empty. */
function normalizeWebsite(raw: string): string {
  const v = raw.trim();
  if (!v) return '';
  return (/^https?:\/\//i.test(v) ? v.replace(/^http:/i, 'https:') : `https://${v}`).slice(0, 200);
}

const EMPTY: BeerSubmissionInput = { name: '', brewery: '', city: '', country: localeCountry() ?? 'DE', website: '', note: '' };

/**
 * "Your beer is missing?" — players suggest a brand; it is reviewed by the
 * Brew Country team before it shows up in the catalogue.
 */
export function SuggestBeerDialog({ open, onClose, userId }: Props) {
  const [form, setForm] = useState<BeerSubmissionInput>(EMPTY);
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');
  const dialogRef = useRef<HTMLDialogElement>(null);
  const isDemo = isDemoUserId(userId);

  useEffect(() => {
    const dlg = dialogRef.current;
    if (!dlg) return;
    if (open && !dlg.open) dlg.showModal();
    if (!open && dlg.open) dlg.close();
  }, [open]);

  const set = (key: keyof BeerSubmissionInput) => (value: string) => setForm((f) => ({ ...f, [key]: value }));

  const valid = form.name.trim().length >= 2 && form.brewery.trim().length >= 2 && form.city.trim().length >= 2;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    setState('sending');
    try {
      const clean: BeerSubmissionInput = {
        name: form.name.trim().slice(0, 60),
        brewery: form.brewery.trim().slice(0, 80),
        city: form.city.trim().slice(0, 60),
        country: form.country,
        website: normalizeWebsite(form.website),
        note: form.note.trim().slice(0, 300),
      };
      if (!isDemo) await submitBeerSuggestion(userId, clean);
      setState('done');
      haptic('success');
    } catch {
      setState('error');
      haptic('medium');
    }
  };

  const close = () => {
    onClose();
    // reset after the close animation
    setTimeout(() => { setForm(EMPTY); setState('idle'); }, 250);
  };

  return (
    <dialog ref={dialogRef} className="suggest glass-panel" onClose={close} onCancel={close} aria-labelledby="suggest-title">
      {state === 'done' ? (
        <div className="suggest-done">
          <span className="suggest-done-icon" aria-hidden="true">🍺</span>
          <h2 id="suggest-title" className="suggest-title">Danke, Prost!</h2>
          <p className="muted">
            {isDemo
              ? 'In der Demo wird nichts gespeichert – mit Konto landet dein Vorschlag direkt bei uns zur Prüfung.'
              : `Wir prüfen „${form.name}“ und schalten es frei, sobald alles passt. Meist dauert das ein, zwei Tage.`}
          </p>
          <button className="btn btn-primary btn-block" onClick={close}>Alles klar</button>
        </div>
      ) : (
        <form className="suggest-form" onSubmit={submit}>
          <header className="suggest-head">
            <h2 id="suggest-title" className="suggest-title">Bier vorschlagen</h2>
            <button type="button" className="icon-btn" onClick={close} aria-label="Schließen">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
            </button>
          </header>
          <p className="muted">Deine Lieblingsmarke fehlt? Schick sie uns – nach kurzer Prüfung taucht sie für alle auf.</p>

          <label className="field">
            <span className="field-label">Biermarke *</span>
            <input type="text" value={form.name} onChange={(e) => set('name')(e.target.value)} placeholder="z. B. Unertl Weißbier" required maxLength={60} autoFocus />
          </label>
          <label className="field">
            <span className="field-label">Brauerei *</span>
            <input type="text" value={form.brewery} onChange={(e) => set('brewery')(e.target.value)} placeholder="z. B. Weißbräu Unertl" required maxLength={80} />
          </label>
          <div className="suggest-row">
            <label className="field">
              <span className="field-label">Ort *</span>
              <input type="text" value={form.city} onChange={(e) => set('city')(e.target.value)} placeholder="Haag i. OB" required maxLength={60} />
            </label>
            <label className="field suggest-country">
              <span className="field-label">Land</span>
              <select value={form.country} onChange={(e) => set('country')(e.target.value)}>
                {sortedCountries().map((c) => (
                  <option key={c.code} value={c.code}>{countryFlag(c.code)} {c.name}</option>
                ))}
              </select>
            </label>
          </div>
          <label className="field">
            <span className="field-label">Website (optional)</span>
            <input type="url" value={form.website} onChange={(e) => set('website')(e.target.value)} placeholder="https://…" maxLength={200} />
          </label>
          <label className="field">
            <span className="field-label">Warum gehört es rein? (optional)</span>
            <textarea rows={2} value={form.note} onChange={(e) => set('note')(e.target.value)} maxLength={300} placeholder="Das beste Helle im Landkreis …" />
          </label>

          {state === 'error' && <p className="suggest-error" role="alert">Das hat nicht geklappt. Versuch es gleich nochmal.</p>}

          <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={!valid || state === 'sending'}>
            {state === 'sending' ? <><span className="spinner" aria-hidden="true" /> Wird gesendet …</> : 'Zur Prüfung einreichen'}
          </button>
        </form>
      )}
    </dialog>
  );
}
