import type { OcrProvider } from './types';

/**
 * OCR interface. Default is a no-op that returns an empty string and lets the caller
 * (documentParser agent) flag the page as `usedOcr: true, rawText: ''` rather than pretending
 * text was extracted. Swap in a real Tesseract.js / cloud-vision adapter here — the pipeline
 * only depends on this interface.
 */
class NoopOcrProvider implements OcrProvider {
  readonly name = 'noop';
  async recognize(): Promise<string> {
    return '';
  }
}

export function getOcrProvider(): OcrProvider {
  const provider = process.env.OCR_PROVIDER ?? 'tesseract';
  if (provider === 'tesseract' && !process.env.OCR_API_KEY) {
    // tesseract.js can run fully local without a key; left as a TODO integration point
    // so this scaffold has no heavy native dependency by default.
    return new NoopOcrProvider();
  }
  return new NoopOcrProvider();
}
