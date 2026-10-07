import { describe, expect, it } from 'vitest';
import { summarize, type BenchmarkRecord } from './runner';
import { BENCHMARK_FACTS, BENCHMARK_PROFILES } from './dataset';

describe('benchmark dataset', () => {
  it('has 100 facts, 20 per category, and 7 interest profiles', () => {
    expect(BENCHMARK_FACTS).toHaveLength(100);
    const counts = BENCHMARK_FACTS.reduce<Record<string, number>>((m, f) => ({ ...m, [f.category]: (m[f.category] ?? 0) + 1 }), {});
    expect(Object.values(counts)).toEqual([20, 20, 20, 20, 20]);
    expect(BENCHMARK_PROFILES.map((p) => p.name)).toEqual(['Football', 'Movies', 'TV', 'Anime', 'Games', 'Cars', 'Music']);
  });
});

describe('summarize', () => {
  it('turns run records into comparable numbers', () => {
    const records: BenchmarkRecord[] = [
      {
        category: 'numbers',
        profile: 'Football',
        fact: '7 mg',
        selected: { type: 'NUMERIC', world: 'FOOTBALL', link: '7 → Ronaldo #7', quality: 0.97, fromInterest: true },
        rejected: [{ code: 'inaccurate', link: '7 → x' }]
      },
      {
        category: 'english_words',
        profile: 'Anime',
        fact: 'Salt',
        selected: { type: 'PHONETIC', world: 'DAILY_LIFE', link: 'Salt → سلطة', quality: 0.92, fromInterest: false },
        rejected: [{ code: 'forced_interest', link: 'Salt → Luffy' }]
      },
      { category: 'concepts', profile: 'TV', fact: 'Osmosis', selected: null, rejected: [{ code: 'hallucination_risk', link: 'y' }] },
      { category: 'names', profile: 'Cars', fact: 'Galen', selected: null, rejected: [], error: 'timeout' }
    ];
    const m = summarize(records);
    expect(m).toMatchObject({
      facts: 4,
      withAssociation: 2,
      noStrongAssociation: 1,
      errors: 1,
      rejectedTotal: 3,
      hallucinationsCaught: 2,
      fromInterest: 1,
      distinctTypes: 2,
      avgLinkWords: 2.5
    });
    expect(m.bySection).toMatchObject({ numbers: 1, sound: 1, concept: 0 });
    expect(m.byCategory.numbers).toEqual({ facts: 1, withAssociation: 1 });
  });
});
