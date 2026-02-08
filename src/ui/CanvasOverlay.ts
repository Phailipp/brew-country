import L from 'leaflet';
import type { CellResult, DominanceResult, OverlaySettings } from '../domain/types';
import { BEER_MAP } from '../domain/beers';
import { metersToDegLat, metersToDegLon } from '../domain/geo';

const DEFAULT_SETTINGS: OverlaySettings = {
  showBorders: true,
  showLogos: true,
  showSwords: true,
  borderWidth: 2.5,
  closeMarginThreshold: 0.10,
  smoothingIterations: 2,
  mergeIslandSize: 8,
};

function createSwordsDataUri(): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
    <g fill="none" stroke="#92400e" stroke-width="2" stroke-linecap="round">
      <line x1="4" y1="4" x2="20" y2="20"/>
      <line x1="20" y1="4" x2="4" y2="20"/>
      <line x1="4" y1="4" x2="7" y2="2.5"/>
      <line x1="4" y1="4" x2="2.5" y2="7"/>
      <line x1="20" y1="4" x2="17" y2="2.5"/>
      <line x1="20" y1="4" x2="21.5" y2="7"/>
    </g>
  </svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/**
 * Custom Leaflet layer that renders dominance data on a canvas.
 *
 * KEY DESIGN: We precompute a vertex grid of pixel coordinates so that
 * neighbouring cells share exactly the same corner vertices. This eliminates
 * gaps between border segments.
 *
 * Vertex grid has (rows+1) × (cols+1) entries. Vertex (r,c) is the
 * TOP-LEFT corner of cell (r,c).
 */
export class DominanceCanvasLayer extends L.Layer {
  private _canvas: HTMLCanvasElement | null = null;
  private _dominanceData: DominanceResult | null = null;
  private _mapRef: L.Map | null = null;
  private _logoImages = new Map<string, HTMLImageElement>();
  private _swordsImg: HTMLImageElement | null = null;
  private _settings: OverlaySettings = { ...DEFAULT_SETTINGS };

  setDominanceData(data: DominanceResult | null) {
    this._dominanceData = data;
    this._preloadLogos();
    this._redraw();
  }

  getDominanceData(): DominanceResult | null {
    return this._dominanceData;
  }

  setSettings(settings: OverlaySettings) {
    this._settings = settings;
    this._redraw();
  }

  getSettings(): OverlaySettings {
    return { ...this._settings };
  }

  private _preloadLogos() {
    for (const [id, beer] of BEER_MAP) {
      if (!this._logoImages.has(id)) {
        const img = new Image();
        img.src = beer.logoUrl ?? beer.svgLogo;
        img.onload = () => this._redraw();
        img.onerror = () => {
          if (beer.logoUrl && img.src !== beer.svgLogo) {
            img.src = beer.svgLogo;
          }
        };
        this._logoImages.set(id, img);
      }
    }
    if (!this._swordsImg) {
      const img = new Image();
      img.src = createSwordsDataUri();
      img.onload = () => this._redraw();
      this._swordsImg = img;
    }
  }

  onAdd(map: L.Map): this {
    this._mapRef = map;
    this._canvas = L.DomUtil.create('canvas', 'dominance-canvas') as HTMLCanvasElement;
    this._canvas.style.position = 'absolute';
    this._canvas.style.pointerEvents = 'none';
    this._canvas.style.zIndex = '250';
    const pane = map.getPane('overlayPane')!;
    pane.appendChild(this._canvas);
    map.on('moveend zoomend resize', this._redraw, this);
    this._preloadLogos();
    this._redraw();
    return this;
  }

  onRemove(map: L.Map): this {
    map.off('moveend zoomend resize', this._redraw, this);
    if (this._canvas && this._canvas.parentNode) {
      this._canvas.parentNode.removeChild(this._canvas);
    }
    this._canvas = null;
    this._mapRef = null;
    return this;
  }

