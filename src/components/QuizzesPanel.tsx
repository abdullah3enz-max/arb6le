'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

interface QuizRow {
  id: string;
  title: string;
  documentName: string;
  questionCount: number;
  lastAttempt: { scorePct: number; startedAt: string } | null;
}

/** Study Mode's "اختبارات" tab — every quiz the user has across all documents, with a shortcut
 * back into the existing QuizRunner at /quiz/[id] and the last score when one exists. */
export function QuizzesPanel() {
  const [quizzes, setQuizzes] = useState<QuizRow[] | null>(null);

  useEffect(() => {
    fetch('/api/quiz')
      .then((r) => r.json())
      .then((d) => setQuizzes(d.quizzes ?? []));
  }, []);

  if (!quizzes) return <p className="text-center text-sm text-ink-400">جاري التحميل...</p>;

  if (quizzes.length === 0) {
    return (
      <div className="rounded-xl2 border border-ink-100 bg-surface p-8 text-center shadow-card">
        <p className="mb-3 text-2xl">📝</p>
        <p className="font-bold text-ink-900">ما عندك اختبارات لسه.</p>
        <p className="mt-1 text-sm text-ink-500">كل ملف ترفعه يولّد لك اختبار تلقائي بعد ما يخلص المعالجة.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {quizzes.map((q) => (
        <Link
          key={q.id}
          href={`/quiz/${q.id}`}
          className="block rounded-xl2 border border-ink-100 bg-surface p-4 shadow-card transition hover:border-accent-200"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate font-bold text-ink-900">{q.title}</p>
              <p className="truncate text-xs text-ink-400">
                {q.documentName} · {q.questionCount} سؤال
              </p>
            </div>
            {q.lastAttempt ? (
              <span className="shrink-0 rounded-full bg-accent-50 px-3 py-1 text-xs font-bold text-accent-600">
                آخر نتيجة {Math.round(q.lastAttempt.scorePct)}%
              </span>
            ) : (
              <span className="shrink-0 rounded-full bg-ink-100 px-3 py-1 text-xs font-bold text-ink-500">جديد</span>
            )}
          </div>
        </Link>
      ))}
    </div>
  );
}
