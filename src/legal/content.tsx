import type { ReactNode } from 'react';
import { OPERATOR, RESPONSIBLE_DRINKING_URL } from '../config/legal';

import type { LegalDoc } from './docs';
import { useLocale, type Locale } from '../i18n';

const A = ({ href, children }: { href: string; children: ReactNode }) => (
  <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>
);

function Impressum() {
  return (
    <>
      <h2>Angaben gemäß § 5 DDG</h2>
      <p>{OPERATOR.name}<br />{OPERATOR.address}</p>
      <h2>Kontakt</h2>
      <p>E-Mail: {OPERATOR.email}</p>
      {OPERATOR.vatId && <p>{OPERATOR.vatId}</p>}
      <h2>Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV</h2>
      <p>{OPERATOR.responsible}</p>
      <h2>Keine Verbindung zu Brauereien</h2>
      <p>
        Brew Country ist ein unabhängiges Spiel. Die genannten Biermarken gehören ihren Inhabern. Eine Nennung
        bedeutet keine Partnerschaft oder Empfehlung, sofern nicht ausdrücklich angegeben.
      </p>
      <h2>Verbraucherstreitbeilegung</h2>
      <p>Wir sind nicht bereit und nicht verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.</p>
    </>
  );
}

function Datenschutz() {
  return (
    <>
      <p>
        Wir verarbeiten so wenige Daten wie möglich. Es gibt kein Tracking, keine Werbung und keine Analyse-Tools.
      </p>

      <h2>1. Verantwortlicher</h2>
      <p>{OPERATOR.name}, {OPERATOR.address}, {OPERATOR.email}</p>

      <h2>2. Welche Daten wir verarbeiten</h2>
      <ul>
        <li><strong>Konto:</strong> E-Mail-Adresse, Spitzname, Passwort (nur als Hash beim Anmeldedienst).</li>
        <li>
          <strong>Profil:</strong> Lieblingsbier und Heimatort. Der genaue Heimatort ist nur für dich sichtbar.
          Für andere Spieler sichtbar sind: deine Nutzer-Kennung, Lieblingsbier, Heimatort auf ca. 2 km gerundet,
          Beitrittsdatum, letzter Aktivitätszeitpunkt und eine Spieleinstellung zum Heimat-Radius.
        </li>
        <li>
          <strong>Kneipenbesuche:</strong> Dein Bierpass (Kneipe, Bier, Zeitpunkt, alkoholfrei ja/nein) ist privat.
          Für die Spielwertung wird jeder Besuch zusätzlich <em>ohne Namen oder Konto-Kennung</em> gespeichert:
          mit einem Pseudonym und mit auf die Stunde gerundeter Zeit. Das Pseudonym wird aus einem geheimen
          Zufallswert gebildet, den nur dein Konto lesen kann, und wechselt pro Kneipe und Woche. Mehrere Besuche
          derselben Person in derselben Kneipe und Woche lassen sich daher einander zuordnen, Besuche in anderen
          Kneipen oder Wochen nicht. Wer dich persönlich kennt, könnte aus Ort und Zeit trotzdem auf dich schließen;
          deshalb speichern wir so wenig wie möglich und löschen diese Einträge nach 35 Tagen.
        </li>
        <li><strong>Standort:</strong> nur in dem Moment, in dem du ihn freigibst (Onboarding, Check-in), um zu prüfen, dass du vor Ort bist. Wir orten dich nicht im Hintergrund.</li>
        <li><strong>Freunde & Chat:</strong> Freundschaften und Nachrichten, sichtbar nur für die beteiligten Personen. Deine Freunde sehen außerdem, wann du zuletzt in der App aktiv warst (Online-Status).</li>
        <li><strong>Biergemeinschaften:</strong> Wenn du einer Biergemeinschaft beitrittst (sofern die Funktion angeboten wird), sehen andere Spieler ihre Mitgliederliste.</li>
        <li><strong>Absturzberichte:</strong> Stürzt die App ab, speichern wir Fehlermeldung, technischen Fehlerverlauf, App-Version und Browser-Kennung, ohne Konto-Kennung. So finden und beheben wir Fehler.</li>
        <li><strong>Bier-Vorschläge:</strong> Name, Brauerei, Ort, Land, optional Website und Notiz.</li>
        <li><strong>Auf deinem Gerät:</strong> Anmeldestatus, Einstellungen und ein Zwischenspeicher für Kneipendaten (technisch notwendig, § 25 Abs. 2 TDDDG).</li>
      </ul>
      <p>Dein Geburtsdatum wird nur geprüft und nicht gespeichert.</p>

      <h2>3. Zwecke und Rechtsgrundlagen</h2>
      <ul>
        <li>Bereitstellung des Spiels (Art. 6 Abs. 1 lit. b DSGVO).</li>
        <li>Standortprüfung beim Check-in auf Grundlage deiner Einwilligung (Art. 6 Abs. 1 lit. a DSGVO), die du jederzeit in den Geräteeinstellungen widerrufen kannst.</li>
        <li>Schutz vor Missbrauch und Betrug (Art. 6 Abs. 1 lit. f DSGVO).</li>
        <li>Absturzberichte zur Fehlerbehebung und Stabilität der App (Art. 6 Abs. 1 lit. f DSGVO). Du kannst jederzeit widersprechen.</li>
      </ul>

      <h2>4. Empfänger und Dienste</h2>
      <ul>
        <li><strong>Google Firebase</strong> (Google Ireland Ltd.): Anmeldung und Datenbank. Speicherort: {OPERATOR.dataRegion}. Auftragsverarbeitungsvertrag nach Art. 28 DSGVO.</li>
        <li><strong>OpenFreeMap</strong>: Kartenkacheln. Dabei wird deine IP-Adresse übertragen.</li>
        <li><strong>Overpass API</strong> (overpass-api.de, overpass.kumi.systems): Kneipendaten aus OpenStreetMap für den sichtbaren Kartenausschnitt. Dabei werden IP-Adresse und Kartenausschnitt übertragen.</li>
        <li><strong>Amazon Web Services</strong> (Geländedaten für das Relief, Server ggf. in den USA; EU-US Data Privacy Framework).</li>
        <li><strong>GitHub Pages</strong> (GitHub Inc., USA; EU-US Data Privacy Framework): Auslieferung der Web-App.</li>
      </ul>

      <h2>5. Speicherdauer</h2>
      <p>
        Konto-, Profil- und Spieldaten speichern wir, bis du dein Konto löschst. Für die Wertung zählen Besuche
        30 Tage; die pseudonymen Besuchseinträge werden nach 35 Tagen automatisch gelöscht, Absturzberichte nach
        30 Tagen. Unter <em>Profil → Konto löschen</em> löschst du jederzeit dein Konto mit Profil, Bierpass,
        Besuchen, Freundschaften samt Chats, Mitgliedschaften in Biergemeinschaften, Vorschlägen und Online-Status. Absturzberichte
        enthalten keine Konto-Kennung und können dir daher nicht zugeordnet werden; sie laufen nach 30 Tagen ab.
        Sicherungskopien der Datenbank werden turnusmäßig überschrieben.
      </p>

      <h2>6. Deine Rechte</h2>
      <p>
        Du hast das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung, Datenübertragbarkeit
        und Widerspruch (Art. 15–21 DSGVO) sowie auf Beschwerde bei einer Datenschutz-Aufsichtsbehörde. Schreib uns
        dafür an {OPERATOR.email}.
      </p>

      <h2>7. Minderjährige</h2>
      <p>Brew Country ist ausschließlich für Erwachsene (18 Jahre, in Ländern mit höherem Mindestalter für Alkohol entsprechend älter).</p>
    </>
  );
}

