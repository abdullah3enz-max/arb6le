import { describe, expect, it } from 'vitest';
import { validateUploadedFile, FileValidationError } from './fileValidation';

const PDF_HEADER = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]);
const ZIP_HEADER = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0]);

describe('validateUploadedFile', () => {
  it('accepts a real PDF signature declared as application/pdf', () => {
    const type = validateUploadedFile({
      fileName: 'x.pdf',
      mimeType: 'application/pdf',
      sizeBytes: PDF_HEADER.length,
      buffer: PDF_HEADER,
      planCode: 'FREE'
    });
    expect(type).toBe('PDF');
  });

  it('rejects a file whose content does not match its declared PDF mime type (spoofed extension)', () => {
    expect(() =>
      validateUploadedFile({
        fileName: 'malicious.pdf',
        mimeType: 'application/pdf',
        sizeBytes: ZIP_HEADER.length,
        buffer: ZIP_HEADER,
        planCode: 'FREE'
      })
    ).toThrow(FileValidationError);
  });

  it('rejects unsupported mime types outright', () => {
    expect(() =>
      validateUploadedFile({
        fileName: 'x.exe',
        mimeType: 'application/x-msdownload',
        sizeBytes: 10,
        buffer: Buffer.from([0, 0, 0, 0]),
        planCode: 'FREE'
      })
    ).toThrow(FileValidationError);
  });

  it('rejects a FREE-plan file over the plan size limit', () => {
    const oversized = Buffer.concat([PDF_HEADER, Buffer.alloc(11 * 1024 * 1024)]);
    expect(() =>
      validateUploadedFile({ fileName: 'x.pdf', mimeType: 'application/pdf', sizeBytes: oversized.length, buffer: oversized, planCode: 'FREE' })
    ).toThrow(FileValidationError);
  });

  it('allows a larger file under the PRO plan limit', () => {
    const bigButFine = Buffer.concat([PDF_HEADER, Buffer.alloc(11 * 1024 * 1024)]);
    const type = validateUploadedFile({
      fileName: 'x.pdf',
      mimeType: 'application/pdf',
      sizeBytes: bigButFine.length,
      buffer: bigButFine,
      planCode: 'PRO'
    });
    expect(type).toBe('PDF');
  });
});
