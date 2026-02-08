import { useState, useEffect } from 'react';
import { getNow, setMockTime, advanceMockTime, resetClock, isMockActive } from '../domain/clock';

const HOUR_MS = 60 * 60 * 1000;

export function TimeControls() {
  const [mockActive, setMockActiveState] = useState(isMockActive());
  const [currentTime, setCurrentTime] = useState(getNow());
  const [inputDate, setInputDate] = useState('');

  useEffect(() => {
    const id = setInterval(() => {
      setCurrentTime(getNow());
      setMockActiveState(isMockActive());
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const handleSetTime = () => {
    if (!inputDate) return;
    const ts = new Date(inputDate).getTime();
    if (isNaN(ts)) return;
    setMockTime(ts);
    setCurrentTime(ts);
    setMockActiveState(true);
  };

  const handleAdvance = (hours: number) => {
    advanceMockTime(hours * HOUR_MS);
    setCurrentTime(getNow());
    setMockActiveState(true);
  };

  const handleReset = () => {
    resetClock();
    setCurrentTime(getNow());
    setMockActiveState(false);
  };

  const formattedTime = new Date(currentTime).toLocaleString('de-DE');

  return (
    <div className="admin-section">
      <h3>Mock Clock</h3>

      {mockActive && (
        <div className="admin-warning">
          Mock-Clock aktiv! Die App nutzt eine simulierte Zeit.
        </div>
      )}

      <div className="admin-stat">
        <span className="admin-stat-label">Aktuelle Zeit</span>
        <span className="admin-stat-value">{formattedTime}</span>
      </div>

      <div className="admin-row" style={{ marginTop: '0.75rem' }}>
        <input
          type="datetime-local"
          className="admin-input"
          style={{ width: '220px' }}
          value={inputDate}
          onChange={e => setInputDate(e.target.value)}
        />
        <button className="admin-btn" onClick={handleSetTime}>Set</button>
      </div>

      <div className="admin-row">
        <button className="admin-btn warning" onClick={() => handleAdvance(1)}>+1h</button>
        <button className="admin-btn warning" onClick={() => handleAdvance(6)}>+6h</button>
        <button className="admin-btn warning" onClick={() => handleAdvance(24)}>+24h</button>
        <button className="admin-btn warning" onClick={() => handleAdvance(48)}>+48h</button>
      </div>

      <div className="admin-row">
        <button className="admin-btn danger" onClick={handleReset}>Reset (Echtzeit)</button>
      </div>
    </div>
  );
}