function Nutzungsbedingungen() {
  return (
    <>
      <h2>1. Wer mitspielen darf</h2>
      <p>Nur Erwachsene, die in ihrem Land Alkohol trinken dürfen (mindestens 18 Jahre).</p>

      <h2>2. Verantwortungsvoll trinken</h2>
      <ul>
        <li>Brew Country belohnt Besuche, nicht Mengen. Alkoholfreie Getränke zählen genauso.</li>
        <li>Du musst nie etwas trinken, um zu spielen.</li>
        <li>Fahr nicht, wenn du getrunken hast. Infos und Hilfe: <A href={RESPONSIBLE_DRINKING_URL}>kenn-dein-limit.de</A>.</li>
      </ul>

      <h2>3. Fair Play</h2>
      <p>
        Nicht erlaubt: Standort fälschen, mehrere Konten, automatisierte Check-ins, beleidigende Spitznamen oder
        Nachrichten. Wir können Wertungen korrigieren und Konten sperren, die dagegen verstoßen.
      </p>

      <h2>4. Inhalte</h2>
      <p>Für Nachrichten und Vorschläge bist du selbst verantwortlich. Kneipendaten stammen von OpenStreetMap und können unvollständig sein.</p>

      <h2>5. Marken</h2>
      <p>Biermarken und Logos gehören ihren Inhabern. Brew Country ist nicht mit ihnen verbunden, sofern nicht ausdrücklich angegeben.</p>

      <h2>6. Haftung und Verfügbarkeit</h2>
      <p>
        Das Spiel wird ohne Gewähr für ständige Verfügbarkeit angeboten. Wir haften unbeschränkt bei Vorsatz und
        grober Fahrlässigkeit, im Übrigen nur nach den gesetzlichen Vorschriften.
      </p>

      <h2>7. Kündigung</h2>
      <p>Du kannst dein Konto jederzeit in der App löschen.</p>
    </>
  );
}

