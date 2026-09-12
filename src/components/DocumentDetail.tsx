'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { ProcessingSteps } from './ProcessingSteps';
import { ConnectionCard, type ConnectionCardData } from './ConnectionCard';

const WORLD_EMOJI: Record<string, string> = {
  SERIES: '📺',
  MOVIES: '🎬',
  FOOTBALL: '⚽',
  GAMES: '🎮',
  ANIME: '🇯🇵',
  CHARACTERS: '🦸',
  BOOKS: '📚',
  DAILY_LIFE: '☀️'
};

interface ConnectionRow {
  id: string;
  type: string;
  worldCategory: string;
  worldRef: string;
  headline: string;
  relationExplain: string;
  memoryHook: string;
  claimType: 'FACT' | 'ANALOGY' | 'INTERPRETATION';
  score: number;
  sources: { title: string | null; sourceType: string }[];
}

interface ConceptRow {
  id: string;
  title: string;
  summary: string;
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
    worldRef: connection.worldRef,
    worldEmoji: WORLD_EMOJI[connection.worldCategory] ?? '✨',
    relationExplain: connection.relationExplain,
    memoryHook: connection.memoryHook,
    claimType: connection.claimType,
    score: connection.score,
    sourceLabel: connection.sources[0]?.title ?? connection.sources[0]?.sourceType ?? 'مصدر داخلي'
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
        if (current && (current.document.status === 'READY' || current.document.status === 'FAILED')) {
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

  async function regenerate(connectionId: string) {
    setBusyConnectionId(connectionId);
    try {
      await fetch(`/api/connections/${connectionId}/regenerate`, { method: 'POST' });
      await load();
    } finally {
      setBusyConnectionId(null);
    }
  }

  async function saveFlashcard(conceptId: string, connectionId?: string) {
    await fetch('/api/flashcards', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ conceptId, connectionId })
    });
  }

  if (!state) return <p className="text-sm text-ink-400">جاري التحميل...</p>;

  const { document, concepts, quizzes } = state;

  if (document.status !== 'READY') {
    return (
      <div className="rounded-xl2 border border-ink-100 bg-white p-8 shadow-card">
        <h1 className="mb-4 text-xl font-extrabold text-ink-900">{document.fileName}</h1>
        <ProcessingSteps status={document.status} />
        {document.errorMessage && <p className="mt-4 text-sm text-accent-600">{document.errorMessage}</p>}
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
          وجدنا {concepts.length} معلومة مهمة، وأفضل {withConnection.length} ربطًا شخصيًا لك.
        </p>
        {quizzes[0] && (
          <Link href={`/quiz/${quizzes[0].id}`} className="mt-3 inline-block rounded-full bg-ink-900 px-5 py-2 text-sm font-bold text-white">
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
                onFeedback={(r) => sendFeedback(connection.id, r)}
                onRegenerate={() => regenerate(connection.id)}
                onSaveFlashcard={() => saveFlashcard(concept.id, connection.id)}
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
                <p className="mb-1 font-bold text-ink-900">{c.title}</p>
                <p className="text-sm text-ink-700">{c.summary}</p>
                <p className="mt-2 text-xs font-semibold text-amber-700">
                  ما لقينا ربط قوي وصادق لهذي المعلومة، فما اخترعنا لك واحد — احفظها مباشرة أو جرّب Flashcards.
                </p>
                <button
                  onClick={() => saveFlashcard(c.id)}
                  className="mt-2 rounded-full border border-amber-200 bg-white px-3 py-1 text-xs font-semibold text-amber-700 hover:bg-amber-50"
                >
                  💾 حوّلها Flashcard
                </button>
              </div>
            ))}
          </div>
        </Section>
      )}

      {reviewLater.length > 0 && (
        <Section title="📝 راجعها لاحقًا">
          <div className="space-y-3">
            {reviewLater.map(({ concept, connection }) => (
              <div key={concept.id} className="rounded-xl2 border border-ink-100 bg-white p-4">
                <p className="font-bold text-ink-900">{concept.title}</p>
                <p className="text-sm text-ink-500">{connection.headline}</p>
              </div>
            ))}
          </div>
        </Section>
      )}

      {busyConnectionId && <p className="text-sm text-ink-400">نبحث عن ربط ثاني...</p>}
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
  return (
    <Section title="🧠 خريطة المادة">
      <div className="scrollbar-thin flex gap-3 overflow-x-auto rounded-xl2 border border-ink-100 bg-white p-4">
        {concepts
          .sort((a, b) => a.orderIndex - b.orderIndex)
          .map((c, i) => (
            <div key={c.id} className="flex items-center gap-3">
              <div className="w-40 shrink-0 rounded-xl border border-ink-100 bg-ink-50 p-3 text-center">
                <p className="text-xs font-bold text-ink-800">{c.title}</p>
              </div>
              {i < concepts.length - 1 && <span className="text-ink-300">←</span>}
            </div>
          ))}
      </div>
    </Section>
  );
}
