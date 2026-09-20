'use client';

import { useEffect, useState } from 'react';

interface ReviewItem {
  id: string;
  flashcard: { front: string; back: string } | null;
}

/** Study Mode's "بطاقات تعليمية" tab — one flashcard at a time: try to recall → flip → rate.
 * Only ever fed flashcard-backed review items (?kind=flashcard), never a bare concept. */
export function StudyFocus() {
  const [items, setItems] = useState<ReviewItem[] | null>(null);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);

  useEffect(() => {
    fetch('/api/review/queue?kind=flashcard')
      .then((r) => r.json())
      .then((d) => setItems(d.items ?? []));
  }, []);

  async function rate(result: 'AGAIN' | 'HARD' | 'GOOD' | 'EASY') {
    const current = items?.[index];
    if (current) {
      await fetch('/api/review/queue', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ reviewItemId: current.id, result })
      });
    }
    setFlipped(false);
    setIndex((i) => i + 1);
  }

  if (!items) return <p className="text-center text-sm text-ink-400">جاري التحميل...</p>;

  if (items.length === 0 || index >= items.length) {
    return (
      <div className="rounded-xl2 border border-ink-100 bg-surface p-8 text-center shadow-card">
        <p className="mb-3 text-2xl">✅</p>
        <p className="font-bold text-ink-900">ما عندك بطاقات مستحقة مراجعة الحين.</p>
        <p className="mt-1 text-sm text-ink-500">
          حوّل أي معلومة إلى Flashcard من صفحة أي ملف، وبترجع لك هنا أول ما يحين وقت مراجعتها.
        </p>
      </div>
    );
  }

  const current = items[index]!.flashcard!; // safe: kind=flashcard guarantees this is set

  return (
    <div>
      <p className="mb-2 text-xs font-semibold text-ink-400">
        {index + 1} / {items.length}
      </p>
      <div
        onClick={() => !flipped && setFlipped(true)}
        className={
          'flex min-h-[220px] cursor-pointer flex-col items-center justify-center rounded-xl2 border p-8 text-center shadow-card transition ' +
          (flipped ? 'border-accent-200 bg-accent-50/60' : 'border-ink-100 bg-surface hover:border-accent-200')
        }
      >
        {!flipped ? (
          <>
            <p className="text-lg font-extrabold text-ink-900">{current.front}</p>
            <p className="mt-4 text-xs font-semibold text-ink-400">اضغط على البطاقة لتشوف الإجابة</p>
          </>
        ) : (
          <p className="whitespace-pre-line text-base font-bold text-ink-900">{current.back}</p>
        )}
      </div>

      {flipped && (
        <div className="mt-4 grid grid-cols-4 gap-2">
          {(
            [
              ['AGAIN', 'نسيتها'],
              ['HARD', 'صعبة'],
              ['GOOD', 'جيدة'],
              ['EASY', 'سهلة']
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => rate(key)}
              className="rounded-xl border border-ink-100 py-2 text-xs font-bold text-ink-700 hover:bg-ink-100"
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
