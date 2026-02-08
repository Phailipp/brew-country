import { useEffect, useRef, useCallback, useImperativeHandle, forwardRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Vote, DominanceResult, GridSpec, OverlaySettings, ViewportBounds, Region } from '../domain/types';
import { BEER_MAP } from '../domain/beers';
import { DACH_CENTER, getDefaultBoundingBox } from '../domain/geo';
import { DominanceCanvasLayer, findCellAt } from './CanvasOverlay';
import { findRegionForCell } from '../domain/regions';
import { appEvents } from '../domain/events';
import './MapView.css';

// Fix default Leaflet marker icon
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

export interface MapViewHandle {
  flyTo: (lat: number, lon: number, zoom: number) => void;
}

export interface FriendLocation {
  userId: string;
  lat: number;
  lon: number;
  beerId: string;
  online: boolean;
}

interface Props {
  votes: Vote[];
  dominanceData: DominanceResult | null;
  regions: Region[];
  gridSpec: GridSpec;
  userVotePosition: { lat: number; lon: number } | null;
  onMapClick: (lat: number, lon: number) => void;
  overlaySettings: OverlaySettings;
  onViewportChange?: (bounds: ViewportBounds, zoom: number) => void;
  onShareRegion?: (region: Region) => void;
  friendLocations?: FriendLocation[];
}

