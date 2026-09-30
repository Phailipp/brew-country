# Brew Country: Team, Zielgruppe, Release-Entscheidungen

Dieses Dokument hält fest, wie das Team denkt und entscheidet. Jede größere Änderung wird aus allen sechs Perspektiven geprüft, bevor sie gebaut wird.

## Das Team (Personas)

| Persona | Rolle | Fragt immer |
|---|---|---|
| **Lena** | Product Owner | Versteht das ein neuer Spieler in 60 Sekunden? Zahlt eine Brauerei dafür? |
| **Marco** | Frontend-Architekt | Bricht das bei 10.000 Nutzern, schlechtem Netz oder altem iPhone? |
| **Aylin** | Security & Datenschutz | Kann man damit jemanden verfolgen? Ist das DSGVO- und jugendschutzkonform? |
| **Jonas** | QA Lead | Wie testen wir das automatisch, auch den Fehlerfall? |
| **Sophie** | UX, Accessibility & i18n | Geht das mit Daumen, Screenreader, 200 % Schrift und auf Englisch? |
| **Tim** | Release & DevOps | Kann man es sicher ausrollen, überwachen und zurückrollen? |

## Zielgruppen

| Persona | Will | Frust | Muss in 60 Sekunden sehen |
|---|---|---|---|
| **Stammtisch-Crew (25–40)** | „Unsere Kneipe gehört uns“, Gesprächsstoff für die Gruppe | Registrierung, leere Karte, unklare Regeln | eigene Stammkneipe, wer sie regiert, was zur Übernahme fehlt |
| **Studenten & Craft-Fans** | sammeln, entdecken, angeben | eigenes Bier fehlt | Bierpass, Bierdeckel, neue Kneipen in der Nähe |
| **Touristen** | lokales Bier finden | Deutsch-only, „Zuhause“-Pflicht | Kneipen um sie herum, auf Englisch |
| **Brauerei / Wirt (Kunde)** | Share of Voice, verlorene Kneipen, messbare Aktionen | Spielzeug-Anmutung, keine belastbaren Zahlen | Cockpit mit echten Daten der eigenen Stadt |

## Diskussion und Entscheidungen

**1. Ein Spielmodell statt zwei**
- *Lena:* Heimstimme, Drink-Vote (24 h), OTR-Flaggen und Duelle neben dem Kneipenmodell (30 Tage) verwirren.
- *Aylin:* Die Legacy-Daten (`bc_drinkVotes` mit uid und Position) sind das größte Datenschutzrisiko.
- *Marco:* Die Heimstimmen füllen aber die Stadtansicht, wo Kneipen erst ab Viertel-Zoom laden.

**Entscheidung:**
- Das Kneipenmodell ist der Kern.
- Duelle, OTR-Flaggen, Teams, Heim-Boost-Details und die alten Quests verschwinden aus der Oberfläche (Feature-Flag `VITE_LEGACY_FEATURES`).
- Das eigene Revier bleibt als grobe Heimat-Farbe für die Stadtansicht.
- Der Prost-Button führt zuerst zur Kneipe. Die Umgebungs-Stimme bleibt nur als Fallback „Keine Kneipe hier“.

**2. Verantwortungsvoller Konsum**
- *Aylin:* Jugendmedienschutz-Staatsvertrag und Werberat verbieten Anreize zu übermäßigem Konsum.
- *Lena:* Die Kneipentour ist Kultur, aber Menge darf nie belohnt werden.

**Entscheidung:**
- Höchstens **2 Kneipen pro Tag**.
- Alkoholfrei zählt voll.
- Wochen-Challenges belohnen verschiedene Tage und Kneipen, nicht Menge.
- Überall steht der Hinweis „Trink verantwortungsvoll“ mit Link.
- Die Altersabfrage erfolgt per Geburtsdatum, mit Mindestalter 18 bzw. 21 in den USA.

**3. Pseudonyme Besuche**
- *Aylin:* `sha256(uid|kneipe)` ist umkehrbar, weil die uids öffentlich sind.

**Entscheidung:** Pro Spieler gibt es ein geheimes Zufalls-Salz im privaten Profil. Die Regeln prüfen den Hash gegen dieses Salz. Damit lassen sich Besuche weder einer uid zuordnen noch über Kneipen hinweg verknüpfen.

**4. Recht**
- *Aylin und Tim:* Impressum, Datenschutzerklärung, OSM-Attribution, selbst gehostete Schriften und Marken-Freigaben sind Launch-Blocker.

**Entscheidung:**
- Rechtsseiten kommen als Vorlage in die App. Die Inhalte (Betreiberdaten) liefert der Gründer.
- Brauerei-Logos sind hinter `VITE_BRAND_LOGOS` versteckt, bis Freigaben vorliegen.
- Google Fonts werden durch selbst gehostete Schriften ersetzt.
- Der russische Overpass-Mirror fliegt raus.

**5. Sprache**
- *Sophie:* etwa 450 UI-Strings.
- *Lena:* Launch in München, danach weltweit.

**Entscheidung:** Deutsch und Englisch mit schlanker eigener i18n (`t()`, `Intl`). Die Sprache kommt aus dem Browser und lässt sich im Profil umstellen.

**6. Qualität**
- *Jonas:* Ohne E2E-Tests kein Release.

**Entscheidung:**
- Jede Nutzerreise bekommt einen Playwright-Test im Demo-Modus, für Telefon und Desktop, ohne Internet.
- axe-Checks ohne ernste Verstöße.
- Die CI blockiert bei Rot.

## Release-Plan

**Phase A: Blocker im Code**

- [x] E2E-Suite plus CI
- [x] Sheet- und Tab-Leiste-Accessibility
- [ ] Rechtsseiten, Altersabfrage per Geburtsdatum, Konsum-Hinweise, 2 Kneipen pro Tag
- [ ] Salz-basierte Pseudonyme
- [ ] Legacy-Features hinter Flag, Prost führt zur Kneipe
- [ ] Schriften selbst hosten, OSM-Attribution, Mirror bereinigen, Logos hinter Flag
- [ ] Robustheit: Error Boundary, Worker-Fehler, Listener-Fehler, Overpass-Timeouts, Konto löschen vollständig
- [ ] Englisch

**Phase B: Rollout-Reife**

- [ ] PWA-Manifest und Icons, OG-Meta
- [ ] iOS-Privacy-Manifest, nur Hochformat
- [ ] So-funktioniert's-Anleitung
- [ ] Fehler-Senke
- [ ] Versionsanzeige

**Phase C: Gründer-Aufgaben (nicht im Code lösbar)**

- Impressum- und DSE-Inhalte liefern
- Firebase: EU-Region, App Check, Budget-Alarme, Backups, Auth-Domains
- Marken-Freigaben der Brauereien
- Domain und Apple-Developer-Account

Siehe `docs/LAUNCH.md`.
