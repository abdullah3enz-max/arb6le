'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ProcessingSteps } from './ProcessingSteps';

interface DocRow {
  id: string;
  fileName: string;
  fileType: string;
  status: string;
  pageCount: number | null;
  createdAt: string;
  errorMessage: string | null;
}

export function DocumentList() {
  const [docs, setDocs] = useState<DocRow[] | null>(null);
  const [retrying, setRetrying] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  async function load() {
    const res = await fetch('/api/documents');
    const data = await res.json();
    setDocs(data.documents ?? []);
  }

  useEffect(() => {
    load();
    const interval = setInterval(() => {
      setDocs((current) => {
        // Keep polling through FAILED too, so a "retry" click (which flips a document back to
        // a working stage) is picked up automatically without restarting this interval.
        if (current && current.every((d) => d.status === 'READY')) {
          clearInterval(interval);
          return current;
        }
        load();
        return current;
      });
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  async function retry(e: React.MouseEvent, id: string) {
    e.preventDefault();
    e.stopPropagation();
    setRetrying(id);
    try {
      await fetch(`/api/documents/${id}/retry`, { method: 'POST' });
      await load();
    } finally {
      setRetrying(null);
    }
  }

  async function remove(e: React.MouseEvent, id: string, fileName: string) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`تحذف "${fileName}" نهائيًا؟ بيروح معه كل المفاهيم والروابط والاختبارات المرتبطة فيه.`)) return;
    setDeleting(id);
    try {
      await fetch(`/api/documents/${id}`, { method: 'DELETE' });
      await load();
    } finally {
      setDeleting(null);
    }
  }

  if (!docs) return <p className="text-sm text-ink-400">جاري التحميل...</p>;
  if (docs.length === 0) return <p className="text-sm text-ink-400">لسه ما رفعت شي. ارفع أول سلايد لك فوق ⬆️</p>;

  return (
    <div className="space-y-3">
      {docs.map((doc) => (
        <Link
          key={doc.id}
          href={`/documents/${doc.id}`}
          className="block rounded-xl2 border border-ink-100 bg-surface p-4 shadow-card transition hover:border-accent-200"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate font-bold text-ink-900">{doc.fileName}</p>
              <p className="text-xs text-ink-400">
                {doc.fileType} {doc.pageCount ? `· ${doc.pageCount} صفحة` : ''}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <span className="text-xs font-semibold text-ink-400">{new Date(doc.createdAt).toLocaleDateString('ar-SA')}</span>
              <button
                onClick={(e) => remove(e, doc.id, doc.fileName)}
                disabled={deleting === doc.id}
                aria-label="حذف الملف"
                title="حذف الملف"
                className="rounded-full p-1.5 text-ink-400 transition hover:bg-accent-50 hover:text-accent-500 disabled:opacity-50"
              >
                {deleting === doc.id ? '...' : '🗑️'}
              </button>
            </div>
          </div>
          {doc.status !== 'READY' && doc.status !== 'FAILED' && (
            <div className="mt-3 border-t border-ink-100 pt-3">
              <ProcessingSteps status={doc.status} />
            </div>
          )}
          {doc.status === 'FAILED' && (
            <div className="mt-3 flex items-center justify-between gap-3 border-t border-ink-100 pt-3">
              <p className="text-sm font-semibold text-accent-600">حصل خطأ في المعالجة.</p>
              <button
                onClick={(e) => retry(e, doc.id)}
                disabled={retrying === doc.id}
                className="shrink-0 rounded-full bg-accent-500 px-4 py-1.5 text-xs font-bold text-white transition hover:bg-accent-600 disabled:opacity-50"
              >
                {retrying === doc.id ? 'جاري المحاولة...' : '🔄 أعد المحاولة'}
              </button>
            </div>
          )}
        </Link>
      ))}
    </div>
  );
}