export const MapView = forwardRef<MapViewHandle, Props>(function MapView(
  { votes, dominanceData, regions, gridSpec, userVotePosition, onMapClick, overlaySettings, onViewportChange, onShareRegion, friendLocations },
  ref
) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const canvasLayerRef = useRef<DominanceCanvasLayer | null>(null);
  const voteMarkersRef = useRef<L.LayerGroup | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const friendMarkersRef = useRef<L.LayerGroup | null>(null);
  const hoverDivRef = useRef<HTMLDivElement | null>(null);
  const clickPopupRef = useRef<L.Popup | null>(null);
  const dominanceDataRef = useRef<DominanceResult | null>(null);
  const regionsRef = useRef<Region[]>([]);
  const settingsRef = useRef<OverlaySettings>(overlaySettings);
  const onShareRegionRef = useRef(onShareRegion);
  const onViewportChangeRef = useRef(onViewportChange);
  const userVotePositionRef = useRef(userVotePosition);

  // Keep mutable refs for event handlers
  dominanceDataRef.current = dominanceData;
  regionsRef.current = regions;
  settingsRef.current = overlaySettings;
  onShareRegionRef.current = onShareRegion;
  onViewportChangeRef.current = onViewportChange;
  userVotePositionRef.current = userVotePosition;

  // Expose flyTo via ref
  useImperativeHandle(ref, () => ({
    flyTo: (lat: number, lon: number, zoom: number) => {
      mapRef.current?.flyTo([lat, lon], zoom, { duration: 0.8 });
    },
  }), []);

  // Emit viewport changes (bounds + zoom)
  const emitViewport = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    const cb = onViewportChangeRef.current;
    if (!cb) return;
    const b = map.getBounds();
    cb(
      {
        south: b.getSouth(),
        north: b.getNorth(),
        west: b.getWest(),
        east: b.getEast(),
      },
      map.getZoom(),
    );
  }, []);

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [DACH_CENTER.lat, DACH_CENTER.lon],
      zoom: 6,
      zoomControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 18,
    }).addTo(map);

    // Bounding box outline
    const bb = getDefaultBoundingBox();
    L.rectangle(
      [[bb.minLat, bb.minLon], [bb.maxLat, bb.maxLon]],
      {
        color: '#94a3b8',
        weight: 1,
        fill: false,
        dashArray: '4, 6',
        interactive: false,
      }
    ).addTo(map);

    // Canvas overlay
    const canvasLayer = new DominanceCanvasLayer();
    canvasLayer.addTo(map);
    canvasLayerRef.current = canvasLayer;

    // Vote markers layer
    const voteMarkers = L.layerGroup().addTo(map);
    voteMarkersRef.current = voteMarkers;

    // Friend markers layer (above vote markers)
    const friendMarkers = L.layerGroup().addTo(map);
    friendMarkersRef.current = friendMarkers;

    // Hover tooltip as a plain DOM div (avoids Leaflet popup conflicts)
    const hoverDiv = document.createElement('div');
    hoverDiv.className = 'hover-tooltip-div';
    hoverDiv.style.display = 'none';
    mapContainerRef.current!.appendChild(hoverDiv);
    hoverDivRef.current = hoverDiv;

    // Click popup (stays in place, has share button)
    clickPopupRef.current = L.popup({
      closeButton: true,
      autoPan: true,
      className: 'click-popup',
      offset: [0, -5],
      maxWidth: 260,
    });

    // Home button control — wrapped in leaflet-bar for consistent styling
    const HomeControl = L.Control.extend({
      options: { position: 'topleft' as L.ControlPosition },
      onAdd() {
        const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
        const btn = L.DomUtil.create('a', 'leaflet-home-btn', container) as HTMLAnchorElement;
        btn.href = '#';
        btn.innerHTML = '🏠';
        btn.title = 'Zum Home Vote';
        btn.setAttribute('role', 'button');
        btn.setAttribute('aria-label', 'Zum Home Vote');
        L.DomEvent.disableClickPropagation(container);
        L.DomEvent.on(btn, 'click', (e) => {
          L.DomEvent.preventDefault(e);
          const pos = userVotePositionRef.current;
          if (pos) {
            map.flyTo([pos.lat, pos.lon], 12, { duration: 0.8 });
          }
        });
        return container;
      },
    });
    new HomeControl().addTo(map);

    mapRef.current = map;

    // Emit initial viewport
    setTimeout(() => emitViewport(), 100);

    // Emit on map moves
    map.on('moveend zoomend', emitViewport);

    return () => {
      map.off('moveend zoomend', emitViewport);
      if (hoverDiv.parentNode) hoverDiv.parentNode.removeChild(hoverDiv);
      map.remove();
      mapRef.current = null;
    };
  }, [emitViewport]);

  // Handle map click — open click popup with share button + emit event
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const handler = (e: L.LeafletMouseEvent) => {
      onMapClick(e.latlng.lat, e.latlng.lng);

      // Close hover tooltip when clicking
      const hoverDiv = hoverDivRef.current;
      if (hoverDiv) hoverDiv.style.display = 'none';

      // Emit region:clicked event and open click popup
      const data = dominanceDataRef.current;
      if (data) {
        const cell = findCellAt(e.latlng.lat, e.latlng.lng, data);
        if (cell && cell.totalCount > 0) {
          const region = findRegionForCell(cell.row, cell.col, regionsRef.current, data);
          if (region) {
            appEvents.emit({ type: 'region:clicked', region, cell });

            // Build click popup content
            const beer = BEER_MAP.get(region.beerId);
            const beerName = beer?.name ?? region.beerId;
            const marginPct = Math.round(region.avgMargin * 100);

            const popupContent = `
              <div class="click-popup-content">
                <div class="click-popup-title">
                  <span class="click-popup-dot" style="background:${beer?.color ?? '#888'}"></span>
                  ${beerName}
                </div>
                <div class="click-popup-stats">
                  ${region.cellCount} Zellen &middot; ${region.totalVotes} Votes &middot; ${marginPct}% Vorsprung
                </div>
                <button class="click-popup-share-btn" data-region-id="${region.id}">
                  &#x1F4E4; Region teilen
                </button>
              </div>`;

            const popup = clickPopupRef.current;
            if (popup) {
              popup
                .setLatLng(e.latlng)
                .setContent(popupContent)
                .openOn(map);

              // Attach share button handler after DOM paint
              requestAnimationFrame(() => {
                const btn = document.querySelector('.click-popup-share-btn') as HTMLElement | null;
                if (btn) {
                  btn.onclick = (ev) => {
                    ev.stopPropagation();
                    onShareRegionRef.current?.(region);
                    map.closePopup(popup);
                  };
                }
              });
            }
          }
        }
      }
    };

    map.on('click', handler);
    return () => { map.off('click', handler); };
  }, [onMapClick]);

  // Handle mousemove for hover tooltip + emit region:hovered
  useEffect(() => {
    const map = mapRef.current;
    const hoverDiv = hoverDivRef.current;
    if (!map || !hoverDiv) return;

    let lastRow = -1;
    let lastCol = -1;
    let lastHoveredRegionId = '';

    const onMouseMove = (e: L.LeafletMouseEvent) => {
      // Don't show hover tooltip while click popup is open
      const clickPopup = clickPopupRef.current;
      if (clickPopup && map.hasLayer(clickPopup)) {
        hoverDiv.style.display = 'none';
        return;
      }

      const data = dominanceDataRef.current;
      if (!data) {
        hoverDiv.style.display = 'none';
        return;
      }

      const cell = findCellAt(e.latlng.lat, e.latlng.lng, data);

      if (!cell || cell.totalCount === 0) {
        hoverDiv.style.display = 'none';
        lastRow = -1;
        lastCol = -1;
        lastHoveredRegionId = '';
        return;
      }

      // Emit region:hovered (throttled by region change)
      const region = findRegionForCell(cell.row, cell.col, regionsRef.current, data);
      if (region && region.id !== lastHoveredRegionId) {
        lastHoveredRegionId = region.id;
        appEvents.emit({ type: 'region:hovered', region, cell });
      }

      // Position the div at mouse container point
      const containerPt = map.latLngToContainerPoint(e.latlng);
      hoverDiv.style.left = `${containerPt.x + 12}px`;
      hoverDiv.style.top = `${containerPt.y - 12}px`;
      hoverDiv.style.display = 'block';

      // Don't rebuild content if still on the same cell
      if (cell.row === lastRow && cell.col === lastCol) {
        return;
      }

      lastRow = cell.row;
      lastCol = cell.col;

      // Build vote breakdown sorted by count desc
      const entries = Object.entries(cell.voteCounts)
        .sort((a, b) => b[1] - a[1]);

      let breakdownHtml = '';
      for (const [beerId, count] of entries) {
        const beer = BEER_MAP.get(beerId);
        if (!beer) continue;
        const pct = Math.round((count / cell.totalCount) * 100);
        const isWinner = beerId === cell.winnerBeerId;
        breakdownHtml += `
          <div class="tooltip-row${isWinner ? ' winner' : ''}">
            <span class="tooltip-dot" style="background:${beer.color}"></span>
            <span class="tooltip-name">${beer.name}</span>
            <span class="tooltip-count">${count}</span>
            <span class="tooltip-pct">${pct}%</span>
          </div>`;
      }

      // Close-call info
      const settings = settingsRef.current;
      let closeCallHtml = '';
      if (settings.showSwords && cell.margin <= settings.closeMarginThreshold && cell.runnerUpBeerId) {
        const runnerBeer = BEER_MAP.get(cell.runnerUpBeerId);
        const marginPct = Math.round(cell.margin * 100);
        closeCallHtml = `
          <div class="tooltip-close-call">
            &#x2694; Knapp! Vorsprung nur ${marginPct}%${runnerBeer ? ` vor ${runnerBeer.name}` : ''}
          </div>`;
      }

      hoverDiv.innerHTML = `
        <div class="cell-tooltip">
          <div class="tooltip-header">Votes gesamt: <strong>${cell.totalCount}</strong></div>
          <div class="tooltip-breakdown">${breakdownHtml}</div>
          ${closeCallHtml}
        </div>`;
    };

    const onMouseOut = () => {
      hoverDiv.style.display = 'none';
      lastRow = -1;
      lastCol = -1;
      lastHoveredRegionId = '';
    };

    map.on('mousemove', onMouseMove);
    map.on('mouseout', onMouseOut);

    return () => {
      map.off('mousemove', onMouseMove);
      map.off('mouseout', onMouseOut);
    };
  }, []);

  // Update canvas overlay data
  useEffect(() => {
    canvasLayerRef.current?.setDominanceData(dominanceData);
  }, [dominanceData]);

  // Update canvas overlay settings
  useEffect(() => {
    canvasLayerRef.current?.setSettings(overlaySettings);
  }, [overlaySettings]);

  // Update vote markers
  useEffect(() => {
    const group = voteMarkersRef.current;
    if (!group) return;
    group.clearLayers();

    votes.forEach((vote) => {
      const beer = BEER_MAP.get(vote.beerId);
      if (!beer) return;

      const icon = L.divIcon({
        className: 'vote-marker',
        html: `<div style="background:${beer.color};width:6px;height:6px;border-radius:50%;border:1px solid rgba(255,255,255,0.6);box-shadow:0 1px 2px rgba(0,0,0,0.2);"></div>`,
        iconSize: [8, 8],
        iconAnchor: [4, 4],
      });

      L.marker([vote.lat, vote.lon], { icon, interactive: false }).addTo(group);
    });
  }, [votes]);

  // Update user position marker
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (userMarkerRef.current) {
      map.removeLayer(userMarkerRef.current);
      userMarkerRef.current = null;
    }

    if (userVotePosition) {
      const marker = L.marker([userVotePosition.lat, userVotePosition.lon], {
        draggable: true,
        zIndexOffset: 1000,
      });

      marker.on('dragend', () => {
        const pos = marker.getLatLng();
        onMapClick(pos.lat, pos.lng);
      });

      marker.bindTooltip('Dein Vote (ziehbar)', { direction: 'top', offset: [0, -20] });
      marker.addTo(map);
      userMarkerRef.current = marker;
    }
  }, [userVotePosition, onMapClick]);

  // Update friend location markers
  useEffect(() => {
    const group = friendMarkersRef.current;
    if (!group) return;
    group.clearLayers();

    if (!friendLocations || friendLocations.length === 0) return;

    friendLocations.forEach((friend) => {
      const beer = BEER_MAP.get(friend.beerId);
      if (!beer) return;

      const onlineDot = friend.online
        ? '<span class="friend-marker-online"></span>'
        : '<span class="friend-marker-offline"></span>';

      const icon = L.divIcon({
        className: 'friend-map-marker',
        html: `
          <div class="friend-marker-inner" style="border-color: ${beer.color}">
            <img src="${beer.svgLogo}" alt="${beer.name}" class="friend-marker-logo" />
            ${onlineDot}
          </div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      const marker = L.marker([friend.lat, friend.lon], {
        icon,
        zIndexOffset: 500,
        interactive: true,
      });

      const statusText = friend.online ? '🟢 Online' : '⚫ Offline';
      marker.bindTooltip(
        `<strong>${beer.name}</strong><br/>${statusText}`,
        { direction: 'top', offset: [0, -16], className: 'friend-marker-tooltip' }
      );

      marker.addTo(group);
    });
  }, [friendLocations]);

  // Suppress unused gridSpec lint
  void gridSpec;

  return <div ref={mapContainerRef} className="map-container" />;
});
