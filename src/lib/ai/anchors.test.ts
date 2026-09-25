import { describe, expect, it } from 'vitest';
import { extractNumericAnchors } from './anchors';

const texts = (s: string) => extractNumericAnchors(s).map((a) => `${a.kind}:${a.text}`);

describe('extractNumericAnchors', () => {
  it('keeps a range together with its unit instead of splitting it into two numbers', () => {
    expect(texts('Normal adult heart rate is 60–100 bpm.')).toEqual(['RANGE:60–100 bpm']);
  });

  it('extracts measurements with their units', () => {
    expect(texts('The liver weighs approximately 1.5 kg.')).toEqual(['MEASUREMENT:1.5 kg']);
    expect(texts('Metformin 500 mg twice daily')).toEqual(['MEASUREMENT:500 mg', 'NUMBER:2 daily']);
  });

  it('turns spelled-out counts into numeric anchors', () => {
    expect(texts('The human heart has four chambers.')).toEqual(['NUMBER:4 chambers']);
  });

  it('reads Arabic-Indic digits', () => {
    expect(texts('الجرعة ٧ mg')).toEqual(['MEASUREMENT:7 mg']);
  });

  it('does not treat a joining word as a unit', () => {
    expect(texts('30 and 15 marks')).toEqual(['NUMBER:30', 'MEASUREMENT:15 marks']);
  });

  it('returns nothing for a fact with no numbers', () => {
    expect(texts('Time Gain Compensation adjusts brightness by depth')).toEqual([]);
  });
});
