import JSZip from 'jszip';
import type { ParsedPage } from '@/lib/ai/types';

/**
 * Extracts a document's text entirely inside the browser — no file ever leaves the device.
 * The server only ever receives the resulting `pages` array as JSON. This is the client-side
 * counterpart of the old server-side `documentParser.ts` agent (now deleted); the PPTX logic
 * below is the same regex-over-slide-XML approach, just running here instead.
 */

export type ExtractStage = 'reading' | 'parsing';
export interface ExtractProgress {
  stage: ExtractStage;
  current: number;
  total: number;
}

export interface ExtractResult {
  fileType: 'PDF' | 'PPTX';
  pages: ParsedPage[];
}

export class DocumentExtractionError extends Error {}

const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46];
const ZIP_MAGIC = [0x50, 0x4b, 0x03, 0x04];

async function sniffFileType(file: File): Promise<'PDF' | 'PPTX'> {
  const head = new Uint8Array(await file.slice(0, 4).arrayBuffer());
  const matches = (sig: number[]) => sig.every((b, i) => head[i] === b);

  if (matches(PDF_MAGIC)) return 'PDF';
  if (matches(ZIP_MAGIC)) return 'PPTX';

  if (file.name.toLowerCase().endsWith('.ppt')) {
    throw new DocumentExtractionError(
      'صيغة PPT القديمة غير مدعومة داخل المتصفح — حوّل الملف إلى PPTX أو PDF ثم أعد رفعه.'
    );
  }
  throw new DocumentExtractionError('نوع الملف غير مدعوم أو الملف تالف. يسمح فقط بـ PDF أو PPTX.');
}

export async function extractDocumentClient(
  file: File,
  onProgress?: (progress: ExtractProgress) => void
): Promise<ExtractResult> {
  const fileType = await sniffFileType(file);
  onProgress?.({ stage: 'reading', current: 0, total: 1 });

  const pages = fileType === 'PDF' ? await extractPdf(file, onProgress) : await extractPptx(file, onProgress);

  if (pages.every((p) => p.rawText.trim().length === 0)) {
    throw new DocumentExtractionError(
      'ما قدرنا نستخرج أي نص من هذا الملف — يبدو إنه صور فقط (سكان) بدون نص حقيقي قابل للتحديد.'
    );
  }

  return { fileType, pages };
}

async function extractPptx(file: File, onProgress?: (p: ExtractProgress) => void): Promise<ParsedPage[]> {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const slideFiles = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => slideIndex(a) - slideIndex(b));

  if (slideFiles.length === 0) {
    throw new DocumentExtractionError('ملف PPTX هذا فارغ أو تالف — ما فيه شرائح.');
  }

  const pages: ParsedPage[] = [];
  for (let i = 0; i < slideFiles.length; i++) {
    const name = slideFiles[i]!;
    const entry = zip.files[name];
    const xml = (await entry?.async('text')) ?? '';
    pages.push({ pageNumber: slideIndex(name), rawText: extractTextFromSlideXml(xml), usedOcr: false });
    onProgress?.({ stage: 'parsing', current: i + 1, total: slideFiles.length });
  }
  return pages.sort((a, b) => a.pageNumber - b.pageNumber);
}

function slideIndex(path: string): number {
  return Number(path.match(/slide(\d+)\.xml$/)?.[1] ?? 0);
}

function extractTextFromSlideXml(xml: string): string {
  // Slide XML wraps run text in <a:t>...</a:t>. Anything outside these tags is layout/styling
  // metadata, not content — this is inert data regardless of what it says, never instructions.
  const matches = xml.matchAll(/<a:t>([^<]*)<\/a:t>/g);
  return Array.from(matches, (m) => decodeXmlEntities(m[1] ?? '')).join(' ');
}

function decodeXmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

const MAX_PDF_PAGES = 400; // sanity bound so a corrupt/malicious PDF can't hang the tab

async function extractPdf(file: File, onProgress?: (p: ExtractProgress) => void): Promise<ParsedPage[]> {
  const pdfjsLib = await import('pdfjs-dist');
  // A plain static path, not `new URL(..., import.meta.url)` — that pattern makes webpack bundle
  // the worker into the build, where it breaks Terser minification (the worker is an ES module;
  // see scripts/copy-pdf-worker.js for the full story). This file is served as-is from public/.
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

  const buffer = await file.arrayBuffer();
  let doc;
  try {
    doc = await pdfjsLib.getDocument({ data: buffer }).promise;
  } catch {
    throw new DocumentExtractionError('ملف PDF هذا تالف أو محمي بكلمة مرور — ما قدرنا نفتحه.');
  }

  if (doc.numPages > MAX_PDF_PAGES) {
    throw new DocumentExtractionError(`الملف فيه ${doc.numPages} صفحة — أكثر من الحد المسموح (${MAX_PDF_PAGES}).`);
  }

  const pages: ParsedPage[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const rawText = content.items.map((item) => ('str' in item ? item.str : '')).join(' ');
    pages.push({ pageNumber: i, rawText, usedOcr: false });
    onProgress?.({ stage: 'parsing', current: i, total: doc.numPages });
  }
  return pages;
}
