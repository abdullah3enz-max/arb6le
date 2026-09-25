import { describe, expect, it } from 'vitest';
import { diversify } from './connectionFinder';
import type { ConnectionCandidate, WorldCategory } from '@/lib/ai/types';

function candidate(worldRef: string, worldCategory: WorldCategory): ConnectionCandidate {
  return {
    associationLevel: 'PHONETIC',
    worldCategory,
    worldRef,
    atomEmoji: '💡',
    atomLabel: 'x',
    bridgeLine: `${worldRef} = x`,
    whyOneLiner: '',
    claimType: 'FACT',
    sources: [],
    scoreBreakdown: { directness: 0, familiarity: 0, simplicity: 0, memorability: 0, relevance: 0, confusionRisk: 0 }
  };
}

describe('diversify', () => {
  it('keeps only one candidate per reference, ignoring case and punctuation', () => {
    const result = diversify([
      candidate('Player A', 'FOOTBALL'),
      candidate('player a!', 'FOOTBALL'),
      candidate('Show B', 'SERIES')
    ]);
    expect(result.map((c) => c.worldRef)).toEqual(['Player A', 'Show B']);
  });

  it('interleaves categories so the first candidates tried are not all from one world', () => {
    const result = diversify([
      candidate('Player A', 'FOOTBALL'),
      candidate('Player B', 'FOOTBALL'),
      candidate('Player C', 'FOOTBALL'),
      candidate('Show D', 'SERIES'),
      candidate('Anime E', 'ANIME')
    ]);
    expect(result.slice(0, 3).map((c) => c.worldCategory)).toEqual(['FOOTBALL', 'SERIES', 'ANIME']);
    expect(result).toHaveLength(5);
  });
});
