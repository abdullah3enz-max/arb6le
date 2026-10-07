import { describe, expect, it } from 'vitest';
import { extractNumericAnchors } from './anchors';
import { allowedTypes, classifyFact, normalizeFactType, typeRank } from './factTypes';
import type { ExtractedConcept } from './types';

const concept = (atomLabel: string, conceptType: ExtractedConcept['conceptType'] = 'DEFINITION', summary = ''): ExtractedConcept => ({
  title: atomLabel,
  summary,
  atomLabel,
  atomEmoji: '🧠',
  importance: 80,
  conceptType,
  sourcePageNumbers: [1]
});
const classify = (c: ExtractedConcept) => classifyFact(c, extractNumericAnchors(c.atomLabel));

describe('classifyFact', () => {
  it.each([
    [concept('7 mg'), 'NUMBER'],
    [concept('8 hours'), 'TIME'],
    [concept('Salt', 'DEFINITION'), 'ENGLISH_WORD'],
    [concept('Tachycardia', 'TERMINOLOGY'), 'TERM'],
    [concept('MRI'), 'ACRONYM'],
    [concept('Glycolysis steps', 'PROCESS'), 'PROCESS'],
    [concept('Smoking causes cancer', 'CAUSE_EFFECT'), 'CAUSE_EFFECT'],
    [concept('salt, vinegar, sugar'), 'LIST'],
    [concept('Homeostasis keeps balance'), 'CONCEPT']
  ])('%o → %s', (c, expected) => {
    expect(classify(c)).toBe(expected);
  });
});

describe('allowedTypes', () => {
  it('never offers a number association for a fact without a number', () => {
    expect(allowedTypes('ENGLISH_WORD', false)).not.toContain('NUMERIC');
    expect(allowedTypes('PROCESS', false)).not.toContain('NUMERIC');
    expect(allowedTypes('NUMBER', true)[0]).toBe('NUMERIC');
  });

  it('puts sound first for English words and keeps the story last', () => {
    const types = allowedTypes('ENGLISH_WORD', false);
    expect(types[0]).toBe('PHONETIC');
    expect(types.at(-1)).toBe('MINI_STORY');
    expect(typeRank('ENGLISH_WORD', 'PHONETIC')).toBeLessThan(typeRank('ENGLISH_WORD', 'CONCEPTUAL'));
  });

  it('normalizes a model-provided fact type and falls back on junk', () => {
    expect(normalizeFactType('english word', 'OTHER')).toBe('ENGLISH_WORD');
    expect(normalizeFactType('cause/effect', 'OTHER')).toBe('CAUSE_EFFECT');
    expect(normalizeFactType('nonsense', 'TERM')).toBe('TERM');
  });
});
