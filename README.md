# Brew Country

**Welches Bier regiert dein Viertel?** Ein Location-Game für München und den DACH-Raum: Spieler checken mit ihrem Bier ein, Stimmen färben die Karte, und Brauereien kämpfen um Territorien.

## Setup & Run

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # Unit-Tests (Vitest)
npm run lint       # ESLint (inkl. React-Compiler-Regeln)
npm run build      # Typecheck + Production-Build
```

iOS (Capacitor): `npm run cap:build && npm run cap:open`

### Demo-Modus

Auf dem Login-Screen startet **„Demo ansehen“** eine lokale Sandbox (IndexedDB, kein Firebase). Im Profil-Tab gibt es dann Demo-Werkzeuge: Stimmen simulieren und per Tipp auf die Karte abstimmen. Der Prost-Check-in nutzt ohne GPS die Kartenmitte. Das ist für Pitches bei Brauereien gedacht.

### Admin

Das Admin-Panel (`#admin`) wird **nur** in Dev-Builds oder mit `VITE_ENABLE_ADMIN=true` eingebaut. Im öffentlichen Production-Bundle ist es nicht enthalten.

## Bedienung

| Aktion | Wie |
|---|---|
| Einchecken | Großer **Prost!**-Button in der Mitte der Tab-Bar → Bier wählen → Prost |
| Gebiet ansehen | Auf die Karte tippen → Territorium-Karte (Sieger, Stimmkraft, Teilen) |
| Wer regiert? | Tab **Entdecken**: Rangliste im Kartenausschnitt + Brennpunkte |
| 3D | Button oben rechts |
| Crew, Quests, Profil | Tabs unten |

## Architektur

```
src/
  domain/      Reine Spiellogik (testbar): Typen, Gewichte, Dominanz, Raster, Regionen, Territorien-Geometrie
  workers/     Web Worker: Dominanz → Glättung → Regionen → GeoJSON-Territorien
  storage/     StorageInterface mit FirestoreStore (live) und IndexedDBStore (Demo)
  services/    Firestore-Zugriffe für Profile, Freunde, Chat, Presence
  auth/        Login, Onboarding, AuthProvider (+ authContext)
  ui/          MapView (MapLibre GL), shell/ (Sheet, TabBar), Panels, kit/ (BeerBadge, Haptics)
  config/      Spielbalance (constants.ts), Firebase, Feature-Flags (env.ts)
```

### Karte

- **MapLibre GL** mit Vektor-Kacheln von OpenFreeMap (ohne API-Key) und eigenem Theme „Nachtbiergarten“, 3D-Gebäude ab Zoom 14.
- Territorien kommen als **geglättete GeoJSON-Polygone** aus dem Worker (Marching Squares über `d3-contour`) und werden GPU-gerendert: Fläche, Glow-Grenze, pulsierende Brennpunkte, Wappen-Labels mit Kollisionsvermeidung.
- Ist der Kachel-Server nicht erreichbar, fällt die Karte auf einen Offline-Stil zurück. Die Territorien werden trotzdem angezeigt.

### Dominanz-Berechnung

- **Globales Raster**: Die Zellen sind an einem festen Gitter verankert (Referenzbreite 48,5°). Territorien springen beim Verschieben der Karte nicht mehr, und Regionen haben stabile IDs.
- Die Zellgröße hängt vom Zoom ab (4 km bis 200 m), höchstens 80.000 Zellen.
- **Vote-zentrierte Rasterung**: Jede Stimme besucht nur die Zellen in ihrem Radius, also O(Stimmen × r²/Zelle²).
- Gewichtete Mehrheit pro Zelle, danach Glättung und Verschmelzen kleiner Inseln. Sieger, Zweiter und Vorsprung bleiben dabei konsistent.
- Worker-Antworten tragen eine Request-ID. Veraltete Ergebnisse werden verworfen.

### Design-System

Tokens und UI-Kit liegen in `src/index.css`:
- Farben (`--c-*`), Typo (`Bricolage Grotesque` + `Inter`), Abstände, Radien, Feder-Animationen
- Klassen `.btn`, `.card`, `.chip`, `.row`, `.empty`, `.segmented`, …

Die Bierfarbe des Spielers (`--c-beer`) färbt Akzente der gesamten Oberfläche. `prefers-reduced-motion` wird respektiert.

## Bekannte Grenzen / nächste Schritte

- **Die Spielregeln werden nur im Client geprüft.** Firestore Security Rules und Cloud Functions (Check-in, Heimposition, Aggregation) sind der nächste Schritt, siehe Roadmap.
- Jeder Client liest noch alle Profile und Stimmen. Serverseitige Aggregation pro Kachel steht aus.
- Die Wappen sind Platzhalter-Monogramme, keine lizenzierten Brauerei-Logos.