  _redraw = () => {
    if (!this._mapRef || !this._canvas) return;
    const map = this._mapRef;
    const canvas = this._canvas;
    const size = map.getSize();
    canvas.width = size.x;
    canvas.height = size.y;
    const topLeft = map.containerPointToLayerPoint([0, 0]);
    L.DomUtil.setPosition(canvas, topLeft);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, size.x, size.y);

    const data = this._dominanceData;
    if (!data || data.cells.length === 0) return;

    const gs = data.gridSpec;
    const bounds = map.getBounds();
    const settings = this._settings;
    const rows = data.rows;
    const cols = data.cols;
    const cellDLat = metersToDegLat(gs.cellSizeMeters);

    // ── Build winner grid ────────────────────────────────────
    const grid: (string | null)[] = new Array(rows * cols).fill(null);
    const marginArr: Float32Array = new Float32Array(rows * cols).fill(1);
    for (const cell of data.cells) {
      const idx = cell.row * cols + cell.col;
      grid[idx] = cell.winnerBeerId;
      marginArr[idx] = cell.margin;
    }

    // ── Precompute vertex grid (rows+1 × cols+1) ────────────
    // Vertex (vr, vc) = top-left corner of cell (vr, vc).
    // Each vertex is computed exactly ONCE so neighbouring cells
    // share the same pixel coordinates → no gaps.
    const vRows = rows + 1;
    const vCols = cols + 1;
    const vx = new Float32Array(vRows * vCols);
    const vy = new Float32Array(vRows * vCols);

    for (let vr = 0; vr < vRows; vr++) {
      const lat = gs.minLat + vr * cellDLat;
      const dLon = metersToDegLon(gs.cellSizeMeters, lat);
      for (let vc = 0; vc < vCols; vc++) {
        const lon = gs.minLon + vc * dLon;
        const pt = map.latLngToContainerPoint([lat, lon]);
        const vi = vr * vCols + vc;
        vx[vi] = pt.x;
        vy[vi] = pt.y;
      }
    }

    // Helper: get vertex pixel coords
    const vIdx = (vr: number, vc: number) => vr * vCols + vc;

    // Visible row/col range (with 1-cell margin)
    const south = bounds.getSouth();
    const north = bounds.getNorth();
    const west = bounds.getWest();
    const east = bounds.getEast();
    let rMin = Math.max(0, Math.floor((south - gs.minLat) / cellDLat) - 1);
    let rMax = Math.min(rows - 1, Math.ceil((north - gs.minLat) / cellDLat) + 1);
    let cMinDefault = 0;
    let cMaxDefault = cols - 1;
    {
      const midLat = (south + north) / 2;
      const dLon = metersToDegLon(gs.cellSizeMeters, midLat);
      cMinDefault = Math.max(0, Math.floor((west - gs.minLon) / dLon) - 1);
      cMaxDefault = Math.min(cols - 1, Math.ceil((east - gs.minLon) / dLon) + 1);
    }
    // Clamp
    rMin = Math.max(0, rMin);
    rMax = Math.min(rows - 1, rMax);
    cMinDefault = Math.max(0, cMinDefault);
    cMaxDefault = Math.min(cols - 1, cMaxDefault);

    // ── Pass 1: Fill cells ───────────────────────────────────
    for (let r = rMin; r <= rMax; r++) {
      for (let c = cMinDefault; c <= cMaxDefault; c++) {
        const beerId = grid[r * cols + c];
        if (beerId === null) continue;
        const beer = BEER_MAP.get(beerId);
        if (!beer) continue;

        // 4 corners of cell (r,c): TL=(r,c), TR=(r,c+1), BR=(r+1,c+1), BL=(r+1,c)
        // Note: lat increases upward but row 0 = minLat (bottom),
        // and latLngToContainerPoint gives y increasing downward,
        // so row r vertex is at BOTTOM and row r+1 is further south (larger y).
        // Actually: vertex vr corresponds to lat = minLat + vr*cellDLat.
        // Higher vr = higher lat = smaller y (higher on screen).
        // So TL on screen = vertex (r+1, c), TR = (r+1, c+1),
        //    BL = (r, c), BR = (r, c+1).
        const tlIdx = vIdx(r + 1, c);
        const trIdx = vIdx(r + 1, c + 1);
        const brIdx = vIdx(r, c + 1);
        const blIdx = vIdx(r, c);

        ctx.fillStyle = beer.color;
        ctx.globalAlpha = 0.28;
        ctx.beginPath();
        ctx.moveTo(vx[tlIdx], vy[tlIdx]);
        ctx.lineTo(vx[trIdx], vy[trIdx]);
        ctx.lineTo(vx[brIdx], vy[brIdx]);
        ctx.lineTo(vx[blIdx], vy[blIdx]);
        ctx.closePath();
        ctx.fill();
      }
    }

