import type { ReactNode } from 'react';
import { OPERATOR, RESPONSIBLE_DRINKING_URL } from '../config/legal';

import type { LegalDoc } from './docs';

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
        <li><strong>Profil:</strong> Lieblingsbier und Heimatort. Der genaue Heimatort ist nur für dich sichtbar; für andere Spieler ist er auf ca. 2 km gerundet.</li>
        <li>
          <strong>Kneipenbesuche:</strong> Dein Bierpass (Kneipe, Bier, Zeitpunkt, alkoholfrei ja/nein) ist privat.
          Für die Spielwertung wird jeder Besuch zusätzlich <em>ohne Namen oder Konto-Kennung</em> gespeichert:
          mit einem Pseudonym, das aus einem nur dir bekannten Zufallswert gebildet wird, und mit auf die Stunde gerundeter Zeit.
          Andere können daraus nicht erkennen, wer du bist oder in welchen Kneipen du sonst warst.
        </li>
        <li><strong>Standort:</strong> nur in dem Moment, in dem du ihn freigibst (Onboarding, Check-in), um zu prüfen, dass du vor Ort bist. Wir orten dich nicht im Hintergrund.</li>
        <li><strong>Freunde & Chat:</strong> Freundschaften und Nachrichten, sichtbar nur für die beteiligten Personen.</li>
        <li><strong>Bier-Vorschläge:</strong> Name, Brauerei, Ort, Land, optional Website und Notiz.</li>
        <li><strong>Auf deinem Gerät:</strong> Anmeldestatus, Einstellungen und ein Zwischenspeicher für Kneipendaten (technisch notwendig, § 25 Abs. 2 TDDDG).</li>
      </ul>
      <p>Dein Geburtsdatum wird nur geprüft und nicht gespeichert.</p>

      <h2>3. Zwecke und Rechtsgrundlagen</h2>
      <ul>
        <li>Bereitstellung des Spiels (Art. 6 Abs. 1 lit. b DSGVO).</li>
        <li>Standortprüfung beim Check-in auf Grundlage deiner Einwilligung (Art. 6 Abs. 1 lit. a DSGVO), die du jederzeit in den Geräteeinstellungen widerrufen kannst.</li>
        <li>Schutz vor Missbrauch und Betrug (Art. 6 Abs. 1 lit. f DSGVO).</li>
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
        Konto-, Profil- und Spieldaten speichern wir, bis du dein Konto löschst. Für die Wertung zählen Besuche nur
        30 Tage. Unter <em>Profil → Konto löschen</em> entfernst du jederzeit alle Daten: Profil, Bierpass,
        Besuche, Freundschaften, Chats und Vorschläge.
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

const CONTENT: Record<LegalDoc, () => ReactNode> = {
  impressum: Impressum,
  datenschutz: Datenschutz,
  nutzungsbedingungen: Nutzungsbedingungen,
  credits: Credits,
};

export function LegalContent({ doc }: { doc: LegalDoc }) {
  const Doc = CONTENT[doc];
  return <Doc />;
}
