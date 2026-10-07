import type { Anchor, BridgeConnectionType, ExtractedConcept, FactType } from './types';

export const FACT_TYPES: FactType[] = [
  'NUMBER',
  'NAME',
  'TERM',
  'ENGLISH_WORD',
  'ACRONYM',
  'LIST',
  'PROCESS',
  'CONCEPT',
  'LOCATION',
  'TIME',
  'CAUSE_EFFECT',
  'OTHER'
];

const NUMERIC_KINDS = new Set(['NUMBER', 'RANGE', 'MEASUREMENT']);
const TIME_UNIT = /\b(sec|second|min|minute|hour|hr|day|week|month|year)s?\b|ثاني|دقيق|ساع|يوم|أيام|أسبوع|شهر|سنة|سنوات/i;
const LATIN_WORD = /^[A-Za-z][A-Za-z'-]*$/;

/**
 * Deterministic first pass at the fact's shape, from the isolated fact (atomLabel) and the
 * extractor's conceptType. Discovery may refine it; this is the fallback and the guard rail
 * (a NUMBER fact always has a real number in it — the model can't invent one).
 */
export function classifyFact(concept: ExtractedConcept, numericAnchors: Anchor[]): FactType {
  const label = concept.atomLabel.trim();
  const hasNumber = numericAnchors.some((a) => NUMERIC_KINDS.has(a.kind));

  if (hasNumber) return TIME_UNIT.test(label) ? 'TIME' : 'NUMBER';
  if (/^[A-Z]{2,6}s?$/.test(label) || /\b[A-Z]{2,6}\b/.test(label.split(/[\s(]/)[0] ?? '')) return 'ACRONYM';
  if (concept.conceptType === 'CAUSE_EFFECT') return 'CAUSE_EFFECT';
  if (concept.conceptType === 'PROCESS' || concept.conceptType === 'SEQUENCE') return 'PROCESS';
  if ((label.match(/[,،]/g) ?? []).length >= 2) return 'LIST';
  if (LATIN_WORD.test(label)) return concept.conceptType === 'TERMINOLOGY' ? 'TERM' : 'ENGLISH_WORD';
  if (concept.conceptType === 'TERMINOLOGY') return 'TERM';
  if (concept.conceptType === 'DEFINITION' || concept.conceptType === 'COMPARISON') return 'CONCEPT';
  return 'OTHER';
}

/**
 * Which association types may compete for a fact, best-fitting first. The order is only a
 * tie-breaker — the judge's scores decide. NUMERIC is offered only when the fact really contains
 * a number, so a number-shaped bridge can never be bolted onto a word.
 */
const TYPE_ORDER: Record<FactType, BridgeConnectionType[]> = {
  NUMBER: ['NUMERIC', 'CHARACTER', 'VISUAL', 'SCENE', 'PHONETIC', 'CONCEPTUAL', 'MINI_STORY'],
  TIME: ['NUMERIC', 'SCENE', 'CHARACTER', 'CONCEPTUAL', 'VISUAL', 'MINI_STORY'],
  ENGLISH_WORD: ['PHONETIC', 'WORD', 'VISUAL', 'CHARACTER', 'SCENE', 'CONCEPTUAL', 'MINI_STORY'],
  TERM: ['PHONETIC', 'WORD', 'VISUAL', 'CHARACTER', 'SCENE', 'CONCEPTUAL', 'MINI_STORY'],
  ACRONYM: ['PHONETIC', 'WORD', 'CHARACTER', 'VISUAL', 'CONCEPTUAL', 'MINI_STORY'],
  NAME: ['PHONETIC', 'CHARACTER', 'VISUAL', 'WORD', 'SCENE', 'MINI_STORY'],
  LIST: ['CHARACTER', 'SCENE', 'NUMERIC', 'WORD', 'CONCEPTUAL', 'MINI_STORY'],
  PROCESS: ['SCENE', 'CHARACTER', 'CONCEPTUAL', 'NUMERIC', 'VISUAL', 'MINI_STORY'],
  CONCEPT: ['CONCEPTUAL', 'SCENE', 'CHARACTER', 'VISUAL', 'WORD', 'PHONETIC', 'MINI_STORY'],
  CAUSE_EFFECT: ['SCENE', 'CONCEPTUAL', 'CHARACTER', 'VISUAL', 'MINI_STORY'],
  LOCATION: ['VISUAL', 'SCENE', 'PHONETIC', 'CHARACTER', 'CONCEPTUAL', 'MINI_STORY'],
  OTHER: ['CONCEPTUAL', 'VISUAL', 'CHARACTER', 'SCENE', 'PHONETIC', 'WORD', 'MINI_STORY']
};

export function allowedTypes(factType: FactType, hasNumber: boolean): BridgeConnectionType[] {
  const order = TYPE_ORDER[factType];
  // A LIST/PROCESS may still be bridged by its count ("4 stages") if a number is present.
  return hasNumber ? order : order.filter((t) => t !== 'NUMERIC');
}

/** 0 for the best-fitting type, growing down the list; used only to break exact ties. */
export function typeRank(factType: FactType, type: BridgeConnectionType): number {
  const i = TYPE_ORDER[factType].indexOf(type);
  return i === -1 ? TYPE_ORDER[factType].length : i;
}

export function hasNumericAnchor(anchors: Anchor[]): boolean {
  return anchors.some((a) => NUMERIC_KINDS.has(a.kind));
}

export function normalizeFactType(raw: unknown, fallback: FactType): FactType {
  const v = String(raw ?? '').toUpperCase().replace(/[\s/-]+/g, '_') as FactType;
  return FACT_TYPES.includes(v) ? v : fallback;
}