    // ── Pass 2: Borders ──────────────────────────────────────
    // For every interior edge between two cells with different winners,
    // draw a line between the two shared vertices.
    // Because we use the same vertex array, lines are perfectly continuous.
    if (settings.showBorders) {
      ctx.globalAlpha = 0.75;
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = settings.borderWidth;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.beginPath();

      for (let r = rMin; r <= rMax; r++) {
        for (let c = cMinDefault; c <= cMaxDefault; c++) {
          const myBeer = grid[r * cols + c];
          if (myBeer === null) continue;

          // Right edge: between cell (r,c) and (r,c+1)
          if (c + 1 < cols) {
            const rightBeer = grid[r * cols + c + 1];
            if (rightBeer !== myBeer) {
              // Shared edge: vertices (r, c+1) and (r+1, c+1)
              const v0 = vIdx(r, c + 1);
              const v1 = vIdx(r + 1, c + 1);
              ctx.moveTo(vx[v0], vy[v0]);
              ctx.lineTo(vx[v1], vy[v1]);
            }
          } else if (myBeer !== null) {
            // Right grid boundary
            const v0 = vIdx(r, c + 1);
            const v1 = vIdx(r + 1, c + 1);
            ctx.moveTo(vx[v0], vy[v0]);
            ctx.lineTo(vx[v1], vy[v1]);
          }

          // Bottom edge: between cell (r,c) and (r-1,c)
          // (r-1 because row 0 is at minLat = south)
          if (r > 0) {
            const bottomBeer = grid[(r - 1) * cols + c];
            if (bottomBeer !== myBeer) {
              // Shared edge: vertices (r, c) and (r, c+1)
              const v0 = vIdx(r, c);
              const v1 = vIdx(r, c + 1);
              ctx.moveTo(vx[v0], vy[v0]);
              ctx.lineTo(vx[v1], vy[v1]);
            }
          } else if (myBeer !== null) {
            // Bottom grid boundary
            const v0 = vIdx(0, c);
            const v1 = vIdx(0, c + 1);
            ctx.moveTo(vx[v0], vy[v0]);
            ctx.lineTo(vx[v1], vy[v1]);
          }

          // Left edge: between cell (r,c) and (r,c-1)
          if (c > 0) {
            const leftBeer = grid[r * cols + c - 1];
            if (leftBeer === null) {
              // Beer cell borders empty space on the left
              const v0 = vIdx(r, c);
              const v1 = vIdx(r + 1, c);
              ctx.moveTo(vx[v0], vy[v0]);
              ctx.lineTo(vx[v1], vy[v1]);
            }
          } else {
            // Left grid boundary
            const v0 = vIdx(r, 0);
            const v1 = vIdx(r + 1, 0);
            ctx.moveTo(vx[v0], vy[v0]);
            ctx.lineTo(vx[v1], vy[v1]);
          }

          // Top edge: between cell (r,c) and (r+1,c)
          if (r + 1 < rows) {
            const topBeer = grid[(r + 1) * cols + c];
            if (topBeer === null) {
              // Beer cell borders empty space on top
              const v0 = vIdx(r + 1, c);
              const v1 = vIdx(r + 1, c + 1);
              ctx.moveTo(vx[v0], vy[v0]);
              ctx.lineTo(vx[v1], vy[v1]);
            }
          } else {
            // Top grid boundary
            const v0 = vIdx(r + 1, c);
            const v1 = vIdx(r + 1, c + 1);
            ctx.moveTo(vx[v0], vy[v0]);
            ctx.lineTo(vx[v1], vy[v1]);
          }
        }
      }

      ctx.stroke();
    }

