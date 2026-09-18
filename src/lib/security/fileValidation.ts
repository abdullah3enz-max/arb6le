const ALLOWED_TYPES = ['PDF', 'PPTX'] as const;
type AllowedType = (typeof ALLOWED_TYPES)[number];
type PlanCode = 'FREE' | 'PLUS' | 'PRO';

// Text is extracted in the browser (see src/lib/client/extractDocument.ts) — the server never
// receives raw file bytes, so plan limits are expressed in the thing that actually drives cost
// here (pages / extracted text volume feeding the LLM pipeline) instead of file megabytes.
const MAX_PAGES_BY_PLAN: Record<PlanCode, number> = {
  FREE: 60,
  PLUS: 150,
  PRO: 400
};

const MAX_CHARS_BY_PLAN: Record<PlanCode, number> = {
  FREE: 300_000,
  PLUS: 800_000,
  PRO: 2_000_000
};

export class FileValidationError extends Error {}

export interface ExtractedPageInput {
  pageNumber: number;
  rawText: string;
  usedOcr?: boolean;
}

/**
 * Validates a document's already-extracted text (item: no raw file ever reaches the server).
 * The browser's pdf.js/JSZip parsers already threw if the file wasn't a real PDF/PPTX, so this
 * only guards plan limits and payload shape — not file-content sniffing.
 */
export function validateExtractedDocument(params: {
  fileType: unknown;
  pages: unknown;
  planCode: string;
}): AllowedType {
  if (typeof params.fileType !== 'string' || !ALLOWED_TYPES.includes(params.fileType as AllowedType)) {
    throw new FileValidationError('نوع الملف غير مدعوم. يسمح فقط بـ PDF أو PPTX.');
  }
  if (!Array.isArray(params.pages) || params.pages.length === 0) {
    throw new FileValidationError('ما وصل أي نص مستخرج من الملف.');
  }

  const pages = params.pages as ExtractedPageInput[];
  for (const page of pages) {
    if (!page || typeof page.pageNumber !== 'number' || typeof page.rawText !== 'string') {
      throw new FileValidationError('بيانات الملف المستخرجة غير صالحة.');
    }
  }

  const plan: PlanCode = params.planCode in MAX_PAGES_BY_PLAN ? (params.planCode as PlanCode) : 'FREE';

  const maxPages = MAX_PAGES_BY_PLAN[plan];
  if (pages.length > maxPages) {
    throw new FileValidationError(`عدد الصفحات (${pages.length}) يتجاوز الحد المسموح لخطتك (${maxPages} صفحة).`);
  }

  const totalChars = pages.reduce((sum, p) => sum + p.rawText.length, 0);
  const maxChars = MAX_CHARS_BY_PLAN[plan];
  if (totalChars > maxChars) {
    throw new FileValidationError('حجم النص المستخرج كبير جدًا لخطتك الحالية — رقّي خطتك أو قسّم الملف.');
  }

  return params.fileType as AllowedType;
}