function Credits() {
  return (
    <>
      <ul>
        <li>Kneipen- und Kartendaten: <A href="https://www.openstreetmap.org/copyright">© OpenStreetMap-Mitwirkende</A>, verfügbar unter der Open Database License (ODbL).</li>
        <li>Kartenkacheln: <A href="https://openfreemap.org">OpenFreeMap</A> und <A href="https://openmaptiles.org">© OpenMapTiles</A>.</li>
        <li>Kartendarstellung: <A href="https://maplibre.org">MapLibre GL JS</A> (BSD-3-Clause).</li>
        <li>Geländedaten: Terrain Tiles (Mapzen, AWS Open Data) aus u. a. SRTM, GMTED2010 und ETOPO1.</li>
        <li>Schriften: Inter und Bricolage Grotesque (SIL Open Font License 1.1).</li>
        <li>Brauerei-Logos werden nur mit Freigabe der Markeninhaber gezeigt.</li>
      </ul>
    </>
  );
}

// ── English versions ────────────────────────────────────────────────
// Convenience translations of the German originals above. Keep them in sync
// when the German text changes; the German version stays legally binding.

function ImpressumEn() {
  return (
    <>
      <h2>Information pursuant to § 5 DDG (German Digital Services Act)</h2>
      <p>{OPERATOR.name}<br />{OPERATOR.address}</p>
      <h2>Contact</h2>
      <p>Email: {OPERATOR.email}</p>
      {OPERATOR.vatId && <p>{OPERATOR.vatId}</p>}
      <h2>Responsible for content pursuant to § 18(2) MStV (German Interstate Media Treaty)</h2>
      <p>{OPERATOR.responsible}</p>
      <h2>No affiliation with breweries</h2>
      <p>
        Brew Country is an independent game. The beer brands mentioned belong to their owners. A mention does
        not imply any partnership or endorsement unless expressly stated.
      </p>
      <h2>Consumer dispute resolution</h2>
      <p>We are neither willing nor obliged to take part in dispute resolution proceedings before a consumer arbitration board.</p>
    </>
  );
}