    // ── Pass 3: Contested border highlight + swords ─────────
    if (settings.showSwords) {
      const swordsImg = this._swordsImg;
      const thresh = settings.closeMarginThreshold;
      const useSvg = swordsImg && swordsImg.complete && swordsImg.naturalWidth > 0;

      // 3a — Draw a coloured highlight line along all contested edges
      ctx.globalAlpha = 0.6;
      ctx.strokeStyle = '#d97706'; // amber-600
      ctx.lineWidth = Math.max(settings.borderWidth + 2, 4);
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.beginPath();

      // Also collect edges for swords stamping
      const swordEdges: [number, number, number, number][] = [];

      for (let r = rMin; r <= rMax; r++) {
        for (let c = cMinDefault; c <= cMaxDefault; c++) {
          const myBeer = grid[r * cols + c];
          if (myBeer === null) continue;
          const myMargin = marginArr[r * cols + c];

          // Right edge
          if (c + 1 < cols) {
            const rightBeer = grid[r * cols + c + 1];
            if (rightBeer !== null && rightBeer !== myBeer) {
              const nMargin = marginArr[r * cols + c + 1];
              if (myMargin <= thresh || nMargin <= thresh) {
                const v0 = vIdx(r, c + 1);
                const v1 = vIdx(r + 1, c + 1);
                ctx.moveTo(vx[v0], vy[v0]);
                ctx.lineTo(vx[v1], vy[v1]);
                swordEdges.push([vx[v0], vy[v0], vx[v1], vy[v1]]);
              }
            }
          }

          // Bottom edge (between r and r-1)
          if (r > 0) {
            const belowBeer = grid[(r - 1) * cols + c];
            if (belowBeer !== null && belowBeer !== myBeer) {
              const nMargin = marginArr[(r - 1) * cols + c];
              if (myMargin <= thresh || nMargin <= thresh) {
                const v0 = vIdx(r, c);
                const v1 = vIdx(r, c + 1);
                ctx.moveTo(vx[v0], vy[v0]);
                ctx.lineTo(vx[v1], vy[v1]);
                swordEdges.push([vx[v0], vy[v0], vx[v1], vy[v1]]);
              }
            }
          }
        }
      }
      ctx.stroke();

      // 3b — Stamp ⚔ icons along edges that are long enough
      ctx.globalAlpha = 0.85;
      const spacing = 35;
      const iconSize = 18;
      for (const [x0, y0, x1, y1] of swordEdges) {
        if (useSvg) {
          this._stampSwords(ctx, swordsImg!, x0, y0, x1, y1, spacing, iconSize);
        } else {
          this._stampSwordsText(ctx, x0, y0, x1, y1, spacing, iconSize);
        }
      }
    }

