import { describe, expect, it } from 'vitest';
import { normalizeConceptTitle, mapWithConcurrency, pickWithDiversity } from './pipeline';
import type { ScoredBridge } from './types';

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

describe('pickWithDiversity', () => {
  const scored = (worldRef: string, type: ScoredBridge['candidate']['connectionType'], final: number) =>
    ({ candidate: { worldRef, connectionType: type }, final }) as ScoredBridge;

  it('takes the best association when nothing has been used yet', () => {
    expect(pickWithDiversity([scored('A', 'NUMERIC', 0.9), scored('B', 'PHONETIC', 0.85)], new Map(), new Map())).toBe(0);
  });

  it('a near-tie goes to a type not yet used in this document', () => {
    const typeUsage = new Map([['NUMERIC', 3]]);
    expect(pickWithDiversity([scored('A', 'NUMERIC', 0.9), scored('B', 'PHONETIC', 0.86)], new Map(), typeUsage)).toBe(1);
  });

  it('a clearly stronger association still wins over variety', () => {
    const typeUsage = new Map([['NUMERIC', 10]]);
    expect(pickWithDiversity([scored('A', 'NUMERIC', 0.95), scored('B', 'PHONETIC', 0.8)], new Map(), typeUsage)).toBe(0);
  });

  it('skips a reference already used twice in this document; -1 when nothing is left', () => {
    const refUsage = new Map([['ronaldo', 2]]);
    expect(pickWithDiversity([scored('Ronaldo', 'NUMERIC', 0.99), scored('سلطة', 'PHONETIC', 0.8)], refUsage, new Map())).toBe(1);
    expect(pickWithDiversity([scored('Ronaldo', 'NUMERIC', 0.99)], refUsage, new Map())).toBe(-1);
  });
});
