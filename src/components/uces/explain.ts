// Presentation rules shared by the Inspector (Tier B) and the dedicated knowledge page (Tier C).

/** Entity types whose registry `equations` are their own governing or defining equations. */
const OWN_EQUATION_TYPES = new Set(['MATHEMATICAL_MODEL', 'EQUATION', 'PARAMETER', 'PHYSIOLOGICAL_MECHANISM', 'ANALYSIS_METHOD']);

/**
 * The registry also lists equations on structures, cells, molecules, circuits and systems. Those equations belong to
 * the computational models associated with the entity; the biological entity itself is not "governed" by them, so the
 * section is titled accordingly.
 */
export function equationSection(entityType: string): { title: string; note: string | null } {
  if (OWN_EQUATION_TYPES.has(entityType)) return { title: 'Governing Equations', note: null };
  return {
    title: 'Equations of Associated Models',
    note: 'These equations belong to the computational models linked to this entity. They describe those models, not the biological entity directly.',
  };
}

const sentences = (text: string) => text.replace(/\s+/g, ' ').trim().split(/(?<=[.!?])\s+(?=[A-Z(])/).filter(Boolean);
const key = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/**
 * Removes sentences that were already shown. Registry fields often repeat the same sentence (definition, role and
 * mechanism); the reader sees each statement once. Returns the remaining text, or '' when nothing new is left.
 */
export function withoutShown(text: string | undefined, shown: Set<string>): string {
  if (!text) return '';
  const fresh: string[] = [];
  for (const s of sentences(text)) {
    const k = key(s);
    if (!k || shown.has(k)) continue;
    shown.add(k);
    fresh.push(s);
  }
  return fresh.join(' ');
}

export const NOTHING_NEW = 'The registry records no further detail here beyond the sections above.';
