/**
 * Operator details for Impressum and privacy policy.
 * TODO(launch): fill in and set `configured: true`. Until then the legal pages
 * show a visible "template" banner. Have the texts reviewed by a lawyer.
 */
export const OPERATOR = {
  configured: false,
  name: '[Vor- und Nachname bzw. Firma]',
  address: '[Straße Hausnummer, PLZ Ort, Land]',
  email: '[kontakt@beispiel.de]',
  /** Responsible for content according to § 18 Abs. 2 MStV */
  responsible: '[Name, Anschrift wie oben]',
  /** e.g. "USt-IdNr. DE…" or empty */
  vatId: '',
  /** Firestore location of the production project, e.g. "eur3 (Europa)" */
  dataRegion: '[Firestore-Region, z. B. eur3 (EU)]',
};

export const RESPONSIBLE_DRINKING_URL = 'https://www.kenn-dein-limit.de';
