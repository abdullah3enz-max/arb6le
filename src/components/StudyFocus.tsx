'use client';

import { useEffect, useState } from 'react';

interface ReviewItem {
  id: string;
  flashcard: { front: string; back: string; concept: { document: { fileName: string } } } | null;
}

/** Study Mode's "بطاقات تعليمية" tab — browse freely (◀ ▶ or arrow keys), flip a card by
 * clicking it or pressing space, and optionally rate it for spaced repetition. Rating is no
 * longer the only way to move on — a student can just read through the queue too.
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

  const total = items?.length ?? 0;

  function goTo(next: number) {
    setIndex(Math.max(0, Math.min(next, total)));
    setFlipped(false);
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!items || items.length === 0) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      // RTL layout: "previous" sits visually on the right, "next" on the left (see the button
      // order below), so the arrow keys follow screen position, not reading direction.
      if (e.key === 'ArrowRight') goTo(index - 1);
      else if (e.key === 'ArrowLeft') goTo(index + 1);
      else if (e.key === ' ' || e.key === 'Enter') {
        if (index < total) {
          e.preventDefault();
          setFlipped((f) => !f);
        }
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, index, total]);

  async function rate(result: 'AGAIN' | 'HARD' | 'GOOD' | 'EASY') {
    const current = items?.[index];
    if (current) {
      await fetch('/api/review/queue', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ reviewItemId: current.id, result })
      });
    }
    goTo(index + 1);
  }

  if (!items) return <p className="text-center text-sm text-ink-400">جاري التحميل...</p>;

  if (items.length === 0) {
    return (
      <div className="rounded-xl2 border border-ink-100 bg-surface p-8 text-center shadow-card">
        <p className="mb-3 text-2xl">✅</p>
        <p className="font-bold text-ink-900">ما عندك بطاقات مستحقة مراجعة الحين.</p>
        <p className="mt-1 text-sm text-ink-500">
          كل معلومة ترفعها تتحول بطاقة تلقائيًا — وبترجع لك هنا أول ما يحين وقت مراجعتها.
        </p>
      </div>
    );
  }

  if (index >= items.length) {
    return (
      <div className="rounded-xl2 border border-ink-100 bg-surface p-8 text-center shadow-card">
        <p className="mb-3 text-2xl">🎉</p>
        <p className="font-bold text-ink-900">خلصت كل البطاقات المستحقة الحين!</p>
        <div className="mt-4 flex justify-center gap-2">
          <button
            onClick={() => goTo(items.length - 1)}
            className="rounded-xl border border-ink-100 px-4 py-2 text-sm font-bold text-ink-700 hover:bg-ink-100"
          >
            ◀ رجوع لآخر بطاقة
          </button>
          <button
            onClick={() => goTo(0)}
            className="rounded-xl bg-accent-500 px-4 py-2 text-sm font-bold text-white hover:bg-accent-600"
          >
            🔁 مراجعة من البداية
          </button>
        </div>
      </div>
    );
  }

  const current = items[index]!.flashcard!; // safe: kind=flashcard guarantees this is set

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p dir="ltr" className="text-xs font-semibold text-ink-400">
          {index + 1} / {items.length}
        </p>
        <p className="truncate text-xs font-semibold text-ink-400">📄 {current.concept.document.fileName}</p>
      </div>

      <div className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-ink-100">
        <div
          className="h-full rounded-full bg-accent-500 transition-all"
          style={{ width: `${((index + 1) / items.length) * 100}%` }}
        />
      </div>

      <div
        onClick={() => setFlipped((f) => !f)}
        className={
          'flex min-h-[220px] cursor-pointer flex-col items-center justify-center rounded-xl2 border p-8 text-center shadow-card transition ' +
          (flipped ? 'border-accent-200 bg-accent-50/60' : 'border-ink-100 bg-surface hover:border-accent-200')
        }
      >
        {!flipped ? (
          <>
            <p className="text-lg font-extrabold text-ink-900">{current.front}</p>
            <p className="mt-4 text-xs font-semibold text-ink-400">اضغط على البطاقة (أو مسافة) لتشوف الإجابة</p>
          </>
        ) : (
          <p className="whitespace-pre-line text-base font-bold text-ink-900">{current.back}</p>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <button
          onClick={() => goTo(index - 1)}
          disabled={index === 0}
          className="rounded-xl border border-ink-100 px-4 py-2.5 text-sm font-bold text-ink-700 hover:bg-ink-100 disabled:opacity-30"
        >
          ▶ السابقة
        </button>
        <button
          onClick={() => setFlipped((f) => !f)}
          className="rounded-xl border border-ink-100 px-4 py-2.5 text-xs font-semibold text-ink-500 hover:bg-ink-100"
        >
          🔄 قلب البطاقة
        </button>
        <button
          onClick={() => goTo(index + 1)}
          className="rounded-xl border border-ink-100 px-4 py-2.5 text-sm font-bold text-ink-700 hover:bg-ink-100"
        >
          التالية ◀
        </button>
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
