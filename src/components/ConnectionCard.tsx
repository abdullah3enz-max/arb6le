'use client';

import clsx from 'clsx';
import { useState } from 'react';

export interface ConnectionCardData {
  id: string;
  conceptTitle: string;
  worldRef: string;
  worldEmoji: string;
  relationExplain: string;
  memoryHook: string;
  claimType: 'FACT' | 'ANALOGY' | 'INTERPRETATION';
  score: number;
  sourceLabel: string;
}

const CLAIM_LABEL: Record<ConnectionCardData['claimType'], { label: string; tone: string }> = {
  FACT: { label: 'حقيقة', tone: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  ANALOGY: { label: 'وسيلة تذكّر (Analogy)', tone: 'bg-accent-50 text-accent-700 border-accent-100' },
  INTERPRETATION: { label: 'تفسير', tone: 'bg-amber-50 text-amber-700 border-amber-200' }
};

export function ConnectionCard({
  data,
  onFeedback,
  onRegenerate,
  onSaveFlashcard
}: {
  data: ConnectionCardData;
  onFeedback?: (reaction: 'LOVE' | 'LIKE' | 'NEUTRAL' | 'DISLIKE' | 'INCORRECT') => void;
  onRegenerate?: () => void;
  onSaveFlashcard?: () => void;
}) {
  const [showRegenMenu, setShowRegenMenu] = useState(false);
  const claim = CLAIM_LABEL[data.claimType];

  return (
    <div className="animate-fade-up overflow-hidden rounded-xl2 border border-ink-100 bg-white shadow-card">
      <div className="flex items-center justify-between border-b border-ink-100 px-5 py-3">
        <div className="flex items-center gap-2 text-sm font-bold text-ink-800">
          <span>🧠</span>
          <span>{data.conceptTitle}</span>
        </div>
        <span className={clsx('rounded-full border px-2.5 py-1 text-xs font-semibold', claim.tone)}>{claim.label}</span>
      </div>

      <div className="space-y-4 px-5 py-4">
        <div className="flex items-center gap-2 text-ink-600">
          <span className="text-lg">{data.worldEmoji}</span>
          <span className="font-semibold text-ink-900">{data.worldRef}</span>
        </div>

        <div>
          <div className="mb-1 flex items-center gap-1.5 text-xs font-bold text-ink-400">
            <span>🔗</span>
            <span>ليش ربطناها؟</span>
          </div>
          <p className="text-sm leading-relaxed text-ink-800">{data.relationExplain}</p>
        </div>

        <div className="rounded-xl bg-accent-50/60 p-3">
          <div className="mb-1 flex items-center gap-1.5 text-xs font-bold text-accent-700">
            <span>💡</span>
            <span>احفظها كذا</span>
          </div>
          <p className="text-sm leading-relaxed text-ink-900">{data.memoryHook}</p>
        </div>

        <div className="flex items-center justify-between text-xs text-ink-400">
          <div className="flex items-center gap-1.5">
            <span>📚</span>
            <span>{data.sourceLabel}</span>
          </div>
          <div className="flex items-center gap-2">
            <span>🎯 قوة الربط</span>
            <span className="font-bold text-accent-600">{data.score}%</span>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-ink-100 bg-ink-50/60 px-5 py-3">
        <button
          className="rounded-full bg-ink-900 px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-ink-800"
          onClick={() => onFeedback?.('LOVE')}
        >
          فهمتها ❤️
        </button>
        <div className="relative">
          <button
            className="rounded-full border border-ink-100 px-4 py-1.5 text-xs font-semibold text-ink-700 transition hover:bg-white"
            onClick={() => setShowRegenMenu((v) => !v)}
          >
            🔄 أعد الربط
          </button>
          {showRegenMenu && (
            <div className="absolute z-10 mt-2 w-44 rounded-xl border border-ink-100 bg-white p-2 shadow-card">
              <p className="mb-1 px-1 text-[11px] text-ink-400">اختر طريقة ثانية</p>
              {['شخصية', 'حدث', 'قصة', 'مقارنة', 'اختر أنت'].map((label) => (
                <button
                  key={label}
                  className="block w-full rounded-lg px-2 py-1.5 text-right text-xs text-ink-700 hover:bg-ink-50"
                  onClick={() => {
                    setShowRegenMenu(false);
                    onRegenerate?.();
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
        <button
          className="rounded-full border border-ink-100 px-4 py-1.5 text-xs font-semibold text-ink-700 transition hover:bg-white"
          onClick={onSaveFlashcard}
        >
          💾 حفظ
        </button>
        <div className="mr-auto flex items-center gap-1 text-sm">
          {(['LIKE', 'NEUTRAL', 'DISLIKE', 'INCORRECT'] as const).map((r) => (
            <button
              key={r}
              title={r}
              className="rounded-full px-1.5 py-1 hover:bg-ink-100"
              onClick={() => onFeedback?.(r)}
            >
              {{ LIKE: '👍', NEUTRAL: '😐', DISLIKE: '👎', INCORRECT: '🚫' }[r]}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
