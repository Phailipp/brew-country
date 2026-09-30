import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Map as MapLibreMap, Marker, setWorkerUrl, type GeoJSONSource, type ExpressionSpecification } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
// Let Vite bundle MapLibre's module worker (incl. its shared chunk). MapLibre's
// own URL guess breaks after bundling and under capacitor:// on iOS.
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import type { FeatureCollection, Point } from 'geojson';
import type { Vote, ViewportBounds } from '../domain/types';
import type { TerritoryGeometry } from '../domain/territoryGeometry';
import { BEERS, BEER_MAP } from '../domain/beers';
import { MUNICH_CENTER } from '../domain/geo';
import { loadMapStyle, TERRITORY_BEFORE_ID } from './map/mapStyle';
import './MapView.css';

export interface MapViewHandle {
  flyTo: (lat: number, lon: number, zoom?: number) => void;
  /** Expanding colour wave, e.g. after a check-in. */
  pulseAt: (lat: number, lon: number, color: string) => void;
  toggle3d: () => boolean;
}

export interface FriendMarker {
  userId: string;
  lat: number;
  lon: number;
  beerId: string;
  online: boolean;
  name?: string | null;
}

interface Props {
  geometry: TerritoryGeometry | null;
  votes: Vote[];
  home: { lat: number; lon: number; beerId: string } | null;
  friends: FriendMarker[];
  selectedPoint: { lat: number; lon: number } | null;
  onMapTap: (lat: number, lon: number) => void;
  /** Zoom is reported in the legacy (Leaflet/256px) scale used by the grid config. */
  onViewportChange: (bounds: ViewportBounds, zoom: number) => void;
}

setWorkerUrl(maplibreWorkerUrl);

const EMPTY: FeatureCollection = { type: 'FeatureCollection', features: [] };
const REDUCED_MOTION = typeof window !== 'undefined'
  && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

const beerColorExpr: ExpressionSpecification = [
  'match', ['get', 'beerId'],
  ...BEERS.flatMap((b) => [b.id, b.color]),
  '#a39580',
] as unknown as ExpressionSpecification;

function loadBeerIcons(map: MapLibreMap) {
  for (const beer of BEERS) {
    const id = `beer-${beer.id}`;
    if (map.hasImage(id)) continue;
    const img = new Image(96, 96);
    img.onload = () => {
      if (!map.hasImage(id)) map.addImage(id, img, { pixelRatio: 2 });
    };
    img.src = beer.logoUrl ?? beer.svgLogo;
  }
}

