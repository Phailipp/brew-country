import { useState, useCallback } from 'react';
import type { User } from '../domain/types';
import { useAuth } from './AuthProvider';
import { BEERS } from '../domain/beers';
import { GAME } from '../config/constants';
import { isFirebaseConfigured } from '../config/firebase';
import { getFirebaseAuth } from '../config/firebaseAuth';
import { saveUserProfile } from '../services/firestoreService';
import './Auth.css';

type OnboardingStep = 'age' | 'location' | 'beer' | 'confirm';

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
  const [ageVerified, setAgeVerified] = useState(false);
  const [location, setLocation] = useState<{ lat: number; lon: number } | null>(null);
  const [selectedBeerId, setSelectedBeerId] = useState<string>('augustiner');
  const [error, setError] = useState('');
  const [gpsLoading, setGpsLoading] = useState(false);
  const [impreciseCandidate, setImpreciseCandidate] = useState<ImpreciseLocationCandidate | null>(null);

  const handleAgeNext = () => {
    if (!ageVerified) {
      setError('Du musst bestätigen, dass du mindestens 18 Jahre alt bist.');
      return;
    }
    setError('');
    setStep('location');
  };

  const handleGetLocation = useCallback(async () => {
    if (!navigator.geolocation) {
      setError('GPS wird von deinem Browser nicht unterstützt.');
      return;
    }

    setGpsLoading(true);
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

      // Take first sample
      const s1 = await getSample();
      samples.push(s1);

      // Wait and take second sample
      await new Promise((r) => setTimeout(r, GAME.GPS_SAMPLE_INTERVAL_MS));
      const s2 = await getSample();
      samples.push(s2);

      // Validate accuracy
      for (const s of samples) {
        if (s.accuracy > GAME.GPS_MAX_ACCURACY_METERS) {
          const avgLat = (s1.lat + s2.lat) / 2;
          const avgLon = (s1.lon + s2.lon) / 2;
          const worstAccuracy = Math.max(s1.accuracy, s2.accuracy);
          setImpreciseCandidate({ lat: avgLat, lon: avgLon, accuracy: worstAccuracy });
          setError(
            `GPS-Genauigkeit zu gering (${Math.round(s.accuracy)}m). ` +
            `Bitte gehe nach draußen und versuche es erneut.`
          );
          setGpsLoading(false);
          return;
        }
      }

      // Check for unrealistic jump
      const dlat = (s2.lat - s1.lat) * 111320;
      const dlon = (s2.lon - s1.lon) * 111320 * Math.cos(s1.lat * Math.PI / 180);
      const jumpMeters = Math.sqrt(dlat * dlat + dlon * dlon);
      if (jumpMeters > GAME.GPS_MAX_JUMP_METERS) {
        setError(
          `Positions-Sprung zu groß (${Math.round(jumpMeters)}m). ` +
          `Bitte bleib stehen und versuche es erneut.`
        );
        setGpsLoading(false);
        return;
      }

      // Average the two samples
      const avgLat = (s1.lat + s2.lat) / 2;
      const avgLon = (s1.lon + s2.lon) / 2;

      setLocation({ lat: avgLat, lon: avgLon });
      setImpreciseCandidate(null);
      setGpsLoading(false);
      setStep('beer');
    } catch (err) {
      setGpsLoading(false);
      setError(
        `GPS-Fehler: ${err instanceof GeolocationPositionError ? err.message : 'Unbekannter Fehler'}. ` +
        `Bitte Standortzugriff erlauben.`
      );
    }
  }, []);

  const handleUseImpreciseLocation = useCallback(() => {
    if (!impreciseCandidate) return;
    setLocation({ lat: impreciseCandidate.lat, lon: impreciseCandidate.lon });
    setError('');
    setStep('beer');
  }, [impreciseCandidate]);

  const handleConfirm = async () => {
    if (!location || !selectedBeerId) return;

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

    // Also save public profile to Firestore so other users can see us on the map
    if (isFirebaseConfigured() && location) {
      saveUserProfile(userId, selectedBeerId, location.lat, location.lon).catch((e) =>
        console.error('Failed to save profile to Firestore:', e)
      );
    }
  };

  return (
    <div className="auth-screen">
      <div className="auth-card onboarding-card">
        <h1 className="auth-title">Willkommen bei Brew Country</h1>

        {/* Progress indicator */}
        <div className="onboarding-steps">
          {(['age', 'location', 'beer', 'confirm'] as const).map((s, i) => (
            <div
              key={s}
              className={`step-dot ${step === s ? 'active' : ''} ${
                ['age', 'location', 'beer', 'confirm'].indexOf(step) > i ? 'done' : ''
              }`}
            />
          ))}
        </div>

        {step === 'age' && (
          <div className="onboarding-section">
            <h2>Altersbestätigung</h2>
            <label className="age-checkbox">
              <input
                type="checkbox"
                checked={ageVerified}
                onChange={(e) => setAgeVerified(e.target.checked)}
              />
              <span>Ich bin mindestens 18 Jahre alt</span>
            </label>
            {error && <p className="auth-error">{error}</p>}
            <button className="auth-btn" onClick={handleAgeNext}>
              Weiter
            </button>
          </div>
        )}

        {step === 'location' && (
          <div className="onboarding-section">
            <h2>Dein Standort</h2>
            <p className="auth-instruction">
              Setze dein "Zuhause" — dein Bier dominiert im Umkreis von {GAME.HOME_RADIUS_KM} km.
              Du musst vor Ort sein!
            </p>
            {location ? (
              <div className="location-confirmed">
                <span className="location-pin">📍</span>
                <span>
                  {location.lat.toFixed(4)}, {location.lon.toFixed(4)}
                </span>
              </div>
            ) : (
              <button
                className="auth-btn"
                onClick={handleGetLocation}
                disabled={gpsLoading}
              >
                {gpsLoading ? 'GPS wird gelesen...' : '📍 Standort erfassen'}
              </button>
            )}
            {error && <p className="auth-error">{error}</p>}
            {impreciseCandidate && !location && (
              <button className="auth-btn-secondary" onClick={handleUseImpreciseLocation}>
                Ungenaues GPS-Signal trotzdem verwenden
              </button>
            )}
            {location && (
              <button className="auth-btn" onClick={() => setStep('beer')}>
                Weiter
              </button>
            )}
          </div>
        )}

        {step === 'beer' && (
          <div className="onboarding-section">
            <h2>Dein Bier</h2>
            <p className="auth-instruction">Welche Brauerei vertrittst du?</p>
            <div className="onboarding-beer-grid">
              {BEERS.map((beer) => (
                <button
                  key={beer.id}
                  className={`onboarding-beer-item ${
                    selectedBeerId === beer.id ? 'selected' : ''
                  }`}
                  onClick={() => setSelectedBeerId(beer.id)}
                  style={{
                    borderColor: selectedBeerId === beer.id ? beer.color : 'transparent',
                  }}
                >
                  <img src={beer.svgLogo} alt={beer.name} className="onboarding-beer-logo" />
                  <span className="onboarding-beer-name">{beer.name}</span>
                </button>
              ))}
            </div>
            <button className="auth-btn" onClick={() => setStep('confirm')}>
              Weiter
            </button>
          </div>
        )}

        {step === 'confirm' && (
          <div className="onboarding-section">
            <h2>Bestätigung</h2>
            <div className="confirm-summary">
              <p>
                <strong>Standort:</strong>{' '}
                {location ? `${location.lat.toFixed(4)}, ${location.lon.toFixed(4)}` : '—'}
              </p>
              <p>
                <strong>Bier:</strong>{' '}
                {BEERS.find((b) => b.id === selectedBeerId)?.name ?? '—'}
              </p>
              <p>
                <strong>Radius:</strong> {GAME.HOME_RADIUS_KM} km
              </p>
            </div>
            <button className="auth-btn" onClick={handleConfirm}>
              Los geht's!
            </button>
            <button className="auth-btn-secondary" onClick={() => setStep('beer')}>
              Zurück
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
