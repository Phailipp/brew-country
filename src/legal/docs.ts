export type LegalDoc = 'impressum' | 'datenschutz' | 'nutzungsbedingungen' | 'credits';

export const LEGAL_TITLES: Record<LegalDoc, string> = {
  impressum: 'Impressum',
  datenschutz: 'Datenschutzerklärung',
  nutzungsbedingungen: 'Nutzungsbedingungen',
  credits: 'Quellen & Lizenzen',
};

export const LEGAL_DOCS = Object.keys(LEGAL_TITLES) as LegalDoc[];

export function legalDocFromHash(hash: string): LegalDoc | null {
  const id = hash.replace(/^#/, '');
  return (LEGAL_DOCS as string[]).includes(id) ? (id as LegalDoc) : null;
}
