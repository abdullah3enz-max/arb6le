import { describe, expect, it } from 'vitest';
import { normalizeConceptTitle } from './pipeline';

describe('normalizeConceptTitle', () => {
  it('is a no-op on already-identical titles', () => {
    expect(normalizeConceptTitle('جرعة الدواء أ')).toBe(normalizeConceptTitle('جرعة الدواء أ'));
  });

  it('ignores surrounding and doubled whitespace', () => {
    expect(normalizeConceptTitle('  جرعة   الدواء أ  ')).toBe(normalizeConceptTitle('جرعة الدواء أ'));
  });

  it('ignores case differences in Latin text', () => {
    expect(normalizeConceptTitle('Metformin Dosage')).toBe(normalizeConceptTitle('metformin dosage'));
  });

  it('ignores trailing/wrapping punctuation and quote style — a real observed model mismatch', () => {
    // The concept was saved as-is from extraction; the quiz-generation call later echoed the
    // same title back wrapped in curly quotes with a trailing period, which an exact-string
    // match treated as a completely different concept and silently dropped the question.
    expect(normalizeConceptTitle('“Metformin Dosage.”')).toBe(normalizeConceptTitle('Metformin Dosage'));
  });

  it('still treats genuinely different titles as different', () => {
    expect(normalizeConceptTitle('جرعة الدواء أ')).not.toBe(normalizeConceptTitle('جرعة الدواء ب'));
  });
});
