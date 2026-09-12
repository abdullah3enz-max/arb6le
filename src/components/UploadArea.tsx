'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';

export function UploadArea() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  async function upload(file: File) {
    setError(null);
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/documents', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'فشل رفع الملف.');
      router.push(`/documents/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطأ غير متوقع.');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const file = e.dataTransfer.files[0];
          if (file) upload(file);
        }}
        onClick={() => inputRef.current?.click()}
        className={
          'flex cursor-pointer flex-col items-center justify-center rounded-xl2 border-2 border-dashed px-6 py-12 text-center transition ' +
          (dragging ? 'border-accent-500 bg-accent-50' : 'border-ink-100 bg-white hover:bg-ink-50')
        }
      >
        <div className="mb-3 text-3xl">📄</div>
        <p className="mb-1 font-bold text-ink-900">{uploading ? 'جاري الرفع...' : 'ارفع سلايداتك'}</p>
        <p className="text-sm text-ink-500">PDF · PPT · PPTX — أو اسحب الملف هنا</p>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.ppt,.pptx"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) upload(file);
          }}
        />
      </div>
      {error && <p className="mt-2 text-sm font-semibold text-accent-600">{error}</p>}
    </div>
  );
}