function DatenschutzEn() {
  return (
    <>
      <p>
        We process as little data as possible. There is no tracking, no advertising and no analytics tools.
      </p>

      <h2>1. Controller</h2>
      <p>{OPERATOR.name}, {OPERATOR.address}, {OPERATOR.email}</p>

      <h2>2. What data we process</h2>
      <ul>
        <li><strong>Account:</strong> email address, nickname, password (stored only as a hash by the login service).</li>
        <li>
          <strong>Profile:</strong> favourite beer and home location. Your exact home location is visible only to you.
          Other players can see: your user ID, favourite beer, home location rounded to about 2 km, date joined,
          time of last activity and a game setting for your home radius.
        </li>
        <li>
          <strong>Pub visits:</strong> your beer passport (pub, beer, time, alcohol-free yes/no) is private.
          For scoring, each visit is additionally stored <em>without your name or account ID</em>:
          with a pseudonym and with the time rounded to the hour. The pseudonym is derived from a secret random
          value that only your account can read, and it changes per pub and per week. Several visits by the same
          person to the same pub in the same week can therefore be linked, visits to other pubs or in other weeks
          cannot. Someone who knows you personally could still infer it was you from place and time; that is why
          we store as little as possible and delete these entries after 35 days.
        </li>
        <li><strong>Location:</strong> only at the moment you share it (onboarding, check-in), to verify that you are on site. We never track you in the background.</li>
        <li><strong>Friends & chat:</strong> friendships and messages, visible only to the people involved. Your friends also see when you were last active in the app (online status).</li>
        <li><strong>Beer clubs:</strong> if you join a beer club (where the feature is offered), other players can see its member list.</li>
        <li><strong>Crash reports:</strong> if the app crashes, we store the error message, technical stack trace, app version and browser identifier, without any account ID. This helps us find and fix bugs.</li>
        <li><strong>Beer suggestions:</strong> name, brewery, town, country, optionally website and note.</li>
        <li><strong>On your device:</strong> login status, settings and a cache of pub data (technically necessary, § 25(2) TDDDG).</li>
      </ul>
      <p>Your date of birth is only checked, never stored.</p>

      <h2>3. Purposes and legal bases</h2>
      <ul>
        <li>Providing the game (Art. 6(1)(b) GDPR).</li>
        <li>Location check at check-in based on your consent (Art. 6(1)(a) GDPR), which you can withdraw at any time in your device settings.</li>
        <li>Protection against abuse and fraud (Art. 6(1)(f) GDPR).</li>
        <li>Crash reports for fixing bugs and keeping the app stable (Art. 6(1)(f) GDPR). You can object at any time.</li>
      </ul>

      <h2>4. Recipients and services</h2>
      <ul>
        <li><strong>Google Firebase</strong> (Google Ireland Ltd.): login and database. Storage location: {OPERATOR.dataRegion}. Data processing agreement pursuant to Art. 28 GDPR.</li>
        <li><strong>OpenFreeMap</strong>: map tiles. Your IP address is transmitted in the process.</li>
        <li><strong>Overpass API</strong> (overpass-api.de, overpass.kumi.systems): pub data from OpenStreetMap for the visible map area. Your IP address and the map area are transmitted in the process.</li>
        <li><strong>Amazon Web Services</strong> (terrain data for the relief, servers possibly in the USA; EU-US Data Privacy Framework).</li>
        <li><strong>GitHub Pages</strong> (GitHub Inc., USA; EU-US Data Privacy Framework): delivery of the web app.</li>
      </ul>

      <h2>5. Retention period</h2>
      <p>
        We store account, profile and game data until you delete your account. Visits count towards scoring for
        30 days; the pseudonymous visit entries are deleted automatically after 35 days, crash reports after
        30 days. Under <em>Profile → Delete account</em> you can delete your account at any time, together with your
        profile, beer passport, visits, friendships including chats, beer club memberships, suggestions and online
        status. Crash reports contain no account ID and therefore cannot be linked to you; they expire after
        30 days. Database backups are overwritten on a rolling basis.
      </p>

      <h2>6. Your rights</h2>
      <p>
        You have the right of access, rectification, erasure, restriction of processing, data portability and
        objection (Art. 15–21 GDPR), as well as the right to lodge a complaint with a data protection supervisory
        authority. To exercise them, write to us at {OPERATOR.email}.
      </p>

      <h2>7. Minors</h2>
      <p>Brew Country is for adults only (18, or older in countries with a higher legal drinking age).</p>
    </>
  );
}

