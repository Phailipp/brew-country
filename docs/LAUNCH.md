# Launch-Checkliste

Reihenfolge von oben nach unten. ✅ = im Code erledigt, ☐ = Aufgabe für den Gründer bzw. die Konsole.

## 1. Recht (Blocker)
- ☐ Betreiberdaten in `src/config/legal.ts` eintragen, `configured: true` setzen. Danach verschwindet der Vorlagen-Hinweis.
- ☐ Datenschutzerklärung und Nutzungsbedingungen anwaltlich prüfen lassen. Die Vorlagen beschreiben die tatsächliche Verarbeitung.
- ☐ AV-Vertrag mit Google (Firebase) in der Konsole akzeptieren. Verarbeitungsverzeichnis anlegen und prüfen, ob eine DSFA nötig ist (Standortdaten).
- ☐ Marken-Freigaben der Brauereien einholen. Erst danach `VITE_BRAND_LOGOS=true` in der Pages-Umgebung setzen und `src/assets/logos/SOURCES.md` pflegen.
- ✅ Rechtsseiten sind in der App und ohne Konto erreichbar (`#impressum`, `#datenschutz`, `#nutzungsbedingungen`, `#credits`).
- ✅ Altersprüfung per Geburtsdatum (ohne Speicherung). Mindestalter je Land.
- ✅ Hinweise zu verantwortungsvollem Konsum; höchstens 2 Kneipen pro Tag; alkoholfrei zählt voll.
- ✅ Schriften selbst gehostet, keine Google-Anfragen. Kein Tracking.
- ✅ OSM/ODbL-Attribution sichtbar, Seite „Quellen & Lizenzen“.
- ✅ Datenschutzerklärung (DE/EN) beschreibt die tatsächliche Verarbeitung: Wochen-Pseudonym, 35-Tage-TTL, öffentliche Profilfelder, Online-Status, Crash-Reports (lit. f, 30 Tage), USA-Übermittlung bei der Anmeldung, Widerspruchsrecht, Umfang der Kontolöschung. **Die Fristen stimmen erst, wenn die TTL-Policies (Abschnitt 2) gesetzt sind und die Backup-Aufbewahrung höchstens 30 Tage beträgt.**
- ✅ Spielanleitung „So funktioniert’s“ (`#anleitung`): Link auf Login, im letzten Onboarding-Schritt, im leeren Bierpass und im Profil. Alle Zahlen kommen aus den Spielregeln im Code. Die App-Version steht im Profil.

## 2. Firebase-Projekt (Konsole)
- ☐ Firestore-Region in der EU (z. B. `eur3`). Die Region lässt sich nachträglich nicht ändern. Wenn das Projekt schon in den USA liegt: neues Projekt anlegen.
- ☐ Staging-Projekt `brew-country-staging` anlegen und den ganzen Ablauf dort durchspielen.
- ☐ Budget-Alarme bei 50/90/100 %. API-Key auf die Web-Domain und die iOS-Bundle-ID `com.brewcountry.app` beschränken.
- ☐ Authentication:
  - Autorisierte Domains eintragen (Pages-Domain bzw. eigene Domain).
  - E-Mail-Vorlagen auf Deutsch umstellen.
  - Email-Enumeration-Protection aktivieren und eine Passwort-Richtlinie setzen.
  - Den Telefon-Provider **aus** lassen.
- ☐ App Check aktivieren (Web: reCAPTCHA Enterprise, iOS: App Attest). Zuerst im Monitor-Modus, nach 3–7 Tagen erzwingen.
- ☐ PITR und tägliche Backups, Aufbewahrung **höchstens 30 Tage** (so steht es in der Datenschutzerklärung). TTL-Policies setzen (Pflicht, die Datenschutzerklärung verspricht die Löschung):
  - `bc_venueVisits.expiresAt` (öffentliche Besuche, 35 Tage)
  - `bc_clientErrors.expiresAt` (Crash-Reports, 30 Tage)
  - `bc_drinkVotes.expiresAt` und `bc_otrVotes.expiresAt` (Legacy)