function addGameLayers(map: MapLibreMap) {
  const before = map.getLayer(TERRITORY_BEFORE_ID) ? TERRITORY_BEFORE_ID : undefined;

  map.addSource('territories', { type: 'geojson', data: EMPTY, tolerance: 0.3 });
  map.addSource('hotspots', { type: 'geojson', data: EMPTY, tolerance: 0.3 });
  map.addSource('region-labels', { type: 'geojson', data: EMPTY });
  map.addSource('votes', { type: 'geojson', data: EMPTY });
  map.addSource('pulse', { type: 'geojson', data: EMPTY });
  map.addSource('selected', { type: 'geojson', data: EMPTY });

  map.addLayer({
    id: 'territory-fill',
    type: 'fill',
    source: 'territories',
    paint: {
      'fill-color': beerColorExpr,
      'fill-opacity': ['interpolate', ['linear'], ['zoom'], 5, 0.46, 11, 0.3, 15, 0.18],
      'fill-antialias': true,
    },
  }, before);

  map.addLayer({
    id: 'hotspot-fill',
    type: 'fill',
    source: 'hotspots',
    paint: { 'fill-color': '#ff4d2e', 'fill-opacity': 0.14 },
  }, before);

  // Borders go above roads so the frontlines read clearly
  map.addLayer({
    id: 'territory-glow',
    type: 'line',
    source: 'territories',
    layout: { 'line-join': 'round' },
    paint: {
      'line-color': beerColorExpr,
      'line-width': ['interpolate', ['linear'], ['zoom'], 5, 3, 14, 10],
      'line-blur': ['interpolate', ['linear'], ['zoom'], 5, 3, 14, 8],
      'line-opacity': 0.45,
    },
  });
  map.addLayer({
    id: 'territory-line',
    type: 'line',
    source: 'territories',
    layout: { 'line-join': 'round' },
    paint: {
      'line-color': beerColorExpr,
      'line-width': ['interpolate', ['linear'], ['zoom'], 5, 0.8, 14, 2.2],
      'line-opacity': 0.95,
    },
  });
  map.addLayer({
    id: 'hotspot-line',
    type: 'line',
    source: 'hotspots',
    layout: { 'line-join': 'round', 'line-cap': 'round' },
    paint: {
      'line-color': '#ff6a3d',
      'line-width': ['interpolate', ['linear'], ['zoom'], 5, 1.2, 14, 3],
      'line-dasharray': [1.5, 1.5],
      'line-opacity': 0.9,
    },
  });

  map.addLayer({
    id: 'votes',
    type: 'circle',
    source: 'votes',
    minzoom: 9,
    paint: {
      'circle-color': beerColorExpr,
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 9, 1.5, 15, 5],
      'circle-stroke-color': '#0b0a08',
      'circle-stroke-width': 1,
      'circle-opacity': 0.9,
    },
  });

  map.addLayer({
    id: 'pulse',
    type: 'circle',
    source: 'pulse',
    paint: {
      'circle-color': ['get', 'color'],
      'circle-radius': ['get', 'radius'],
      'circle-opacity': ['get', 'opacity'],
      'circle-blur': 0.35,
      'circle-stroke-color': ['get', 'color'],
      'circle-stroke-width': 3,
      'circle-stroke-opacity': ['get', 'opacity'],
    },
  });

  map.addLayer({
    id: 'selected',
    type: 'circle',
    source: 'selected',
    paint: {
      'circle-radius': 9,
      'circle-color': 'rgba(255,246,232,0.15)',
      'circle-stroke-color': '#fff6e8',
      'circle-stroke-width': 2.5,
    },
  });

  map.addLayer({
    id: 'region-labels',
    type: 'symbol',
    source: 'region-labels',
    layout: {
      'icon-image': ['concat', 'beer-', ['get', 'beerId']],
      'icon-size': ['interpolate', ['linear'], ['zoom'], 5, 0.42, 12, 0.6],
      'icon-allow-overlap': false,
      'text-field': ['upcase', ['get', 'name']],
      'text-font': ['Noto Sans Bold'],
      'text-size': ['interpolate', ['linear'], ['zoom'], 5, 10, 12, 13],
      'text-letter-spacing': 0.08,
      'text-offset': [0, 1.9],
      'text-anchor': 'top',
      'text-optional': true,
      'symbol-sort-key': ['get', 'rank'],
      'symbol-z-order': 'source',
    },
    paint: {
      'text-color': '#fff6e8',
      'text-halo-color': 'rgba(11,10,8,0.9)',
      'text-halo-width': 1.6,
    },
  });
}

function makeHomeMarker(beerId: string): HTMLElement {
  const beer = BEER_MAP.get(beerId);
  const el = document.createElement('div');
  el.className = 'home-marker';
  el.style.setProperty('--beer', beer?.color ?? '#ffb020');
  el.setAttribute('aria-label', 'Dein Zuhause');
  const badge = document.createElement('span');
  badge.className = 'home-marker-badge';
  if (beer) badge.style.backgroundImage = `url("${beer.logoUrl ?? beer.svgLogo}")`;
  el.append(document.createElement('span'), badge);
  el.firstElementChild!.className = 'home-marker-ring';
  return el;
}

function makeFriendMarker(f: FriendMarker): HTMLElement {
  const beer = BEER_MAP.get(f.beerId);
  const el = document.createElement('div');
  el.className = `friend-marker${f.online ? ' online' : ''}`;
  el.style.setProperty('--beer', beer?.color ?? '#a39580');
  el.title = f.name ?? 'Freund';
  const initial = document.createElement('span');
  initial.textContent = (f.name ?? '?').trim().charAt(0).toUpperCase() || '?';
  el.append(initial);
  return el;
}

