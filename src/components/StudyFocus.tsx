'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

interface ReviewItem {
  id: string;
  concept: {
    title: string;
    summary: string;
    connections: { relationExplain: string; memoryHook: string; worldRef: string }[];
  } | null;
  flashcard: { front: string; back: string } | null;
}

/** Item 23: Study Mode — no distractions, one item at a time: info → try to recall → reveal → rate. */
export function StudyFocus() {
  const [items, setItems] = useState<ReviewItem[] | null>(null);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    fetch('/api/review/queue')
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
    setRevealed(false);
    setIndex((i) => i + 1);
  }

  if (!items) return <p className="text-center text-sm text-ink-400">جاري التحميل...</p>;

  if (items.length === 0 || index >= items.length) {
    return (
      <div className="text-center">
        <p className="mb-3 text-2xl">✅</p>
        <p className="mb-6 font-bold text-ink-900">ما عليك مراجعات الحين — رجعنا لك أي شي مستحق مراجعة تلقائيًا.</p>
        <Link href="/dashboard" className="text-sm font-semibold text-accent-600">
          رجوع للرئيسية
        </Link>
      </div>
    );
  }

  const current = items[index]!; // safe: guarded by the `index >= items.length` check above
  const title = current.concept?.title ?? current.flashcard?.front ?? '';
  const connection = current.concept?.connections?.[0];

  return (
    <div className="rounded-xl2 border border-ink-100 bg-white p-8 shadow-card">
      <p className="mb-1 text-xs font-semibold text-ink-400">
        {index + 1} / {items.length}
      </p>
      <h1 className="mb-6 text-xl font-extrabold text-ink-900">{title}</h1>

      {!revealed ? (
        <>
          <p className="mb-6 text-sm text-ink-500">وش الرابط؟ حاول تتذكره قبل ما نعرضه لك.</p>
          <button onClick={() => setRevealed(true)} className="w-full rounded-xl bg-ink-900 py-3 text-sm font-bold text-white hover:bg-ink-800">
            أظهر الرابط
          </button>
        </>
      ) : (
        <>
          <div className="mb-6 rounded-xl bg-accent-50/60 p-4 text-sm text-ink-800">
            {connection ? (
              <>
                <p className="mb-1 font-bold text-accent-700">{connection.worldRef}</p>
                <p>{connection.memoryHook}</p>
              </>
            ) : (
              <p>{current.concept?.summary ?? current.flashcard?.back}</p>
            )}
          </div>
          <div className="grid grid-cols-4 gap-2">
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
                className="rounded-xl border border-ink-100 py-2 text-xs font-bold text-ink-700 hover:bg-ink-50"
              >
                {label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
