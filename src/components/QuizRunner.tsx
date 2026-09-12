'use client';

import { useEffect, useState } from 'react';

interface Question {
  id: string;
  kind: string;
  prompt: string;
  choicesJson: string[] | null;
  correctAnswer: string;
  explanation: string;
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
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<{ scorePct: number; graded: { questionId: string; correct: boolean }[] } | null>(null);

  useEffect(() => {
    fetch(`/api/quiz/${quizId}`)
      .then((r) => r.json())
      .then((d) => {
        setTitle(d.quiz?.title ?? '');
        setQuestions(d.quiz?.questions ?? []);
      });
  }, [quizId]);

  async function submit() {
    const res = await fetch(`/api/quiz/${quizId}/attempt`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ answers: Object.entries(answers).map(([questionId, given]) => ({ questionId, given })) })
    });
    const data = await res.json();
    setResult(data);
  }

  if (!questions) return <p className="text-sm text-ink-400">جاري التحميل...</p>;

  if (result) {
    return (
      <div className="rounded-xl2 border border-ink-100 bg-white p-8 text-center shadow-card">
        <p className="text-4xl font-extrabold text-accent-600">{Math.round(result.scorePct)}%</p>
        <p className="mt-2 text-ink-600">
          {result.graded.filter((g) => g.correct).length} من {result.graded.length} صحيحة
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-extrabold text-ink-900">{title}</h1>
      {questions.map((q, i) => (
        <div key={q.id} className="rounded-xl2 border border-ink-100 bg-white p-5 shadow-card">
          <div className="mb-2 flex items-center justify-between text-xs font-semibold text-ink-400">
            <span>سؤال {i + 1}</span>
            <span>{KIND_LABEL[q.kind] ?? q.kind}</span>
          </div>
          <p className="mb-3 font-semibold text-ink-900">{q.prompt}</p>

          {q.kind === 'MULTIPLE_CHOICE' && q.choicesJson ? (
            <div className="space-y-2">
              {q.choicesJson.map((choice) => (
                <label key={choice} className="flex items-center gap-2 rounded-lg border border-ink-100 px-3 py-2 text-sm hover:bg-ink-50">
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
          ) : (
            <input
              value={answers[q.id] ?? ''}
              onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
              className="w-full rounded-lg border border-ink-100 px-3 py-2 text-sm outline-none focus:border-accent-500"
              placeholder="إجابتك..."
            />
          )}
        </div>
      ))}
      <button onClick={submit} className="w-full rounded-xl bg-ink-900 py-3 text-sm font-bold text-white hover:bg-ink-800">
        سلّم الإجابات
      </button>
    </div>
  );
}
