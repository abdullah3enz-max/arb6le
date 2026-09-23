'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { ProcessingSteps } from './ProcessingSteps';
import { ConnectionCard, type ConnectionCardData } from './ConnectionCard';
import { TiltCard } from './TiltCard';

const WORLD_EMOJI: Record<string, string> = {
  SERIES: '📺',
  MOVIES: '🎬',
  FOOTBALL: '⚽',
  GAMES: '🎮',
  ANIME: '🇯🇵',
  CARS: '🚗',
  MUSIC: '🎵',
  PEOPLE: '👤',
  CHARACTERS: '🦸',
  BOOKS: '📚',
  DAILY_LIFE: '☀️',
  GENERAL_KNOWLEDGE: '🌍'
};

interface ConnectionRow {
  id: string;
  associationLevel: string;
  worldCategory: string;
  worldRef: string;
  atomEmoji: string;
  atomLabel: string;
  bridgeLine: string;
  whyOneLiner: string;
  claimType: 'FACT' | 'ANALOGY' | 'INTERPRETATION';
  score: number;
  sources: { title: string | null; sourceType: string }[];
}

interface ConceptRow {
  id: string;
  title: string;
  summary: string;
  atomLabel: string;
  atomEmoji: string;
  importance: number;
  orderIndex: number;
  connections: ConnectionRow[];
}

interface DocState {
  document: { id: string; fileName: string; status: string; errorMessage: string | null };
  concepts: ConceptRow[];
  quizzes: { id: string; title: string; questions: { id: string }[] }[];
}

function toCardData(concept: ConceptRow, connection: ConnectionRow): ConnectionCardData {
  return {
    id: connection.id,
    conceptTitle: concept.title,
    atomEmoji: connection.atomEmoji,
    atomLabel: connection.atomLabel,
    worldEmoji: WORLD_EMOJI[connection.worldCategory] ?? '✨',
    worldRef: connection.worldRef,
    bridgeLine: connection.bridgeLine,
    whyOneLiner: connection.whyOneLiner,
    claimType: connection.claimType
  };
}

