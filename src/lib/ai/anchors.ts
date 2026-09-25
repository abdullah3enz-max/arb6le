import type { Anchor } from './types';

const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';

const NUMBER_WORDS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  twice: 2,
  thrice: 3
};

const NUM = String.raw`\d+(?:[.,]\d+)?`;
// A unit is a short word right after the number ("mg", "bpm", "chambers", "%") — not "and"/"or".
const UNIT = String.raw`(?:%|°[cf]|[a-zµμ]+(?:\/[a-z]+)?)`;
const STOP_UNITS = new Set(['and', 'or', 'to', 'of', 'in', 'the', 'a', 'an', 'is', 'are', 'per', 'at', 'on', 'for', 'with']);

function normalizeDigits(text: string): string {
  return text.replace(/[٠-٩]/g, (d) => String(ARABIC_DIGITS.indexOf(d)));
}

function cleanUnit(unit: string | undefined): string {
  const u = (unit ?? '').trim();
  return u && !STOP_UNITS.has(u.toLowerCase()) ? u : '';
}

/**
 * Deterministic anchor extraction for the parts of a fact that are hardest to memorize and most
 * bridgeable: ranges ("60–100 bpm"), measurements ("1.5 kg", "500 mg") and bare counts ("four
 * chambers"). Runs in code before any model call, so the discovery step is always handed the
 * real numbers from the slide rather than trusting the model to notice them.
 */
export function extractNumericAnchors(rawText: string): Anchor[] {
  const text = normalizeDigits(rawText);
  const anchors: Anchor[] = [];
  const covered: [number, number][] = [];
  const isCovered = (start: number, end: number) => covered.some(([s, e]) => start < e && end > s);

  const rangeRe = new RegExp(String.raw`(${NUM})\s*(?:–|—|-|to)\s*(${NUM})\s*(${UNIT})?\b`, 'gi');
  for (const m of text.matchAll(rangeRe)) {
    const unit = cleanUnit(m[3]);
    anchors.push({ text: `${m[1]}–${m[2]}${unit ? ` ${unit}` : ''}`, kind: 'RANGE', relevance: 0.95 });
    covered.push([m.index!, m.index! + m[0].length]);
  }

  const numberRe = new RegExp(String.raw`(${NUM})\s*(${UNIT})?`, 'gi');
  for (const m of text.matchAll(numberRe)) {
    const start = m.index!;
    const end = start + m[0].length;
    if (isCovered(start, end)) continue;
    const unit = cleanUnit(m[2]);
    anchors.push(
      unit
        ? { text: `${m[1]} ${unit}`, kind: 'MEASUREMENT', relevance: 0.9 }
        : { text: m[1]!, kind: 'NUMBER', relevance: 0.8 }
    );
  }

  const wordRe = new RegExp(String.raw`\b(${Object.keys(NUMBER_WORDS).join('|')})\s+([a-z]+)`, 'gi');
  for (const m of text.matchAll(wordRe)) {
    const n = NUMBER_WORDS[m[1]!.toLowerCase()]!;
    const noun = cleanUnit(m[2]);
    anchors.push({ text: noun ? `${n} ${noun}` : String(n), kind: 'NUMBER', relevance: 0.85 });
  }

  const seen = new Set<string>();
  return anchors.filter((a) => {
    const key = a.text.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
