'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import {
  extractDocumentClient,
  DocumentExtractionError,
  type ExtractProgress,
  type ExtractResult
} from '@/lib/client/extractDocument';

type Phase = 'idle' | 'ready' | 'extracting' | 'extracted' | 'uploading';

export function UploadArea() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [phase, setPhase] = useState<Phase>('idle');
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<ExtractProgress | null>(null);
  const [result, setResult] = useState<ExtractResult | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function pickFile(f: File) {
    setError(null);
    setResult(null);
    setShowPreview(false);
    setFile(f);
    setPhase('ready');
  }

  function reset() {
    setFile(null);
    setResult(null);
    setError(null);
    setPhase('idle');
    if (inputRef.current) inputRef.current.value = '';
  }

  async function extract() {
    if (!file) return;
    setError(null);
    setPhase('extracting');
    setProgress({ stage: 'reading', current: 0, total: 1 });
    try {
      const res = await extractDocumentClient(file, setProgress);
      setResult(res);
      setPhase('extracted');
    } catch (err) {
      setError(err instanceof DocumentExtractionError ? err.message : 'ما قدرنا نقرأ هذا الملف — جرّب ملف ثاني.');
      setPhase('ready');
    } finally {
      setProgress(null);
    }
  }

  async function confirmUpload() {
    if (!file || !result) return;
    setError(null);
    setPhase('uploading');
    try {
      const res = await fetch('/api/documents', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ fileName: file.name, fileType: result.fileType, pages: result.pages })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'فشل رفع الملف.');
      router.push(`/documents/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطأ غير متوقع.');
      setPhase('extracted');
    }
  }

  const totalWords =
    result?.pages.reduce((sum, p) => sum + (p.rawText.trim() ? p.rawText.trim().split(/\s+/).length : 0), 0) ?? 0;
  const pct = progress && progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;

  return (
    <div>
      {phase === 'idle' && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const f = e.dataTransfer.files[0];
            if (f) pickFile(f);
          }}
          onClick={() => inputRef.current?.click()}
          className={
            'flex cursor-pointer flex-col items-center justify-center rounded-xl2 border-2 border-dashed px-6 py-12 text-center transition ' +
            (dragging ? 'border-accent-500 bg-accent-50' : 'border-ink-100 bg-surface hover:bg-ink-100')
          }
        >
          <div className="mb-3 text-3xl">📄</div>
          <p className="mb-1 font-bold text-ink-900">ارفع سلايداتك</p>
          <p className="text-sm text-ink-500">PDF · PPTX — أو اسحب الملف هنا</p>
          <p className="mt-3 text-xs text-ink-400">🔒 يُقرأ الملف داخل متصفحك فقط — ما يوصل لأي سيرفر</p>
        </div>
      )}

      {phase !== 'idle' && file && (
        <div className="rounded-xl2 border border-ink-100 bg-surface p-6 shadow-card">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="font-bold text-ink-900">{file.name}</p>
              <p className="text-xs text-ink-400">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
            </div>
            {(phase === 'ready' || phase === 'extracted') && (
              <button onClick={reset} className="text-xs font-semibold text-ink-400 hover:text-accent-600">
                ✕ إلغاء
              </button>
            )}
          </div>

          {phase === 'ready' && (
            <button
              onClick={extract}
              className="w-full rounded-full bg-accent-500 px-5 py-3 text-sm font-bold text-white transition hover:bg-accent-600"
            >
              🔍 استخرج النص الآن
            </button>
          )}

          {phase === 'extracting' && (
            <div>
              <p className="mb-2 text-sm font-semibold text-ink-700">
                {progress?.stage === 'reading' ? 'جاري فتح الملف...' : 'جاري قراءة النص داخل متصفحك...'}
                {progress && progress.total > 1 ? ` (صفحة ${progress.current} من ${progress.total})` : ''}
              </p>
              <div className="h-2 w-full overflow-hidden rounded-full bg-ink-100">
                <div className="h-full bg-accent-500 transition-all duration-200" style={{ width: `${pct}%` }} />
              </div>
            </div>
          )}

          {phase === 'extracted' && result && (
            <div className="space-y-4">
              <div className="rounded-xl border border-green-100 bg-green-50/60 p-4">
                <p className="font-bold text-green-800">✅ تم استخراج النص بنجاح</p>
                <p className="mt-1 text-sm text-green-700">
                  {result.pages.length} صفحة · تقريبًا {totalWords.toLocaleString('ar-SA')} كلمة
                </p>
                <button onClick={() => setShowPreview((v) => !v)} className="mt-2 text-xs font-semibold text-green-700 underline">
                  {showPreview ? '▲ إخفاء المعاينة' : '▼ معاينة النص المستخرج'}
                </button>
                {showPreview && (
                  <div className="scrollbar-thin mt-3 max-h-48 space-y-2 overflow-y-auto rounded-lg bg-white/60 p-3 text-xs text-ink-600">
                    {result.pages.slice(0, 5).map((p) => (
                      <p key={p.pageNumber}>
                        <span className="font-bold">صفحة {p.pageNumber}:</span> {p.rawText.slice(0, 140) || '(بدون نص)'}
                        {p.rawText.length > 140 ? '...' : ''}
                      </p>
                    ))}
                  </div>
                )}
              </div>
              <button
                onClick={confirmUpload}
                className="w-full rounded-full bg-accent-500 px-5 py-3 text-sm font-bold text-white transition hover:bg-accent-600"
              >
                🔗 ابدأ الربط الآن
              </button>
            </div>
          )}

          {phase === 'uploading' && <p className="text-sm font-semibold text-ink-700">جاري إرسال النص وبدء الربط...</p>}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.pptx"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) pickFile(f);
        }}
      />
      {error && <p className="mt-2 text-sm font-semibold text-accent-600">{error}</p>}
    </div>
  );
}