- ☐ Storage nicht aktivieren oder mit deny-all-Regeln betreiben.
- ☐ Service Account mit den Rollen „Firebase Rules Admin“ und „Cloud Datastore Index Admin“ als Repository-Secret `FIREBASE_SERVICE_ACCOUNT` hinterlegen. Dann deployt `deploy.yml` Regeln und Indexe automatisch nach dem Client.

## 3. Web-Rollout
- ☐ Optional eine eigene Domain: `public/CNAME` anlegen, DNS einrichten, „Enforce HTTPS“ aktivieren, `VITE_PUBLIC_URL` in `.env` anpassen, Auth-Domains ergänzen.
- ☐ In `.github/workflows/deploy.yml` `SITE_ONLINE: 'true'` setzen und nach `main` pushen. Der Client geht live, danach folgen die Regeln.
- ☐ Smoke-Test in Produktion:
  - Registrierung und Bestätigungs-Mail
  - Onboarding
  - Kneipen-Check-in
  - Bierpass
  - Freund und Chat
  - Konto löschen
- ☐ 48 Stunden beobachten:
  - `bc_clientErrors`
  - Firestore-Reads, -Writes und -Denies
  - Kosten
  - Overpass-Fehler
- ☐ Branch-Schutz für `main`: Merge nur per PR mit grünen Checks `check` und `e2e`. Der Deploy-Workflow führt die komplette CI (inkl. Regeln, E2E, CSP) ohnehin vor jeder Auslieferung erneut aus.
- **Rollback:**
  - Auf eine gute Version: Actions → „Deploy to GitHub Pages“ → „Run workflow“ mit `ref` = letzter guter Commit oder Tag. Client und Regeln kommen dann aus diesem Stand.
  - Notbremse: `SITE_ONLINE: 'false'` pushen (zeigt die Offline-Seite).

## 4. iOS (App Store)
- ✅ `PrivacyInfo.xcprivacy` ist im Target (Standort, E-Mail, User-ID, Nutzerinhalte, Crash-Daten; kein Tracking).
- ✅ iPhone nur im Hochformat. Neues App-Icon 1024 px ohne Alphakanal.
- ☐ Apple-Developer-Account und Signing einrichten, Build-Nummer pro Upload erhöhen.
- ☐ Age Rating **17+** („Alkohol: häufig“).
- ☐ App-Datenschutz-Labels passend zum Manifest ausfüllen, Datenschutz-URL = `…/#datenschutz`.
- ☐ Review-Notes schreiben:
  - Demo-Zugang („Demo ansehen“)
  - Tageslimit von 2 Kneipen
  - alkoholfrei gleichwertig
  - kein Mengenanreiz
- ☐ TestFlight-Betatest, dann einreichen.

## 5. Nach dem Launch (Roadmap)
- Check-in serverseitig per Cloud Function verifizieren (Kneipen-Koordinate gegen GPS, Impossible Travel), QR-Codes bei Partner-Wirten.
- Aggregierte Revier- und Kneipendaten serverseitig, statt dass jeder Client alle Profile liest.
- Online-Zahl serverseitig zählen, `presence` dann nur für Freunde lesbar (Datenschutz, siehe TEAM.md Runde 3).
- Eigener Overpass-Cache in der EU, bevor viel Traffic kommt.
- Push-Benachrichtigungen („Deine Kneipe kippt gerade“) mit Opt-in.
- Melden- und Blockieren-Funktion für Chat und Spitznamen (DSA, App Store 1.2).
- Brauerei-Cockpit als eigener Zugang mit Rolle `brewery`, Zeitverlauf und CSV-Export.

## Qualitäts-Gates (CI, blockierend)
- Lint, Typecheck (App, Configs, E2E)
- Unit-Tests (Vitest)
- Firestore-Regel-Tests im Emulator
- Build
- E2E (Playwright, Telefon und Desktop, Netzwerk gestubbt), inklusive axe-Accessibility-Checks
