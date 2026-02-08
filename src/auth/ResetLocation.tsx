import { useState, useCallback } from 'react';
import type { User } from '../domain/types';
import { GAME } from '../config/constants';
import { isFirebaseConfigured } from '../config/firebase';
import { saveUserProfile } from '../services/firestoreService';
import './Auth.css';

interface GpsSample {
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
  const [gpsLoading, setGpsLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleGetLocation = useCallback(async () => {
    if (!navigator.geolocation) {
      setError('GPS wird von deinem Browser nicht unterstützt.');
      return;
    }

    setGpsLoading(true);
    setError('');

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
          setError(
            `GPS-Genauigkeit zu gering (${Math.round(s.accuracy)}m). ` +
            `Bitte gehe nach draussen und versuche es erneut.`
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
          `Positions-Sprung zu gross (${Math.round(jumpMeters)}m). ` +
          `Bitte bleib stehen und versuche es erneut.`
        );
        setGpsLoading(false);
        return;
      }

      // Average the two samples
      const avgLat = (s1.lat + s2.lat) / 2;
      const avgLon = (s1.lon + s2.lon) / 2;

      setLocation({ lat: avgLat, lon: avgLon });
      setGpsLoading(false);
    } catch (err) {
      setGpsLoading(false);
      setError(
        `GPS-Fehler: ${err instanceof GeolocationPositionError ? err.message : 'Unbekannter Fehler'}. ` +
        `Bitte Standortzugriff erlauben.`
      );
    }
  }, []);

  const handleConfirm = useCallback(async () => {
    if (!location) return;

    setSaving(true);
    try {
      const updatedUser: User = {
        ...user,
        homeLat: location.lat,
        homeLon: location.lon,
      };

      // Save to Firestore
      if (isFirebaseConfigured()) {
        await saveUserProfile(user.id, user.beerId, location.lat, location.lon);
      }

      onLocationSet(updatedUser);
    } catch (e) {
      console.error('Failed to save location:', e);
      setError('Fehler beim Speichern. Bitte versuche es erneut.');
      setSaving(false);
    }
  }, [location, user, onLocationSet]);

  return (
    <div className="auth-screen">
      <div className="auth-card onboarding-card">
        <h1 className="auth-title">Standort erforderlich</h1>
        <p className="auth-subtitle">
          Dein Heimat-Standort muss neu gesetzt werden, bevor du weitermachen kannst.
        </p>

        <div className="onboarding-section">
          <h2>Dein Standort</h2>
          <p className="auth-instruction">
            Setze dein "Zuhause" neu — dein Bier dominiert im Umkreis von {GAME.HOME_RADIUS_KM} km.
            Du musst vor Ort sein!
          </p>

          {location ? (
            <>
              <div className="location-confirmed">
                <span className="location-pin">📍</span>
                <span>
                  {location.lat.toFixed(4)}, {location.lon.toFixed(4)}
                </span>
              </div>
              <button
                className="auth-btn"
                onClick={handleConfirm}
                disabled={saving}
              >
                {saving ? 'Speichere...' : 'Standort bestätigen'}
              </button>
              <button
                className="auth-btn-secondary"
                onClick={() => { setLocation(null); setError(''); }}
                disabled={saving}
              >
                Nochmal messen
              </button>
            </>
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
        </div>
      </div>
    </div>
  );
}
