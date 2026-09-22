import { describe, expect, it } from 'vitest';
import { normalizeConceptTitle, mapWithConcurrency } from './pipeline';

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

describe('mapWithConcurrency', () => {
  it('preserves result order regardless of finish order', async () => {
    const items = [30, 10, 20, 5];
    const results = await mapWithConcurrency(items, 4, async (ms) => {
      await new Promise((resolve) => setTimeout(resolve, ms));
      return ms;
    });
    expect(results).toEqual(items);
  });

  it('never runs more than `limit` at once', async () => {
    let active = 0;
    let maxActive = 0;
    await mapWithConcurrency(Array.from({ length: 10 }), 3, async () => {
      active++;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active--;
    });
    expect(maxActive).toBeLessThanOrEqual(3);
  });

  it('a limit higher than the item count just runs them all concurrently', async () => {
    const results = await mapWithConcurrency([1, 2, 3], 10, async (n) => n * 2);
    expect(results).toEqual([2, 4, 6]);
  });

  it('propagates a rejection instead of swallowing it', async () => {
    await expect(
      mapWithConcurrency([1, 2, 3], 2, async (n) => {
        if (n === 2) throw new Error('boom');
        return n;
      })
    ).rejects.toThrow('boom');
  });
});
