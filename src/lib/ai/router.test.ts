import { describe, expect, it } from 'vitest';
import { parseJsonResponse } from './router';

describe('parseJsonResponse', () => {
  it('parses a clean JSON response', () => {
    expect(parseJsonResponse<{ a: number }>('{"a": 1}')).toEqual({ a: 1 });
  });

  it('strips ```json code fences', () => {
    expect(parseJsonResponse<{ a: number }>('```json\n{"a": 1}\n```')).toEqual({ a: 1 });
  });

  it('extracts JSON embedded in leaked reasoning text (real OpenRouter failure mode)', () => {
    const leaked = 'We need to return JSON only. {"candidates": []}';
    expect(parseJsonResponse<{ candidates: unknown[] }>(leaked)).toEqual({ candidates: [] });
  });

  it('extracts a JSON array embedded in surrounding text', () => {
    const leaked = 'Here is the array you asked for: [1, 2, 3] — hope that helps!';
    expect(parseJsonResponse<number[]>(leaked)).toEqual([1, 2, 3]);
  });

  it('throws a clear error when no JSON is present at all, rather than inventing a shape', () => {
    expect(() => parseJsonResponse('sorry, I cannot help with that')).toThrow(/No valid JSON/);
  });

  it('recovers from a stray unmatched leading brace (real OpenRouter failure mode: "{ { ... } }")', () => {
    const malformed = '{ { "candidates": [{"worldRef": "Ronaldo"}] } }';
    expect(parseJsonResponse<{ candidates: { worldRef: string }[] }>(malformed)).toEqual({
      candidates: [{ worldRef: 'Ronaldo' }]
    });
  });

  it('does not get confused by braces inside string values', () => {
    const withBraceInString = 'noise before {"note": "use {curly} braces carefully", "n": 1} noise after';
    expect(parseJsonResponse<{ note: string; n: number }>(withBraceInString)).toEqual({
      note: 'use {curly} braces carefully',
      n: 1
    });
  });
});
