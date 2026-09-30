import { t } from '../i18n';

/** Legal pages; the ids are also their URL hashes (#impressum, …) and stay German. */
export type LegalDoc = 'impressum' | 'datenschutz' | 'nutzungsbedingungen' | 'credits';

export const LEGAL_DOCS: LegalDoc[] = ['impressum', 'datenschutz', 'nutzungsbedingungen', 'credits'];

/** Page title in the UI language. */
export function legalTitle(doc: LegalDoc): string {
  return t(`legalLinks.${doc}`);
}

export function legalDocFromHash(hash: string): LegalDoc | null {
  const id = hash.replace(/^#/, '');
  return (LEGAL_DOCS as string[]).includes(id) ? (id as LegalDoc) : null;
}
