const ALLOWED_MIME: Record<string, 'PDF' | 'PPT' | 'PPTX'> = {
  'application/pdf': 'PDF',
  'application/vnd.ms-powerpoint': 'PPT',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'PPTX'
};

const MAX_SIZE_BY_PLAN: Record<'FREE' | 'PLUS' | 'PRO', number> = {
  FREE: 10 * 1024 * 1024,
  PLUS: 40 * 1024 * 1024,
  PRO: 150 * 1024 * 1024
};

export class FileValidationError extends Error {}

const MAGIC_BYTES: Array<{ type: 'PDF' | 'PPTX'; bytes: number[] }> = [
  { type: 'PDF', bytes: [0x25, 0x50, 0x44, 0x46] }, // %PDF
  { type: 'PPTX', bytes: [0x50, 0x4b, 0x03, 0x04] } // PK.. (zip container)
];

/** Validates by content signature, not just the client-supplied MIME/extension (item 40). */
export function validateUploadedFile(params: {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  buffer: Buffer;
  planCode: string;
}): 'PDF' | 'PPT' | 'PPTX' {
  const declaredType = ALLOWED_MIME[params.mimeType];
  if (!declaredType) {
    throw new FileValidationError('نوع الملف غير مدعوم. اسمح فقط بـ PDF أو PPT أو PPTX.');
  }

  const maxSize = MAX_SIZE_BY_PLAN[params.planCode as 'FREE' | 'PLUS' | 'PRO'] ?? MAX_SIZE_BY_PLAN.FREE;
  if (params.sizeBytes > maxSize) {
    throw new FileValidationError(`حجم الملف يتجاوز الحد المسموح لخطتك (${Math.round(maxSize / 1024 / 1024)}MB).`);
  }

  if (declaredType !== 'PPT') {
    const signature = MAGIC_BYTES.find((m) => m.type === declaredType);
    const header = Array.from(params.buffer.subarray(0, 4));
    const matches = signature?.bytes.every((b, i) => header[i] === b);
    if (!matches) {
      throw new FileValidationError('محتوى الملف لا يطابق نوعه المُعلن — قد يكون الملف تالفًا أو غير آمن.');
    }
  }

  return declaredType;
}
