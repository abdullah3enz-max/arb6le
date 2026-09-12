import JSZip from 'jszip';
import { getOcrProvider } from '@/lib/ai/providers/ocr';
import type { ParsedPage } from '@/lib/ai/types';

/**
 * STEP 1 (Extract document) + STEP 2 (OCR if needed) of the pipeline.
 * Real text extraction — no LLM call here on purpose (cheap, deterministic, cacheable by hash).
 */
export async function parseDocument(fileBuffer: Buffer, fileType: 'PDF' | 'PPT' | 'PPTX'): Promise<ParsedPage[]> {
  if (fileType === 'PDF') return parsePdf(fileBuffer);
  if (fileType === 'PPTX') return parsePptx(fileBuffer);
  throw new Error(
    'Legacy .PPT (binary OLE format) requires a native converter (e.g. LibreOffice headless) not bundled ' +
      'in this scaffold. Convert to .PPTX or .PDF before upload, or wire a converter here.'
  );
}

async function parsePdf(buffer: Buffer): Promise<ParsedPage[]> {
  const pdfParse = (await import('pdf-parse')).default;
  const pages: ParsedPage[] = [];

  const data = await pdfParse(buffer, {
    pagerender: async (pageData: {
      getTextContent: () => Promise<{ items: { str: string }[] }>;
    }) => {
      const content = await pageData.getTextContent();
      const text = content.items.map((item) => item.str).join(' ');
      pages.push({ pageNumber: pages.length + 1, rawText: text, usedOcr: false });
      return text;
    }
  });

  if (pages.length === 0 && data.text) {
    // Fallback: pagerender hook unsupported by this pdf-parse build — split on form-feed.
    data.text
      .split('\f')
      .forEach((text: string, i: number) => pages.push({ pageNumber: i + 1, rawText: text, usedOcr: false }));
  }

  const ocr = getOcrProvider();
  for (const page of pages) {
    if (page.rawText.trim().length === 0) {
      // Scanned/image-only page — real OCR would run on the rendered page image here.
      // This scaffold's default OcrProvider is a no-op; wire pdf-to-image + a real OCR
      // adapter (see docs/ARCHITECTURE.md §10) to fill this in for production.
      page.rawText = await ocr.recognize(Buffer.alloc(0));
      page.usedOcr = true;
    }
  }

  return pages;
}

async function parsePptx(buffer: Buffer): Promise<ParsedPage[]> {
  const zip = await JSZip.loadAsync(buffer);
  const slideFiles = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => slideIndex(a) - slideIndex(b));

  const pages: ParsedPage[] = [];
  for (const name of slideFiles) {
    const entry = zip.files[name];
    if (!entry) continue;
    const xml = await entry.async('text');
    const rawText = extractTextFromSlideXml(xml);
    pages.push({ pageNumber: slideIndex(name), rawText, usedOcr: false });
  }
  return pages;
}

function slideIndex(path: string): number {
  return Number(path.match(/slide(\d+)\.xml$/)?.[1] ?? 0);
}

function extractTextFromSlideXml(xml: string): string {
  // Slide XML wraps run text in <a:t>...</a:t>. Anything outside these tags is layout/
  // styling metadata, not content — and per item 42, all of it is treated as inert data
  // regardless of what it says, never as instructions to the pipeline.
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
