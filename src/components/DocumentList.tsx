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

const DONE_STATES = new Set(['READY', 'FAILED']);

export function DocumentList() {
  const [docs, setDocs] = useState<DocRow[] | null>(null);

  async function load() {
    const res = await fetch('/api/documents');
    const data = await res.json();
    setDocs(data.documents ?? []);
  }

  useEffect(() => {
    load();
    const interval = setInterval(() => {
      setDocs((current) => {
        if (current && current.every((d) => DONE_STATES.has(d.status))) {
          clearInterval(interval);
          return current;
        }
        load();
        return current;
      });
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  if (!docs) return <p className="text-sm text-ink-400">جاري التحميل...</p>;
  if (docs.length === 0) return <p className="text-sm text-ink-400">لسه ما رفعت شي. ارفع أول سلايد لك فوق ⬆️</p>;

  return (
    <div className="space-y-3">
      {docs.map((doc) => (
        <Link
          key={doc.id}
          href={`/documents/${doc.id}`}
          className="block rounded-xl2 border border-ink-100 bg-white p-4 shadow-card transition hover:border-accent-200"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="font-bold text-ink-900">{doc.fileName}</p>
              <p className="text-xs text-ink-400">
                {doc.fileType} {doc.pageCount ? `· ${doc.pageCount} صفحة` : ''}
              </p>
            </div>
            <span className="text-xs font-semibold text-ink-400">{new Date(doc.createdAt).toLocaleDateString('ar-SA')}</span>
          </div>
          {doc.status !== 'READY' && (
            <div className="mt-3 border-t border-ink-100 pt-3">
              <ProcessingSteps status={doc.status} />
            </div>
          )}
        </Link>
      ))}
    </div>
  );
}
