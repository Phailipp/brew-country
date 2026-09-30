import { useState, useCallback, useEffect, useRef, type CSSProperties } from 'react';
import { nearestCity, localeCountry } from '../domain/worldCities';
import { searchBeers } from '../domain/beers';
import type { User } from '../domain/types';
import { useAuth } from './authContext';
import { BeerPicker } from '../ui/BeerPicker';
import { SuggestBeerDialog } from '../ui/SuggestBeerDialog';
import { GAME } from '../config/constants';
import { isFirebaseConfigured } from '../config/firebase';
import { getFirebaseAuth } from '../config/firebaseAuth';
import { saveUserProfile } from '../services/firestoreService';
import { BeerBadge } from '../ui/kit/BeerBadge';
import { beerName, beerColor } from '../ui/kit/beer';
import { haptic } from '../ui/kit/haptics';
import { AuthBackdrop, AuthBrand, GpsProgress, type GpsPhase } from './AuthChrome';
import './Auth.css';

type OnboardingStep = 'age' | 'location' | 'beer' | 'confirm';
const STEPS: OnboardingStep[] = ['age', 'location', 'beer', 'confirm'];
const STEP_LABELS: Record<OnboardingStep, string> = {
  age: 'Alter',
  location: 'Zuhause',
  beer: 'Bier',
  confirm: 'Los',
};

interface GpsSample {
  lat: number;
  lon: number;
  accuracy: number;
}

interface ImpreciseLocationCandidate {
  lat: number;
  lon: number;
  accuracy: number;
}