export const MapView = forwardRef<MapViewHandle, Props>(function MapView(
  { geometry, votes, home, friends, selectedPoint, onMapTap, onViewportChange },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [ready, setReady] = useState(false);
  const tapRef = useRef(onMapTap);
  const viewportRef = useRef(onViewportChange);
  const pulseFrameRef = useRef<number | null>(null);

  useEffect(() => {
    tapRef.current = onMapTap;
    viewportRef.current = onViewportChange;
  }, [onMapTap, onViewportChange]);

  // ── Create map once
  useEffect(() => {
    let cancelled = false;
    let map: MapLibreMap | null = null;
    let hotspotFrame: number | null = null;

    loadMapStyle().then((style) => {
      if (cancelled || !containerRef.current) return;
      const m = new MapLibreMap({
        container: containerRef.current,
        style,
        center: [MUNICH_CENTER.lon, MUNICH_CENTER.lat],
        zoom: 10,
        minZoom: 4.5,
        maxZoom: 18,
        maxPitch: 65,
        attributionControl: { compact: true },
        fadeDuration: 150,
      });
      map = m;
      mapRef.current = m;

      const emitViewport = () => {
        const b = m.getBounds();
        viewportRef.current(
          { south: b.getSouth(), north: b.getNorth(), west: b.getWest(), east: b.getEast() },
          m.getZoom() + 1,
        );
      };

      m.on('load', () => {
        if (cancelled) return;
        loadBeerIcons(m);
        addGameLayers(m);
        // Compact attribution starts collapsed (it is still one tap away)
        containerRef.current?.querySelector('.maplibregl-ctrl-attrib')?.classList.remove('maplibregl-compact-show');
        setReady(true);
        emitViewport();

        // Frontlines breathe: animate hotspot opacity + dash
        if (!REDUCED_MOTION) {
          const start = performance.now();
          const tick = (t: number) => {
            if (!m.getLayer('hotspot-fill')) return;
            const phase = ((t - start) / 1600) % 1;
            const wave = 0.5 - 0.5 * Math.cos(phase * Math.PI * 2);
            m.setPaintProperty('hotspot-fill', 'fill-opacity', 0.08 + wave * 0.16);
            m.setPaintProperty('hotspot-line', 'line-opacity', 0.55 + wave * 0.45);
            hotspotFrame = requestAnimationFrame(tick);
          };
          hotspotFrame = requestAnimationFrame(tick);
        }
      });

      m.on('styleimagemissing', () => loadBeerIcons(m));
      m.on('moveend', emitViewport);
      m.on('click', (e) => tapRef.current(e.lngLat.lat, e.lngLat.lng));
      m.on('mousemove', 'territory-fill', () => { m.getCanvas().style.cursor = 'pointer'; });
      m.on('mouseleave', 'territory-fill', () => { m.getCanvas().style.cursor = ''; });
    });

    return () => {
      cancelled = true;
      if (hotspotFrame !== null) cancelAnimationFrame(hotspotFrame);
      if (pulseFrameRef.current !== null) cancelAnimationFrame(pulseFrameRef.current);
      map?.remove();
      mapRef.current = null;
    };
  }, []);

  // ── Territories, hotspots, labels
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    (map.getSource('territories') as GeoJSONSource).setData(geometry?.territories ?? EMPTY);
    (map.getSource('hotspots') as GeoJSONSource).setData(geometry?.hotspots ?? EMPTY);
    const labels: FeatureCollection<Point> = {
      type: 'FeatureCollection',
      features: (geometry?.labels.features ?? []).map((f) => ({
        ...f,
        properties: { ...f.properties, name: BEER_MAP.get(f.properties.beerId)?.name ?? f.properties.beerId },
      })),
    };
    (map.getSource('region-labels') as GeoJSONSource).setData(labels);
  }, [geometry, ready]);

  // ── Raw votes (demo sandbox)
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    (map.getSource('votes') as GeoJSONSource).setData({
      type: 'FeatureCollection',
      features: votes.map((v) => ({
        type: 'Feature',
        properties: { beerId: v.beerId },
        geometry: { type: 'Point', coordinates: [v.lon, v.lat] },
      })),
    });
  }, [votes, ready]);

  // ── Selected point
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    (map.getSource('selected') as GeoJSONSource).setData(selectedPoint ? {
      type: 'FeatureCollection',
      features: [{ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [selectedPoint.lon, selectedPoint.lat] } }],
    } : EMPTY);
  }, [selectedPoint, ready]);

  // ── Home marker
  const homeKey = home ? `${home.lat},${home.lon},${home.beerId}` : '';
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !home) return;
    const marker = new Marker({ element: makeHomeMarker(home.beerId) })
      .setLngLat([home.lon, home.lat])
      .addTo(map);
    return () => { marker.remove(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on value, not object identity
  }, [homeKey, ready]);

  // ── Friend markers
  const friendsKey = friends.map((f) => `${f.userId}:${f.lat},${f.lon},${f.beerId},${f.online}`).join('|');
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    const markers = friends.map((f) =>
      new Marker({ element: makeFriendMarker(f) }).setLngLat([f.lon, f.lat]).addTo(map),
    );
    return () => markers.forEach((m) => m.remove());
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on value, not object identity
  }, [friendsKey, ready]);

  useImperativeHandle(ref, () => ({
    flyTo(lat, lon, zoom) {
      // Callers speak the legacy zoom scale (one level higher than MapLibre's)
      mapRef.current?.flyTo({
        center: [lon, lat],
        zoom: zoom !== undefined ? zoom - 1 : undefined,
        essential: true,
        duration: REDUCED_MOTION ? 0 : 1400,
      });
    },
    pulseAt(lat, lon, color) {
      const map = mapRef.current;
      if (!map || !map.getSource('pulse')) return;
      if (pulseFrameRef.current !== null) cancelAnimationFrame(pulseFrameRef.current);
      const source = map.getSource('pulse') as GeoJSONSource;
      const start = performance.now();
      const duration = REDUCED_MOTION ? 1 : 1800;
      const maxRadius = Math.min(window.innerWidth, window.innerHeight) * 0.6;
      const frame = (t: number) => {
        const p = Math.min(1, (t - start) / duration);
        const eased = 1 - Math.pow(1 - p, 3);
        const rings = [0, 0.18, 0.36].map((offset) => {
          const q = Math.max(0, Math.min(1, (eased - offset) / (1 - offset)));
          return {
            type: 'Feature' as const,
            properties: { color, radius: 8 + q * maxRadius, opacity: q === 0 ? 0 : 0.55 * (1 - q) },
            geometry: { type: 'Point' as const, coordinates: [lon, lat] },
          };
        });
        source.setData({ type: 'FeatureCollection', features: rings });
        if (p < 1) pulseFrameRef.current = requestAnimationFrame(frame);
        else {
          source.setData(EMPTY);
          pulseFrameRef.current = null;
        }
      };
      pulseFrameRef.current = requestAnimationFrame(frame);
    },
    toggle3d() {
      const map = mapRef.current;
      if (!map) return false;
      const to3d = map.getPitch() < 10;
      map.easeTo({
        pitch: to3d ? 55 : 0,
        bearing: to3d ? -18 : 0,
        zoom: to3d ? Math.max(map.getZoom(), 14.5) : map.getZoom(),
        duration: REDUCED_MOTION ? 0 : 900,
      });
      return to3d;
    },
  }), []);

  return (
    <div className="map-view">
      <div ref={containerRef} className="map-canvas" role="application" aria-label="Territorien-Karte" />
      {!ready && (
        <div className="map-loading" aria-live="polite">
          <span className="spinner" /> Karte lädt…
        </div>
      )}
    </div>
  );
});
