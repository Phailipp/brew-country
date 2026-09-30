import { useState, useCallback } from 'react';
import type { User } from '../domain/types';
import { GAME } from '../config/constants';
import { isFirebaseConfigured } from '../config/firebase';
import { saveUserProfile } from '../services/firestoreService';
import { haptic } from '../ui/kit/haptics';
import { AuthBackdrop, AuthBrand, GpsProgress, type GpsPhase } from './AuthChrome';
import './Auth.css';

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

interface Props {
  user: User;
  onLocationSet: (updatedUser: User) => void;
}

/**
 * Full-screen overlay that forces a user to re-set their GPS home location.
 * Shown when homeLat/homeLon is 0 (e.g. admin deleted profile data).
 */
export function ResetLocation({ user, onLocationSet }: Props) {
  const [location, setLocation] = useState<{ lat: number; lon: number } | null>(null);
  const [error, setError] = useState('');
  const [gpsPhase, setGpsPhase] = useState<GpsPhase | null>(null);
  const [saving, setSaving] = useState(false);
  const [impreciseCandidate, setImpreciseCandidate] = useState<ImpreciseLocationCandidate | null>(null);

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

      // Take first sample
      const s1 = await getSample();
      samples.push(s1);

      // Wait and take second sample
      setGpsPhase('wait');
      await new Promise((r) => setTimeout(r, GAME.GPS_SAMPLE_INTERVAL_MS));
      setGpsPhase('second');
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
            `Dein GPS ist gerade ungenau (±${Math.round(s.accuracy)} m). ` +
            `Geh am besten kurz nach draußen und versuch es nochmal.`
          );
          return;
        }
      }

      // Check for unrealistic jump
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

      // Average the two samples
      const avgLat = (s1.lat + s2.lat) / 2;
      const avgLon = (s1.lon + s2.lon) / 2;

      setLocation({ lat: avgLat, lon: avgLon });
      setImpreciseCandidate(null);
      haptic('success');
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
    setLocation({ lat: impreciseCandidate.lat, lon: impreciseCandidate.lon });
    setError('');
  }, [impreciseCandidate]);

  const handleConfirm = useCallback(async () => {
    if (!location) return;

    setSaving(true);
    setError('');
    haptic('medium');
    try {
      const updatedUser: User = {
        ...user,
        homeLat: location.lat,
        homeLon: location.lon,
        homeChangedAt: Date.now(),
      };

      // Save to Firestore
      if (isFirebaseConfigured() && !user.id.startsWith('dev_')) {
        await saveUserProfile(user.id, user.beerId, location.lat, location.lon, user.createdAt, user.standYourGroundEnabled);
      }

      onLocationSet(updatedUser);
    } catch (e) {
      console.error('Failed to save location:', e);
      setError('Speichern hat nicht geklappt. Prüf deine Verbindung und versuch es nochmal.');
      setSaving(false);
    }
  }, [location, user, onLocationSet]);

  const gpsLoading = gpsPhase !== null;

  return (
    <div className="auth-screen">
      <AuthBackdrop />
      <main className="auth-wrap">
        <AuthBrand compact claim={false} />

        <div className="auth-card glass onboarding-card">
          <section className="ob-step">
            <div className="auth-hero-icon" aria-hidden="true">🧭</div>
            <h1 className="ob-title">Wo ist dein Zuhause?</h1>
            <p className="auth-instruction">
              Dein Zuhause muss neu gesetzt werden, bevor es weitergeht. Dein Bier kämpft dann wieder
              in {GAME.HOME_RADIUS_KM} km rund um diesen Ort – du musst dafür gerade vor Ort sein.
            </p>

            {location ? (
              <>
                <div className="ob-located">
                  <span aria-hidden="true">✅</span>
                  <span>Standort gefunden <span className="muted num">({location.lat.toFixed(3)}, {location.lon.toFixed(3)})</span></span>
                </div>
                <button
                  type="button"
                  className="btn btn-primary btn-lg btn-block"
                  onClick={handleConfirm}
                  disabled={saving}
                  aria-busy={saving}
                >
                  {saving ? <><span className="spinner" aria-hidden="true" /> Speichere …</> : 'Hier ist mein Zuhause'}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-block"
                  onClick={() => { setLocation(null); setError(''); }}
                  disabled={saving}
                >
                  Nochmal messen
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

            {error && <p className="auth-error" role="alert">{error}</p>}
            {impreciseCandidate && !location && !gpsLoading && (
              <button
                type="button"
                className="btn btn-secondary btn-block"
                onClick={handleUseImpreciseLocation}
              >
                Ungenauen Standort trotzdem nehmen
              </button>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
