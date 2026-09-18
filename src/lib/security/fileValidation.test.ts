import { describe, expect, it } from 'vitest';
import { validateExtractedDocument, FileValidationError } from './fileValidation';

function pages(n: number, wordsPerPage = 10) {
  return Array.from({ length: n }, (_, i) => ({
    pageNumber: i + 1,
    rawText: Array.from({ length: wordsPerPage }, () => 'كلمة').join(' ')
  }));
}

describe('validateExtractedDocument', () => {
  it('accepts a valid extracted PDF payload', () => {
    const type = validateExtractedDocument({ fileType: 'PDF', pages: pages(5), planCode: 'FREE' });
    expect(type).toBe('PDF');
  });

  it('rejects an unsupported file type', () => {
    expect(() => validateExtractedDocument({ fileType: 'EXE', pages: pages(1), planCode: 'FREE' })).toThrow(
      FileValidationError
    );
  });

  it('rejects an empty pages array', () => {
    expect(() => validateExtractedDocument({ fileType: 'PDF', pages: [], planCode: 'FREE' })).toThrow(
      FileValidationError
    );
  });

  it('rejects malformed page entries', () => {
    expect(() =>
      validateExtractedDocument({ fileType: 'PDF', pages: [{ pageNumber: 'x', rawText: 1 }], planCode: 'FREE' })
    ).toThrow(FileValidationError);
  });

  it('rejects a FREE-plan document over the page-count limit', () => {
    expect(() => validateExtractedDocument({ fileType: 'PDF', pages: pages(61), planCode: 'FREE' })).toThrow(
      FileValidationError
    );
  });

  it('allows a larger page count under the PRO plan limit', () => {
    const type = validateExtractedDocument({ fileType: 'PDF', pages: pages(200), planCode: 'PRO' });
    expect(type).toBe('PDF');
  });

  it('rejects a FREE-plan document over the character limit even with few pages', () => {
    expect(() => validateExtractedDocument({ fileType: 'PDF', pages: pages(2, 200_000), planCode: 'FREE' })).toThrow(
      FileValidationError
    );
  });
});
