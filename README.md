# Brew Country - Bier-Dominanz-Karte

Interaktive Karte, die zeigt welche Biersorte in welchem Gebiet rund um München dominiert - basierend auf User-Votes.

## Setup & Run

```bash
npm install
npm run dev
```

Dann im Browser `http://localhost:5173` öffnen.

## Bedienung

- **Bier auswählen**: In der Sidebar rechts eine Biersorte anklicken
- **Vote setzen**: Auf die Karte klicken setzt deinen Vote (1 Vote pro User)
- **Vote verschieben**: Den Marker auf der Karte ziehen
- **Zell-Info**: Ctrl+Klick (Mac: Cmd+Klick) auf eine eingefärbte Zelle zeigt Dominanz-Details
- **Simulation**: Im Simulation-Panel unten in der Sidebar Random-Votes erzeugen
- **Sidebar**: Über den Toggle-Button oben rechts ein-/ausblenden

## Architektur

```
src/
  domain/       - Types, Beer-Katalog, Geo-Utils, Dominanz-Algorithmus
  storage/      - VoteStore Abstraktion (localStorage-Implementierung)
  workers/      - Web Worker für Dominanzberechnung
  ui/           - React-Komponenten (Map, BeerPicker, Legend, SimulationPanel)
```

### Dominanz-Berechnung

- 100x100 km Bounding Box um München, Rasterabstand 500m (~40.000 Zellen)
- Jeder Vote wirkt in 20 km Radius (Haversine-Distanz)
- Pro Zelle: Mehrheitsentscheid, Tie-Break über neuesten Timestamp
- Berechnung läuft in einem Web Worker (UI bleibt responsiv)
- Bounding-Box-Prefilter vor Haversine-Berechnung zur Optimierung

### Visualisierung

- Canvas Overlay Layer (nicht 40k DOM-Elemente)
- Nur sichtbare Zellen werden gerendert
- Bei höherem Zoom-Level: kleine Beer-Logos auf der Karte

## Performance / Bekannte Limits

- ~40.000 Zellen x N Votes: Bei <500 Votes ist naive O(cells x votes) schnell genug
- Bei >500 Votes kann die Worker-Berechnung merklich dauern (Sekunden) - "Berechne..." Badge wird angezeigt
- Canvas Overlay rendert nur sichtbare Zellen - Panning/Zoomen ist performant
- Beer-Logo Marker erscheinen erst ab Zoom-Level 11+, mit adaptiver Dichte

## Assumptions

- 1 Vote pro User (identifiziert via localStorage userId)
- Simulations-Votes haben eigene IDs und gelten als separate User
- Rasterabstand uniform 500m; longitude-Anpassung per cos(lat) der jeweiligen Zeile
- SVG-Logos sind einfache Placeholder (farbiger Kreis + Text), keine echten Markenlogos
- Persistenz via localStorage (max ~5MB je nach Browser)