    // ── Pass 4: Region logos ─────────────────────────────────
    if (settings.showLogos) {
      ctx.globalAlpha = 1.0;
      this._drawRegionLogos(ctx, data, grid, gs, cellDLat, bounds, map, rows, cols);
    }
    ctx.globalAlpha = 1.0;
  };

  private _stampSwords(
    ctx: CanvasRenderingContext2D,
    img: HTMLImageElement,
    x0: number, y0: number, x1: number, y1: number,
    spacing: number, iconSize: number
  ) {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < spacing * 0.4) return;
    const steps = Math.max(1, Math.round(len / spacing));
    for (let s = 0; s < steps; s++) {
      const t = (s + 0.5) / steps;
      try {
        ctx.drawImage(img, x0 + dx * t - iconSize / 2, y0 + dy * t - iconSize / 2, iconSize, iconSize);
      } catch { /* skip */ }
    }
  }

  /** Fallback: draw ⚔ as canvas text if SVG image didn't load */
  private _stampSwordsText(
    ctx: CanvasRenderingContext2D,
    x0: number, y0: number, x1: number, y1: number,
    spacing: number, iconSize: number
  ) {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < spacing * 0.4) return;
    const steps = Math.max(1, Math.round(len / spacing));
    ctx.save();
    ctx.font = `${iconSize}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#92400e';
    for (let s = 0; s < steps; s++) {
      const t = (s + 0.5) / steps;
      ctx.fillText('⚔', x0 + dx * t, y0 + dy * t);
    }
    ctx.restore();
  }

  private _drawRegionLogos(
    ctx: CanvasRenderingContext2D,
    _data: DominanceResult,
    grid: (string | null)[],
    gs: DominanceResult['gridSpec'],
    cellDLat: number,
    bounds: L.LatLngBounds,
    map: L.Map,
    rows: number,
    cols: number
  ) {
    const visited = new Uint8Array(rows * cols);
    const regions: { beerId: string; sumRow: number; sumCol: number; count: number }[] = [];

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const idx = r * cols + c;
        if (visited[idx]) continue;
        const beerId = grid[idx];
        if (beerId === null) { visited[idx] = 1; continue; }

        const region = { beerId, sumRow: 0, sumCol: 0, count: 0 };
        const queue: number[] = [idx];
        visited[idx] = 1;

        while (queue.length > 0) {
          const ci = queue.pop()!;
          const cr = (ci / cols) | 0;
          const cc = ci % cols;
          region.sumRow += cr;
          region.sumCol += cc;
          region.count++;

          const neighbors = [
            cr > 0 ? (cr - 1) * cols + cc : -1,
            cr < rows - 1 ? (cr + 1) * cols + cc : -1,
            cc > 0 ? cr * cols + (cc - 1) : -1,
            cc < cols - 1 ? cr * cols + (cc + 1) : -1,
          ];
          for (const ni of neighbors) {
            if (ni < 0 || visited[ni]) continue;
            if (grid[ni] !== beerId) continue;
            visited[ni] = 1;
            queue.push(ni);
          }
        }
        regions.push(region);
      }
    }

    const minRegionSize = 4;
    for (const region of regions) {
      if (region.count < minRegionSize) continue;
      const avgRow = region.sumRow / region.count;
      const avgCol = region.sumCol / region.count;
      const lat = gs.minLat + (avgRow + 0.5) * cellDLat;
      const dLon = metersToDegLon(gs.cellSizeMeters, lat);
      const lon = gs.minLon + (avgCol + 0.5) * dLon;
      if (!bounds.contains([lat, lon])) continue;
      const pt = map.latLngToContainerPoint([lat, lon]);
      const scale = Math.min(2.5, Math.max(1, Math.sqrt(region.count) / 6));
      const logoSize = Math.round(36 * scale);
      const img = this._logoImages.get(region.beerId);
      if (img && img.complete && img.naturalWidth > 0) {
        ctx.globalAlpha = 0.9;
        try {
          ctx.drawImage(img, pt.x - logoSize / 2, pt.y - logoSize / 2, logoSize, logoSize);
        } catch { /* skip */ }
      }
    }
    ctx.globalAlpha = 1.0;
  }
}

/**
 * Find the cell at a given lat/lon position.
 */
export function findCellAt(
  lat: number,
  lon: number,
  data: DominanceResult | null
): CellResult | null {
  if (!data) return null;
  const gs = data.gridSpec;
  const cellDLat = metersToDegLat(gs.cellSizeMeters);
  const row = Math.floor((lat - gs.minLat) / cellDLat);
  if (row < 0 || row >= data.rows) return null;
  const cellLat = gs.minLat + (row + 0.5) * cellDLat;
  const cellDLon = metersToDegLon(gs.cellSizeMeters, cellLat);
  const col = Math.floor((lon - gs.minLon) / cellDLon);
  if (col < 0 || col >= data.cols) return null;
  const idx = row * data.cols + col;
  if (idx >= 0 && idx < data.cells.length) {
    const c = data.cells[idx];
    if (c.row === row && c.col === col) return c;
  }
  return data.cells.find((c) => c.row === row && c.col === col) ?? null;
}
