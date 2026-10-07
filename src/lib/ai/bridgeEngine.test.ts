import { describe, expect, it } from 'vitest';
import { balancedBatch, diversify } from './bridgeEngine';
import type { BridgeCandidate, BridgeConnectionType } from './types';

function c(worldRef: string, connectionType: BridgeConnectionType): BridgeCandidate {
  return {
    id: worldRef,
    anchor: '7',
    connectionType,
    worldCategory: 'GENERAL_KNOWLEDGE',
    worldRef,
    atomEmoji: '💡',
    bridgeLine: `7 → ${worldRef}`,
    whyOneLiner: '',
    evidence: 'e',
    confidence: 0.9,
    relationDistance: 1
  };
}

describe('diversify', () => {
  it('keeps one candidate per reference, ignoring case and punctuation', () => {
    expect(diversify([c('Ref A', 'NUMERIC'), c('ref a!', 'NUMERIC'), c('Ref B', 'PHONETIC')]).map((x) => x.worldRef)).toEqual([
      'Ref A',
      'Ref B'
    ]);
  });

  it('interleaves association types', () => {
    const out = diversify([c('A', 'NUMERIC'), c('B', 'NUMERIC'), c('C', 'NUMERIC'), c('D', 'PHONETIC'), c('E', 'SCENE')]);
    expect(out.slice(0, 3).map((x) => x.connectionType)).toEqual(['NUMERIC', 'PHONETIC', 'SCENE']);
    expect(out).toHaveLength(5);
  });
});

describe('balancedBatch', () => {
  it('takes from every discovery pass in turn', () => {
    const batch = balancedBatch([[c('n1', 'NUMERIC')], [c('i1', 'CHARACTER'), c('i2', 'SCENE')], [c('p1', 'PHONETIC')], [c('g1', 'VISUAL')]]);
    expect(batch.map((x) => x.id)).toEqual(['n1', 'i1', 'p1', 'g1', 'i2']);
  });

  it('caps number associations so they cannot crowd out the other types', () => {
    const numbers = Array.from({ length: 10 }, (_, i) => c(`n${i}`, 'NUMERIC'));
    const batch = balancedBatch([numbers, [c('p1', 'PHONETIC'), c('p2', 'WORD')]]);
    expect(batch.filter((x) => x.connectionType === 'NUMERIC')).toHaveLength(4);
    expect(batch.map((x) => x.id)).toContain('p2');
  });
});