export function DocumentDetail({ documentId }: { documentId: string }) {
  const [state, setState] = useState<DocState | null>(null);
  const [busyConnectionId, setBusyConnectionId] = useState<string | null>(null);
  const [regeneratingQuiz, setRegeneratingQuiz] = useState(false);
  const [quizError, setQuizError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/documents/${documentId}`);
    if (res.ok) setState(await res.json());
  }, [documentId]);

  useEffect(() => {
    load();
    const interval = setInterval(() => {
      setState((current) => {
        // Keep polling through FAILED too — a "retry" click flips status back to a working
        // stage and this same interval should pick that up without needing a manual restart.
        if (current && current.document.status === 'READY') {
          clearInterval(interval);
          return current;
        }
        load();
        return current;
      });
    }, 3000);
    return () => clearInterval(interval);
  }, [load]);

  async function sendFeedback(connectionId: string, reaction: 'LOVE' | 'LIKE' | 'NEUTRAL' | 'DISLIKE' | 'INCORRECT') {
    await fetch(`/api/connections/${connectionId}/feedback`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ reaction })
    });
  }

  async function regenerate(connectionId: string, differentCategory: boolean) {
    setBusyConnectionId(connectionId);
    try {
      await fetch(`/api/connections/${connectionId}/regenerate`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ differentCategory })
      });
      await load();
    } finally {
      setBusyConnectionId(null);
    }
  }

  async function regenerateQuiz() {
    setRegeneratingQuiz(true);
    setQuizError(null);
    try {
      const res = await fetch(`/api/documents/${documentId}/regenerate-quiz`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'فشلت إعادة توليد الاختبار.');
      await load();
    } catch (err) {
      setQuizError(err instanceof Error ? err.message : 'خطأ غير متوقع.');
    } finally {
      setRegeneratingQuiz(false);
    }
  }

  if (!state) return <p className="text-sm text-ink-400">جاري التحميل...</p>;

  const { document, concepts, quizzes } = state;

  if (document.status !== 'READY') {
    return (
      <div className="rounded-xl2 border border-ink-100 bg-surface p-8 shadow-card">
        <h1 className="mb-4 text-xl font-extrabold text-ink-900">{document.fileName}</h1>
        <ProcessingSteps status={document.status} />
        {document.errorMessage && <p className="mt-4 text-sm text-accent-600">{document.errorMessage}</p>}
        {document.status === 'FAILED' && (
          <button
            onClick={async () => {
              await fetch(`/api/documents/${documentId}/retry`, { method: 'POST' });
              load();
            }}
            className="mt-4 rounded-full bg-accent-500 px-5 py-2 text-sm font-bold text-white transition hover:bg-accent-600"
          >
            🔄 أعد المحاولة
          </button>
        )}
      </div>
    );
  }

  const withConnection = concepts
    .filter((c) => c.connections.length > 0)
    .map((c) => ({ concept: c, connection: c.connections[0]! }))
    .sort((a, b) => b.connection.score - a.connection.score);
  const withoutConnection = concepts.filter((c) => c.connections.length === 0);
  const topLinks = withConnection.slice(0, 5);
  const reviewLater = withConnection.slice(5);

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-extrabold text-ink-900">{document.fileName}</h1>
        <p className="mt-1 text-ink-500">
          وجدنا {concepts.length} معلومة مهمة، وسوّينا {withConnection.length} رابط ذاكرة شخصي لك.
        </p>
        {quizzes[0] && quizzes[0].questions.length > 0 ? (
          <Link href={`/quiz/${quizzes[0].id}`} className="mt-3 inline-block rounded-full bg-accent-500 px-5 py-2 text-sm font-bold text-white">
            جاهز نختبرك؟ 🎯
          </Link>
        ) : (
          <div className="mt-3">
            <button
              onClick={regenerateQuiz}
              disabled={regeneratingQuiz}
              className="rounded-full border border-ink-100 px-5 py-2 text-sm font-bold text-ink-700 transition hover:bg-ink-100 disabled:opacity-50"
            >
              {regeneratingQuiz ? '...جاري توليد الاختبار' : '🔧 ولّد اختبار لهذا الملف'}
            </button>
            {quizError && <p className="mt-2 text-xs font-semibold text-accent-600">{quizError}</p>}
          </div>
        )}
      </div>

      <MindMap concepts={concepts} />

      {topLinks.length > 0 && (
        <Section title="🔥 أفضل الروابط">
          <div className="grid gap-4 md:grid-cols-2">
            {topLinks.map(({ concept, connection }) => (
              <ConnectionCard
                key={connection.id}
                data={toCardData(concept, connection)}
                onLove={() => sendFeedback(connection.id, 'LOVE')}
                onDidntGetIt={() => {
                  sendFeedback(connection.id, 'DISLIKE');
                  regenerate(connection.id, false);
                }}
                onDifferentInterest={() => regenerate(connection.id, true)}
              />
            ))}
          </div>
        </Section>
      )}

      {withoutConnection.length > 0 && (
        <Section title="🧠 تحتاج حفظ">
          <p className="-mt-3 mb-3 text-xs leading-relaxed text-ink-400">
            ما لقينا لها رابط ذاكرة قوي وصادق — فما اخترعنا لك واحد. صارت بطاقة تعليمية جاهزة تحفظها مباشرة.
          </p>
          <div className="space-y-3">
            {withoutConnection.map((c) => (
              <div
                key={c.id}
                className="rounded-xl2 border border-dashed border-accent-300/40 bg-gradient-to-b from-surface-raised to-surface p-5 transition hover:border-accent-300/60"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-50 text-lg">{c.atomEmoji}</div>
                  <p className="font-extrabold text-ink-900">{c.atomLabel || c.title}</p>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-ink-600">{c.summary}</p>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-ink-100 pt-3">
                  <p className="flex items-center gap-1.5 text-xs text-ink-500">
                    <span>💡</span>
                    بدون رابط ملفّق — بس بطاقة مباشرة تحفظها
                  </p>
                  <Link href="/study" className="text-xs font-extrabold text-accent-500 hover:text-accent-600">
                    افتح في Study Mode ←
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {reviewLater.length > 0 && (
        <Section title="📝 راجعها لاحقًا">
          <div className="space-y-3">
            {reviewLater.map(({ concept, connection }) => (
              <div key={concept.id} className="flex items-center gap-3 rounded-xl2 border border-ink-100 bg-surface p-4">
                <span className="text-lg">{connection.atomEmoji}</span>
                <div>
                  <p className="font-bold text-ink-900">{connection.atomLabel || concept.title}</p>
                  <p className="text-sm text-ink-500">
                    {WORLD_EMOJI[connection.worldCategory] ?? '✨'} {connection.bridgeLine}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {busyConnectionId && <p className="text-sm text-ink-400">نبحث عن رابط ثاني...</p>}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-4 text-lg font-bold text-ink-900">{title}</h2>
      {children}
    </section>
  );
}

function MindMap({ concepts }: { concepts: ConceptRow[] }) {
  if (concepts.length === 0) return null;
  const sorted = [...concepts].sort((a, b) => a.orderIndex - b.orderIndex);
  const linkedCount = sorted.filter((c) => c.connections.length > 0).length;
  const pct = Math.round((linkedCount / sorted.length) * 100);

  return (
    <Section title="🧠 خريطة المادة">
      <div className="-mt-3 mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-ink-400">
          {linkedCount} من {sorted.length} معلومة لقت لها رابط ذاكرة قوي 🔗
        </p>
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-32 overflow-hidden rounded-full bg-ink-200">
            <div className="h-full rounded-full bg-gradient-to-r from-accent-700 to-accent-500" style={{ width: `${pct}%` }} />
          </div>
          <span className="text-xs font-extrabold text-accent-500" dir="ltr">
            {pct}%
          </span>
        </div>
      </div>

      <div className="scrollbar-thin flex items-center overflow-x-auto rounded-xl2 border border-ink-100 bg-surface p-6" style={{ perspective: '1000px' }}>
        {sorted.map((c, i) => {
          const linked = c.connections.length > 0;
          return (
            <div key={c.id} className="flex items-center">
              <TiltCard maxTilt={8}>
                <div
                  className={
                    'relative flex h-[126px] w-[150px] shrink-0 flex-col items-center justify-center gap-2 rounded-xl2 p-3 text-center transition duration-200 hover:-translate-y-1 ' +
                    (linked
                      ? 'border border-accent-300/40 bg-gradient-to-b from-surface-raised to-surface shadow-glow'
                      : 'border border-dashed border-ink-300 bg-surface opacity-60')
                  }
                >
                  <span
                    className={
                      'absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full text-[11px] ' +
                      (linked ? 'bg-accent-500 shadow-[0_4px_10px_-2px_rgba(255,59,76,0.6)]' : 'border border-ink-300 bg-ink-200 text-ink-500')
                    }
                  >
                    {linked ? '🔗' : '؟'}
                  </span>
                  <p className={'text-2xl ' + (linked ? '' : 'opacity-70 grayscale')}>{c.atomEmoji}</p>
                  <p className={'text-xs font-extrabold leading-tight ' + (linked ? 'text-ink-900' : 'text-ink-600')}>{c.title}</p>
                </div>
              </TiltCard>
              {i < sorted.length - 1 && (
                <div className="relative mx-1 h-3 w-14 shrink-0">
                  <svg width="56" height="12" viewBox="0 0 56 12" className="overflow-visible">
                    <line
                      x1="56"
                      y1="6"
                      x2="0"
                      y2="6"
                      strokeWidth="2"
                      strokeDasharray="5 6"
                      className={linked ? 'animate-dash-flow stroke-accent-300' : 'stroke-ink-300'}
                    />
                  </svg>
                  {linked && (
                    <span className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 animate-ping rounded-full bg-accent-500" />
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-5 text-[11px] text-ink-400">
        <span className="flex items-center gap-1.5">
          <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-accent-500 text-[8px]">🔗</span>
          لقى رابط ذاكرة قوي
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3.5 w-3.5 rounded-full border border-dashed border-ink-300" />
          يحتاج حفظ مباشر (بدون رابط ملفّق)
        </span>
      </div>
    </Section>
  );
}
