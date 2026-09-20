'use client';

import { useEffect, useState } from 'react';

interface ConceptRow {
  id: string;
  title: string;
  summary: string;
  atomLabel: string;
  atomEmoji: string;
  importance: number;
  documentId: string;
  documentName: string;
  connection: { atomEmoji: string; bridgeLine: string; worldRef: string } | null;
}

/** Study Mode's "معلومات مهمة" tab — a calm, read-only feed of the highest-importance concepts
 * across every document, for a fast skim before an exam. Not graded, unlike Flashcards. */
export function ImportantInfoPanel() {
  const [concepts, setConcepts] = useState<ConceptRow[] | null>(null);

  useEffect(() => {
    fetch('/api/concepts/important')
      .then((r) => r.json())
      .then((d) => setConcepts(d.concepts ?? []));
  }, []);

  if (!concepts) return <p className="text-center text-sm text-ink-400">جاري التحميل...</p>;

  if (concepts.length === 0) {
    return (
      <div className="rounded-xl2 border border-ink-100 bg-surface p-8 text-center shadow-card">
        <p className="mb-3 text-2xl">📌</p>
        <p className="font-bold text-ink-900">ما لقينا معلومات عالية الأهمية لسه.</p>
        <p className="mt-1 text-sm text-ink-500">ترفع سلايداتك، وتطلع لك هنا أهم المعلومات فيها تلقائيًا.</p>
      </div>
    );
  }

  const byDocument = concepts.reduce<Record<string, { name: string; items: ConceptRow[] }>>((acc, c) => {
    (acc[c.documentId] ??= { name: c.documentName, items: [] }).items.push(c);
    return acc;
  }, {});

  return (
    <div className="space-y-8">
      {Object.entries(byDocument).map(([docId, group]) => (
        <div key={docId}>
          <h2 className="mb-3 text-sm font-bold text-ink-500">{group.name}</h2>
          <div className="space-y-3">
            {group.items.map((c) => (
              <div key={c.id} className="rounded-xl2 border border-ink-100 bg-surface p-4 shadow-card">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{c.atomEmoji}</span>
                    <p className="font-bold text-ink-900">{c.atomLabel || c.title}</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-ink-100 px-2.5 py-1 text-[11px] font-bold text-ink-500">
                    أهمية {c.importance}
                  </span>
                </div>
                <p className="mt-2 text-sm text-ink-600">{c.summary}</p>
                {c.connection && (
                  <p className="mt-3 rounded-lg bg-accent-50/60 px-3 py-2 text-sm font-bold text-accent-700">
                    {c.connection.atomEmoji} {c.connection.bridgeLine}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
