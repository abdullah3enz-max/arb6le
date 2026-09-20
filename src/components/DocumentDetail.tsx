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
  DAILY_LIFE: '☀️'
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
  quizzes: { id: string; title: string }[];
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
        {quizzes[0] && (
          <Link href={`/quiz/${quizzes[0].id}`} className="mt-3 inline-block rounded-full bg-accent-500 px-5 py-2 text-sm font-bold text-white">
            جاهز نختبرك؟ 🎯
          </Link>
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
          <div className="space-y-3">
            {withoutConnection.map((c) => (
              <div key={c.id} className="rounded-xl2 border border-amber-100 bg-amber-50/60 p-4">
                <div className="mb-1 flex items-center gap-2 font-bold text-ink-900">
                  <span>{c.atomEmoji}</span>
                  <span>{c.atomLabel || c.title}</span>
                </div>
                <p className="text-sm text-ink-700">{c.summary}</p>
                <p className="mt-2 text-xs font-semibold text-amber-700">
                  لم نجد رابطًا قويًا لهذه المعلومة، فما اخترعنا لك واحد — بس صارت بطاقة تعليمية جاهزة
                  في Study Mode عشان تحفظها مباشرة.
                </p>
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

  return (
    <Section title="🧠 خريطة المادة">
      <p className="-mt-3 mb-3 text-xs text-ink-400">
        {linkedCount} من {sorted.length} معلومة لقت لها رابط ذاكرة قوي 🔗
      </p>
      <div className="scrollbar-thin flex items-center overflow-x-auto rounded-xl2 border border-ink-100 bg-surface p-6" style={{ perspective: '1000px' }}>
        {sorted.map((c, i) => {
          const linked = c.connections.length > 0;
          return (
            <div key={c.id} className="flex items-center">
              <TiltCard maxTilt={8}>
                <div
                  className={
                    'relative w-40 shrink-0 rounded-xl border p-3 text-center ' +
                    (linked ? 'border-accent-300/40 bg-ink-50 shadow-glow' : 'border-ink-100 bg-ink-50')
                  }
                >
                  <span className="absolute -right-2 -top-2 text-sm">{linked ? '🔗' : '⚪'}</span>
                  <p className="mb-1 text-lg">{c.atomEmoji}</p>
                  <p className="text-xs font-bold text-ink-800">{c.title}</p>
                </div>
              </TiltCard>
              {i < sorted.length - 1 && (
                <div className="relative mx-1 h-px w-10 shrink-0 bg-gradient-to-l from-accent-500/60 via-accent-500/20 to-transparent">
                  <span
                    className="animate-ping-slow absolute right-0 top-1/2 h-1.5 w-1.5 rounded-full bg-accent-500"
                    style={{ animationDelay: `${i * 0.15}s` }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Section>
  );
}
