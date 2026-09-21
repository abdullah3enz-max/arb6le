'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

interface Question {
  id: string;
  kind: string;
  prompt: string;
  choicesJson: string[] | null;
  correctAnswer: string;
  explanation: string;
}

interface GradedAnswer {
  questionId: string;
  given: string;
  correct: boolean;
}

const KIND_LABEL: Record<string, string> = {
  MULTIPLE_CHOICE: 'اختيار متعدد',
  TRUE_FALSE: 'صح / خطأ',
  FILL_BLANK: 'تعبئة فراغ',
  SCENARIO: 'سيناريو',
  RECALL: 'استرجاع'
};

export function QuizRunner({ quizId }: { quizId: string }) {
  const [questions, setQuestions] = useState<Question[] | null>(null);
  const [title, setTitle] = useState('');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [result, setResult] = useState<{ scorePct: number; graded: GradedAnswer[] } | null>(null);

  useEffect(() => {
    fetch(`/api/quiz/${quizId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) return setLoadError(d.error);
        setTitle(d.quiz?.title ?? '');
        setQuestions(d.quiz?.questions ?? []);
      })
      .catch(() => setLoadError('فشل تحميل الاختبار.'));
  }, [quizId]);

  async function submit() {
    if (!questions || submitting) return;
    const unanswered = questions.length - Object.values(answers).filter((v) => v.trim() !== '').length;
    if (unanswered > 0 && !confirm(`ما جاوبت على ${unanswered} سؤال. تبي تسلّم على كذا؟`)) return;

    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch(`/api/quiz/${quizId}/attempt`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ answers: Object.entries(answers).map(([questionId, given]) => ({ questionId, given })) })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'فشل تسليم الإجابات.');
      setResult(data);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'خطأ غير متوقع.');
    } finally {
      setSubmitting(false);
    }
  }

  function retake() {
    setAnswers({});
    setResult(null);
    setSubmitError(null);
  }

  if (loadError) return <p className="text-sm font-semibold text-accent-600">{loadError}</p>;
  if (!questions) return <p className="text-sm text-ink-400">جاري التحميل...</p>;

  if (result) {
    const gradedMap = new Map(result.graded.map((g) => [g.questionId, g]));
    const correctCount = result.graded.filter((g) => g.correct).length;
    const emoji = result.scorePct >= 80 ? '🎉' : result.scorePct >= 50 ? '💪' : '📚';

    return (
      <div className="space-y-6">
        <div className="rounded-xl2 border border-ink-100 bg-surface p-8 text-center shadow-card">
          <p className="mb-2 text-3xl">{emoji}</p>
          <p className="text-4xl font-extrabold text-accent-600">{Math.round(result.scorePct)}%</p>
          <p className="mt-2 text-ink-600">
            {correctCount} من {questions.length} صحيحة
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <button
              onClick={retake}
              className="rounded-xl bg-accent-500 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-accent-600"
            >
              🔁 إعادة المحاولة
            </button>
            <Link
              href="/study"
              className="rounded-xl border border-ink-100 px-5 py-2.5 text-sm font-bold text-ink-700 hover:bg-ink-100"
            >
              ← رجوع لـ Study Mode
            </Link>
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-sm font-bold text-ink-900">راجع إجاباتك</h2>
          {questions.map((q, i) => {
            const g = gradedMap.get(q.id);
            const correct = g?.correct ?? false;
            const given = g?.given?.trim();
            return (
              <div
                key={q.id}
                className={
                  'rounded-xl2 border p-5 shadow-card ' +
                  (correct ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-accent-300/30 bg-accent-500/5')
                }
              >
                <div className="mb-2 flex items-center justify-between text-xs font-semibold text-ink-400">
                  <span>سؤال {i + 1}</span>
                  <span className={correct ? 'text-emerald-500' : 'text-accent-600'}>
                    {correct ? '✅ صحيحة' : '❌ غير صحيحة'}
                  </span>
                </div>
                <p className="mb-3 font-semibold text-ink-900">{q.prompt}</p>
                <p className="text-sm text-ink-600">
                  إجابتك: <span className="font-semibold text-ink-900">{given || '(بدون إجابة)'}</span>
                </p>
                {!correct && (
                  <p className="mt-1 text-sm text-emerald-500">
                    الإجابة الصحيحة: <span className="font-semibold">{q.correctAnswer}</span>
                  </p>
                )}
                {q.explanation && <p className="mt-2 text-xs leading-relaxed text-ink-500">💡 {q.explanation}</p>}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  const answeredCount = questions.filter((q) => (answers[q.id] ?? '').trim() !== '').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-extrabold text-ink-900">{title}</h1>
        <span dir="ltr" className="shrink-0 text-xs font-semibold text-ink-400">
          {answeredCount} / {questions.length}
        </span>
      </div>

      {questions.length > 0 && (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink-100">
          <div
            className="h-full rounded-full bg-accent-500 transition-all"
            style={{ width: `${(answeredCount / questions.length) * 100}%` }}
          />
        </div>
      )}

      {questions.length === 0 && (
        <p className="rounded-xl2 border border-ink-100 bg-surface p-6 text-center text-sm text-ink-400">
          هذا الاختبار ما فيه أسئلة بعد.
        </p>
      )}

      {questions.map((q, i) => (
        <div key={q.id} className="rounded-xl2 border border-ink-100 bg-surface p-5 shadow-card">
          <div className="mb-2 flex items-center justify-between text-xs font-semibold text-ink-400">
            <span>سؤال {i + 1}</span>
            <span>{KIND_LABEL[q.kind] ?? q.kind}</span>
          </div>
          <p className="mb-3 font-semibold text-ink-900">{q.prompt}</p>

          {q.kind === 'MULTIPLE_CHOICE' && q.choicesJson ? (
            <div className="space-y-2">
              {q.choicesJson.map((choice) => (
                <label
                  key={choice}
                  className="flex items-center gap-2 rounded-lg border border-ink-100 px-3 py-2 text-sm hover:bg-ink-100"
                >
                  <input
                    type="radio"
                    name={q.id}
                    checked={answers[q.id] === choice}
                    onChange={() => setAnswers((a) => ({ ...a, [q.id]: choice }))}
                  />
                  {choice}
                </label>
              ))}
            </div>
          ) : q.kind === 'TRUE_FALSE' ? (
            <div className="flex gap-2">
              {['صحيح', 'خطأ'].map((choice) => (
                <button
                  key={choice}
                  onClick={() => setAnswers((a) => ({ ...a, [q.id]: choice }))}
                  className={
                    'rounded-full border px-4 py-1.5 text-sm font-semibold ' +
                    (answers[q.id] === choice ? 'border-accent-500 bg-accent-50 text-accent-700' : 'border-ink-100 text-ink-600')
                  }
                >
                  {choice}
                </button>
              ))}
            </div>
          ) : q.kind === 'SCENARIO' ? (
            <textarea
              rows={3}
              value={answers[q.id] ?? ''}
              onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
              className="w-full resize-none rounded-lg border border-ink-100 bg-surface px-3 py-2 text-sm text-ink-900 outline-none placeholder:text-ink-400 focus:border-accent-500"
              placeholder="اشرح إجابتك..."
            />
          ) : (
            <input
              value={answers[q.id] ?? ''}
              onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
              className="w-full rounded-lg border border-ink-100 bg-surface px-3 py-2 text-sm text-ink-900 outline-none placeholder:text-ink-400 focus:border-accent-500"
              placeholder="إجابتك..."
            />
          )}
        </div>
      ))}

      {submitError && <p className="text-sm font-semibold text-accent-600">{submitError}</p>}

      <button
        onClick={submit}
        disabled={submitting || questions.length === 0}
        className="w-full rounded-xl bg-accent-500 py-3 text-sm font-bold text-white transition hover:bg-accent-600 disabled:opacity-50"
      >
        {submitting ? 'جاري التسليم...' : 'سلّم الإجابات'}
      </button>
    </div>
  );
}
