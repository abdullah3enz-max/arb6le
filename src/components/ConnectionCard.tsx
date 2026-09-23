'use client';

import { useState } from 'react';

export interface ConnectionCardData {
  id: string;
  conceptTitle: string;
  atomEmoji: string;
  atomLabel: string; // the fact, verbatim: "7 mg"
  worldEmoji: string;
  worldRef: string; // "Cristiano Ronaldo"
  bridgeLine: string; // the entire mnemonic: "Ronaldo = 7"
  whyOneLiner: string; // shown only on the back of the card
  claimType: 'FACT' | 'ANALOGY' | 'INTERPRETATION';
}

/**
 * Item 10: the whole point is that this card is NOT a paragraph. One fact, one arrow, one
 * bridge line up front — everything else lives on the back. The flip itself is a small nod to
 * the product's own mechanic: you're not reading an explanation, you're testing recall by
 * turning the card over, same as a real flashcard.
 */
export function ConnectionCard({
  data,
  onLove,
  onDidntGetIt,
  onDifferentInterest,
  differentInterestLabel = '🔄 اربطها بشيء آخر',
  disabled = false
}: {
  data: ConnectionCardData;
  onLove?: () => void;
  onDidntGetIt?: () => void;
  onDifferentInterest?: () => void;
  /** Lets a read-only context (e.g. the landing page demo) relabel this action without pulling
   * in feedback semantics that don't apply there ("was this good?" makes no sense on a canned example). */
  differentInterestLabel?: string;
  /** True while a regenerate call for this exact card is in flight — blocks a second click
   * from firing another one before the first has resolved. */
  disabled?: boolean;
}) {
  const [flipped, setFlipped] = useState(false);

  return (
    <div className="animate-fade-up">
      <div className="h-64" style={{ perspective: '1400px' }}>
        <div
          className="relative h-full w-full transition-transform duration-500 ease-out"
          style={{ transformStyle: 'preserve-3d', transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)' }}
        >
          {/* FRONT */}
          <div
            className="absolute inset-0 flex flex-col overflow-hidden rounded-xl2 border border-ink-100 bg-surface shadow-card"
            style={{ backfaceVisibility: 'hidden' }}
          >
            <div className="flex flex-1 flex-col items-center justify-center gap-3 px-5 py-6 text-center">
              <p className="text-sm text-ink-500">{data.conceptTitle}</p>

              <div className="flex items-center justify-center gap-2 text-lg font-semibold text-ink-700">
                <span>{data.atomEmoji}</span>
                <span>{data.atomLabel}</span>
              </div>

              <p className="text-xs font-bold uppercase tracking-wide text-ink-400">↓ اربطها بـ</p>

              <div className="flex items-center justify-center gap-2 text-2xl font-extrabold text-ink-900">
                <span>{data.worldEmoji}</span>
                <span className="text-accent-500">{data.bridgeLine}</span>
              </div>
            </div>

            <button
              onClick={() => setFlipped(true)}
              className="border-t border-ink-100 py-3 text-xs font-bold text-ink-400 transition hover:bg-ink-50 hover:text-ink-700"
            >
              🔄 اقلب البطاقة — ليش هذا الربط؟
            </button>
          </div>

          {/* BACK */}
          <div
            className="absolute inset-0 flex flex-col overflow-hidden rounded-xl2 border border-accent-300/30 bg-surface shadow-card"
            style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
          >
            <div className="scrollbar-thin flex-1 space-y-2 overflow-y-auto px-5 py-5 text-right">
              <p className="text-xs font-bold uppercase tracking-wide text-accent-500">ليش هذا الربط؟</p>
              <p className="text-sm leading-relaxed text-ink-700">{data.whyOneLiner}</p>
            </div>
            <button
              onClick={() => setFlipped(false)}
              className="border-t border-ink-100 py-3 text-xs font-bold text-ink-400 transition hover:bg-ink-50 hover:text-ink-700"
            >
              ↩ ارجع للبطاقة
            </button>
          </div>
        </div>
      </div>

      {(onLove || onDidntGetIt || onDifferentInterest) && (
        <div className="mt-2 flex flex-wrap items-center gap-2 rounded-xl2 border border-ink-100 bg-ink-50/60 px-5 py-3">
          {onLove && (
            <button
              className="rounded-full bg-accent-500 px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-accent-600 disabled:opacity-50"
              onClick={onLove}
              disabled={disabled}
            >
              👍 ممتاز
            </button>
          )}
          {onDidntGetIt && (
            <button
              className="rounded-full border border-ink-100 px-4 py-1.5 text-xs font-semibold text-ink-700 transition hover:bg-ink-100 disabled:opacity-50"
              onClick={onDidntGetIt}
              disabled={disabled}
            >
              👎 ما فهمته
            </button>
          )}
          {onDifferentInterest && (
            <button
              className={
                'rounded-full border border-ink-100 px-4 py-1.5 text-xs font-semibold text-ink-700 transition hover:bg-ink-100 disabled:opacity-50 ' +
                (onLove || onDidntGetIt ? 'mr-auto' : 'mx-auto')
              }
              onClick={onDifferentInterest}
              disabled={disabled}
            >
              {differentInterestLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
