import type { OverlaySettings } from '../domain/types';
import './SettingsPanel.css';

interface Props {
  settings: OverlaySettings;
  onChange: (settings: OverlaySettings) => void;
}

export function SettingsPanel({ settings, onChange }: Props) {
  const update = (patch: Partial<OverlaySettings>) => {
    onChange({ ...settings, ...patch });
  };

  return (
    <div className="settings-panel">
      <h3>Einstellungen</h3>

      <div className="settings-group">
        <label className="settings-toggle">
          <input
            type="checkbox"
            checked={settings.showBorders}
            onChange={(e) => update({ showBorders: e.target.checked })}
          />
          <span>Grenzen anzeigen</span>
        </label>

        {settings.showBorders && (
          <div className="settings-slider">
            <span className="slider-label">Linienst&auml;rke</span>
            <input
              type="range"
              min={0.5}
              max={5}
              step={0.5}
              value={settings.borderWidth}
              onChange={(e) => update({ borderWidth: Number(e.target.value) })}
            />
            <span className="slider-value">{settings.borderWidth}px</span>
          </div>
        )}
      </div>

      <div className="settings-group">
        <label className="settings-toggle">
          <input
            type="checkbox"
            checked={settings.showLogos}
            onChange={(e) => update({ showLogos: e.target.checked })}
          />
          <span>Logos anzeigen</span>
        </label>
      </div>

      <div className="settings-group">
        <label className="settings-toggle">
          <input
            type="checkbox"
            checked={settings.showSwords}
            onChange={(e) => update({ showSwords: e.target.checked })}
          />
          <span>Knappe Gebiete markieren</span>
        </label>

        {settings.showSwords && (
          <div className="settings-slider">
            <span className="slider-label">Schwellwert</span>
            <input
              type="range"
              min={0.02}
              max={0.30}
              step={0.02}
              value={settings.closeMarginThreshold}
              onChange={(e) => update({ closeMarginThreshold: Number(e.target.value) })}
            />
            <span className="slider-value">{Math.round(settings.closeMarginThreshold * 100)}%</span>
          </div>
        )}
      </div>

      <div className="settings-group">
        <div className="settings-slider">
          <span className="slider-label">Gl&auml;ttung</span>
          <input
            type="range"
            min={0}
            max={5}
            step={1}
            value={settings.smoothingIterations}
            onChange={(e) => update({ smoothingIterations: Number(e.target.value) })}
          />
          <span className="slider-value">{settings.smoothingIterations}x</span>
        </div>
      </div>

      <div className="settings-group">
        <div className="settings-slider">
          <span className="slider-label">Min. Gebiet</span>
          <input
            type="range"
            min={1}
            max={20}
            step={1}
            value={settings.mergeIslandSize}
            onChange={(e) => update({ mergeIslandSize: Number(e.target.value) })}
          />
          <span className="slider-value">{settings.mergeIslandSize}</span>
        </div>
      </div>
    </div>
  );
}
