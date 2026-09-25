import { describe, expect, it } from 'vitest';
import { diversify } from './bridgeEngine';
import type { BridgeCandidate, BridgeConnectionType } from './types';

function c(worldRef: string, connectionType: BridgeConnectionType): BridgeCandidate {
  return {
    id: worldRef,
    anchor: '7',
    connectionType,
    worldCategory: 'GENERAL_KNOWLEDGE',
    worldRef,
    atomEmoji: '💡',
    bridgeLine: `7 ← ${worldRef}`,
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

  it('interleaves connection types so a limited verification batch spans different kinds of bridges', () => {
    const out = diversify([c('A', 'NUMERIC'), c('B', 'NUMERIC'), c('C', 'NUMERIC'), c('D', 'PHONETIC'), c('E', 'NARRATIVE')]);
    expect(out.slice(0, 3).map((x) => x.connectionType)).toEqual(['NUMERIC', 'PHONETIC', 'NARRATIVE']);
    expect(out).toHaveLength(5);
  });
});