export function Onboarding() {
  const { auth, completeOnboarding } = useAuth();
  const userId = auth.status === 'onboarding' ? auth.userId : '';

  const [step, setStep] = useState<OnboardingStep>('age');
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [ageVerified, setAgeVerified] = useState(false);
  const [location, setLocation] = useState<{ lat: number; lon: number } | null>(null);
  const [selectedBeerId, setSelectedBeerId] = useState<string>(() => searchBeers('', localeCountry())[0]?.id ?? 'augustiner');
  const beerTouchedRef = useRef(false);
  /** Store the home spot and, until the player picks one, preselect a local beer. */
  const applyLocation = (loc: { lat: number; lon: number } | null) => {
    setLocation(loc);
    if (loc && !beerTouchedRef.current) {
      const local = searchBeers('', nearestCity(loc.lat, loc.lon).country)[0];
      if (local) setSelectedBeerId(local.id);
    }
  };
  const [error, setError] = useState('');
  const [gpsPhase, setGpsPhase] = useState<GpsPhase | null>(null);
  const [impreciseCandidate, setImpreciseCandidate] = useState<ImpreciseLocationCandidate | null>(null);
  const [manualLat, setManualLat] = useState('48.1374');
  const [manualLon, setManualLon] = useState('11.5755');
  const [showManual, setShowManual] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const gpsLoading = gpsPhase !== null;
  const stepIndex = STEPS.indexOf(step);

  // Move focus to the step heading for screen readers / keyboard users
  useEffect(() => {
    headingRef.current?.focus();
  }, [step]);

  const goTo = (s: OnboardingStep) => {
    setError('');
    setStep(s);
  };

  const handleAgeNext = () => {
    if (!ageVerified) {
      setError('Brew Country ist nur für Erwachsene. Bitte bestätige, dass du mindestens 18 bist.');
      return;
    }
    haptic('light');
    goTo('location');
  };

  const handleGetLocation = useCallback(async () => {
    if (!navigator.geolocation) {
      setError('Dein Browser kann deinen Standort leider nicht bestimmen.');
      return;
    }

    setGpsPhase('first');
    setError('');
    setImpreciseCandidate(null);

    try {
      const samples: GpsSample[] = [];

      const getSample = (): Promise<GpsSample> =>
        new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(
            (pos) =>
              resolve({
                lat: pos.coords.latitude,
                lon: pos.coords.longitude,
                accuracy: pos.coords.accuracy,
              }),
            (err) => reject(err),
            { enableHighAccuracy: true, timeout: 15000 }
          );
        });

      const s1 = await getSample();
      samples.push(s1);

      setGpsPhase('wait');
      await new Promise((r) => setTimeout(r, GAME.GPS_SAMPLE_INTERVAL_MS));
      setGpsPhase('second');
      const s2 = await getSample();
      samples.push(s2);

      for (const s of samples) {
        if (s.accuracy > GAME.GPS_MAX_ACCURACY_METERS) {
          const avgLat = (s1.lat + s2.lat) / 2;
          const avgLon = (s1.lon + s2.lon) / 2;
          const worstAccuracy = Math.max(s1.accuracy, s2.accuracy);
          setImpreciseCandidate({ lat: avgLat, lon: avgLon, accuracy: worstAccuracy });
          setError(
            `Dein GPS ist gerade ungenau (±${Math.round(s.accuracy)} m). ` +
            `Geh am besten kurz nach draußen und versuch es nochmal.`
          );
          return;
        }
      }

      const dlat = (s2.lat - s1.lat) * 111320;
      const dlon = (s2.lon - s1.lon) * 111320 * Math.cos(s1.lat * Math.PI / 180);
      const jumpMeters = Math.sqrt(dlat * dlat + dlon * dlon);
      if (jumpMeters > GAME.GPS_MAX_JUMP_METERS) {
        setError(
          `Du hast dich zwischen den Messungen bewegt (${Math.round(jumpMeters)} m). ` +
          `Bleib kurz stehen und versuch es nochmal.`
        );
        return;
      }

      const avgLat = (s1.lat + s2.lat) / 2;
      const avgLon = (s1.lon + s2.lon) / 2;

      applyLocation({ lat: avgLat, lon: avgLon });
      setImpreciseCandidate(null);
      haptic('success');
      setStep('beer');
    } catch (err) {
      setError(
        typeof GeolocationPositionError !== 'undefined' && err instanceof GeolocationPositionError && err.code === err.PERMISSION_DENIED
          ? 'Wir dürfen deinen Standort nicht sehen. Erlaube den Zugriff in den Einstellungen und versuch es nochmal.'
          : 'Dein Standort konnte nicht bestimmt werden. Versuch es nochmal.'
      );
    } finally {
      setGpsPhase(null);
    }
  }, []);

  const handleUseImpreciseLocation = useCallback(() => {
    if (!impreciseCandidate) return;
    applyLocation({ lat: impreciseCandidate.lat, lon: impreciseCandidate.lon });
    setError('');
    setStep('beer');
  }, [impreciseCandidate]);

  const handleManualLocation = () => {
    const lat = parseFloat(manualLat);
    const lon = parseFloat(manualLon);
    if (isNaN(lat) || isNaN(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
      setError('Diese Koordinaten stimmen nicht. Beispiel: 48.1374 / 11.5755');
      return;
    }
    setError('');
    applyLocation({ lat, lon });
    setStep('beer');
  };

  const handleConfirm = async () => {
    if (!location || !selectedBeerId || confirming) return;

    setConfirming(true);
    setError('');
    haptic('medium');

    try {
      const firebaseUser = isFirebaseConfigured() ? getFirebaseAuth().currentUser : null;

      const now = Date.now();
      const user: User = {
        id: userId,
        phone: null,
        email: firebaseUser?.email ?? null,
        nickname: firebaseUser?.displayName ?? null,
        createdAt: now,
        lastActiveAt: now,
        homeLat: location.lat,
        homeLon: location.lon,
        beerId: selectedBeerId,
        standYourGroundEnabled: false,
        ageVerified: true,
      };

      await completeOnboarding(user);
      haptic('success');

      // Also save public profile so other users can see us on the map
      if (isFirebaseConfigured() && !userId.startsWith('dev_')) {
        saveUserProfile(userId, selectedBeerId, location.lat, location.lon, now).catch((e) =>
          console.error('Failed to save profile to Firestore:', e)
        );
      }
    } catch (e) {
      console.error('completeOnboarding error:', e);
      setError('Das Speichern hat nicht geklappt. Prüf deine Verbindung und versuch es nochmal.');
      setConfirming(false);
    }
  };

  const errorBox = error ? <p className="auth-error" role="alert">{error}</p> : null;

  return (
    <div className="auth-screen">
      <AuthBackdrop />
      <main className="auth-wrap">
        <AuthBrand compact claim={false} />

        <div className="auth-card glass onboarding-card">
          {/* Progress */}
          <div className="ob-progress">
            <div className="ob-progress-head">
              <span className="eyebrow">Schritt {stepIndex + 1} von {STEPS.length}</span>
              <span className="eyebrow ob-progress-label">{STEP_LABELS[step]}</span>
            </div>
            <ol className="ob-dots" aria-label="Fortschritt">
              {STEPS.map((s, i) => (
                <li
                  key={s}
                  className={`ob-dot${i === stepIndex ? ' active' : ''}${i < stepIndex ? ' done' : ''}`}
                  aria-current={i === stepIndex ? 'step' : undefined}
                >
                  <span className="sr-only">{STEP_LABELS[s]}{i < stepIndex ? ' (erledigt)' : ''}</span>
                </li>
              ))}
            </ol>
          </div>

          {step === 'age' && (
            <section className="ob-step" key="age">
              <div className="auth-hero-icon" aria-hidden="true">🔞</div>
              <h1 className="ob-title" ref={headingRef} tabIndex={-1}>Kurz vorab</h1>
              <p className="auth-instruction">
                Bei Brew Country dreht sich alles um Bier. Deshalb ist die App erst ab 18.
              </p>
              <label className={`ob-check${ageVerified ? ' checked' : ''}`}>
                <input
                  type="checkbox"
                  checked={ageVerified}
                  onChange={(e) => { setAgeVerified(e.target.checked); setError(''); }}
                />
                <span className="ob-check-box" aria-hidden="true">
                  <svg width="16" height="16" viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </span>
                <span>Ich bin mindestens 18 Jahre alt</span>
              </label>
              {errorBox}
              <button type="button" className="btn btn-primary btn-lg btn-block" onClick={handleAgeNext}>
                Weiter
              </button>
            </section>
          )}

          {step === 'location' && (
            <section className="ob-step" key="location">
              <div className="auth-hero-icon" aria-hidden="true">📍</div>
              <h1 className="ob-title" ref={headingRef} tabIndex={-1}>Wo ist dein Zuhause?</h1>
              <p className="auth-instruction">
                Dein Bier kämpft in {GAME.HOME_RADIUS_KM} km rund um dein Zuhause um die Vorherrschaft.
                Du musst dafür gerade vor Ort sein.
              </p>

              {location ? (
                <>
                  <div className="ob-located">
                    <span aria-hidden="true">✅</span>
                    <span>Standort gespeichert <span className="muted num">({location.lat.toFixed(3)}, {location.lon.toFixed(3)})</span></span>
                  </div>
                  <button type="button" className="btn btn-primary btn-lg btn-block" onClick={() => goTo('beer')}>
                    Weiter
                  </button>
                </>
              ) : gpsPhase ? (
                <GpsProgress phase={gpsPhase} intervalMs={GAME.GPS_SAMPLE_INTERVAL_MS} />
              ) : (
                <button type="button" className="btn btn-primary btn-lg btn-block" onClick={handleGetLocation}>
                  <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3.5" fill="currentColor" /><circle cx="12" cy="12" r="7.5" fill="none" stroke="currentColor" strokeWidth="2" /><path d="M12 1.5v3M12 19.5v3M1.5 12h3M19.5 12h3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
                  Standort per GPS bestimmen
                </button>
              )}

              {errorBox}

              {impreciseCandidate && !location && !gpsLoading && (
                <button type="button" className="btn btn-secondary btn-block" onClick={handleUseImpreciseLocation}>
                  Ungenauen Standort trotzdem nehmen
                </button>
              )}

              {!location && !gpsLoading && (
                <div className="ob-manual">
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    aria-expanded={showManual}
                    aria-controls="ob-manual-fields"
                    onClick={() => setShowManual((v) => !v)}
                  >
                    {showManual ? 'Manuelle Eingabe ausblenden' : 'Koordinaten selbst eingeben'}
                  </button>
                  {showManual && (
                    <div className="ob-manual-fields fade-in" id="ob-manual-fields">
                      <div className="ob-manual-grid">
                        <div className="field">
                          <label className="field-label" htmlFor="ob-lat">Breitengrad</label>
                          <input id="ob-lat" type="number" inputMode="decimal" step="0.0001" value={manualLat} onChange={(e) => setManualLat(e.target.value)} />
                        </div>
                        <div className="field">
                          <label className="field-label" htmlFor="ob-lon">Längengrad</label>
                          <input id="ob-lon" type="number" inputMode="decimal" step="0.0001" value={manualLon} onChange={(e) => setManualLon(e.target.value)} />
                        </div>
                      </div>
                      <button type="button" className="btn btn-secondary btn-block" onClick={handleManualLocation}>
                        Diesen Standort nehmen
                      </button>
                    </div>
                  )}
                </div>
              )}

              {!gpsLoading && (
                <button type="button" className="btn btn-ghost btn-block" onClick={() => goTo('age')}>
                  Zurück
                </button>
              )}
            </section>
          )}

          {step === 'beer' && (
            <section className="ob-step" key="beer">
              <h1 className="ob-title" ref={headingRef} tabIndex={-1}>Wähl dein Bier</h1>
              <p className="auth-instruction">Für welche Brauerei ziehst du in die Schlacht?</p>
              <BeerPicker
                value={selectedBeerId}
                onChange={(id) => { beerTouchedRef.current = true; setSelectedBeerId(id); }}
                layout="grid"
                onSuggest={() => setSuggestOpen(true)}
                country={location ? nearestCity(location.lat, location.lon).country : null}
              />
              <div className="ob-sticky-cta">
                <button type="button" className="btn btn-primary btn-lg btn-block" onClick={() => goTo('confirm')}>
                  Weiter mit {beerName(selectedBeerId)}
                </button>
                <button type="button" className="btn btn-ghost btn-block" onClick={() => goTo('location')}>
                  Zurück
                </button>
              </div>
            </section>
          )}

          {step === 'confirm' && (
            <section className="ob-step" key="confirm">
              <h1 className="ob-title" ref={headingRef} tabIndex={-1}>Bereit zum Anstoßen?</h1>
              <div
                className="ob-summary"
                style={{ '--tile-color': beerColor(selectedBeerId) } as CSSProperties}
              >
                <BeerBadge beerId={selectedBeerId} size="xl" />
                <p className="ob-summary-beer">{beerName(selectedBeerId)}</p>
                <p className="ob-summary-sub">
                  regiert ab jetzt {GAME.HOME_RADIUS_KM} km rund um dein Zuhause – wenn du es verteidigst.
                </p>
                <ul className="ob-summary-chips">
                  <li className="chip chip-accent">×{GAME.HOME_BOOST_MAX} Startbonus</li>
                  <li className="chip">📍 Zuhause gesetzt</li>
                </ul>
              </div>
              {errorBox}
              <button
                type="button"
                className="btn btn-primary btn-lg btn-block"
                onClick={handleConfirm}
                disabled={confirming}
                aria-busy={confirming}
              >
                {confirming ? <><span className="spinner" aria-hidden="true" /> Zapfe dein Revier …</> : 'Los geht’s! 🍻'}
              </button>
              <button type="button" className="btn btn-ghost btn-block" onClick={() => goTo('beer')} disabled={confirming}>
                Zurück
              </button>
            </section>
          )}
        </div>
      </main>
      <SuggestBeerDialog
        open={suggestOpen}
        onClose={() => setSuggestOpen(false)}
        userId={userId}
      />
    </div>
  );
}