function NutzungsbedingungenEn() {
  return (
    <>
      <h2>1. Who may play</h2>
      <p>Only adults who are allowed to drink alcohol in their country (at least 18 years old).</p>

      <h2>2. Drink responsibly</h2>
      <ul>
        <li>Brew Country rewards visits, not volume. Alcohol-free drinks count just the same.</li>
        <li>You never have to drink anything to play.</li>
        <li>Don’t drive after drinking. Info and help: <A href={RESPONSIBLE_DRINKING_URL}>kenn-dein-limit.de</A>.</li>
      </ul>

      <h2>3. Fair play</h2>
      <p>
        Not allowed: faking your location, multiple accounts, automated check-ins, offensive nicknames or
        messages. We may correct scores and suspend accounts that break these rules.
      </p>

      <h2>4. Content</h2>
      <p>You are responsible for your messages and suggestions. Pub data comes from OpenStreetMap and may be incomplete.</p>

      <h2>5. Trademarks</h2>
      <p>Beer brands and logos belong to their owners. Brew Country is not affiliated with them unless expressly stated.</p>

      <h2>6. Liability and availability</h2>
      <p>
        The game is provided without any guarantee of constant availability. We are liable without limitation for
        intent and gross negligence, and otherwise only in accordance with the statutory provisions.
      </p>

      <h2>7. Termination</h2>
      <p>You can delete your account in the app at any time.</p>
    </>
  );
}

function CreditsEn() {
  return (
    <>
      <ul>
        <li>Pub and map data: <A href="https://www.openstreetmap.org/copyright">© OpenStreetMap contributors</A>, available under the Open Database License (ODbL).</li>
        <li>Map tiles: <A href="https://openfreemap.org">OpenFreeMap</A> and <A href="https://openmaptiles.org">© OpenMapTiles</A>.</li>
        <li>Map rendering: <A href="https://maplibre.org">MapLibre GL JS</A> (BSD-3-Clause).</li>
        <li>Terrain data: Terrain Tiles (Mapzen, AWS Open Data) from sources including SRTM, GMTED2010 and ETOPO1.</li>
        <li>Fonts: Inter and Bricolage Grotesque (SIL Open Font License 1.1).</li>
        <li>Brewery logos are only shown with the brand owners’ permission.</li>
      </ul>
    </>
  );
}

/** Shown above every English legal text. */
function TranslationNote() {
  return (
    <p className="legal-translation" role="note" lang="en">
      This translation is for convenience; the German version is legally binding.
    </p>
  );
}

const CONTENT: Record<Locale, Record<LegalDoc, () => ReactNode>> = {
  de: {
    impressum: Impressum,
    datenschutz: Datenschutz,
    nutzungsbedingungen: Nutzungsbedingungen,
    credits: Credits,
  },
  en: {
    impressum: ImpressumEn,
    datenschutz: DatenschutzEn,
    nutzungsbedingungen: NutzungsbedingungenEn,
    credits: CreditsEn,
  },
};

/** The legal text in the UI language (German original, English convenience translation). */
export function LegalContent({ doc }: { doc: LegalDoc }) {
  const locale = useLocale();
  const Doc = CONTENT[locale][doc];
  return (
    <>
      {locale !== 'de' && <TranslationNote />}
      <Doc />
    </>
  );
}
