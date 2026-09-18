'use client';

import { useState } from 'react';
import { ConnectionCard, type ConnectionCardData } from './ConnectionCard';

// Curated, fact-checked illustrative examples — NOT live AI output and NOT Lorem Ipsum.
// One shows a DIRECT_MATCH (real jersey number), the other a deeper PHONETIC bridge built on
// a real scientific eponym — not a superficial sound-alike, an actual documented naming fact.
const DEMOS: { ronaldo: ConnectionCardData; rontgen: ConnectionCardData } = {
  ronaldo: {
    id: 'demo-ronaldo',
    conceptTitle: 'Dose',
    atomEmoji: '💉',
    atomLabel: '7 mg',
    worldEmoji: '⚽',
    worldRef: 'Cristiano Ronaldo',
    bridgeLine: 'Ronaldo = 7',
    whyOneLiner: 'رونالدو اشتهر بالرقم 7 طول مسيرته — مانشستر يونايتد، ريال مدريد، والمنتخب البرتغالي.',
    claimType: 'FACT'
  },
  rontgen: {
    id: 'demo-rontgen',
    conceptTitle: 'X-ray',
    atomEmoji: '🩻',
    atomLabel: 'الأشعة السينية',
    worldEmoji: '⚽',
    worldRef: 'Cristiano Ronaldo',
    bridgeLine: 'Röntgen ≈ "Ron"',
    whyOneLiner:
      'الأشعة السينية اسمها العلمي الحقيقي "أشعة رونتجن" (Röntgen) نسبة لمكتشفها Wilhelm Röntgen — ' +
      'و"رون" أول مقطع فيها يشبه صوتيًا بداية اسم Ronaldo. تشابه صوتي مبني على تسمية علمية حقيقية، مو تخمين.',
    claimType: 'FACT'
  }
};

export function LandingDemo() {
  const [choice, setChoice] = useState<keyof typeof DEMOS>('ronaldo');

  return (
    <div className="mx-auto max-w-lg">
      <div className="mb-4 flex justify-center gap-2">
        {(
          [
            ['ronaldo', '💉 رقم مباشر'],
            ['rontgen', '🩻 تسمية علمية']
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setChoice(key)}
            className={
              'rounded-full px-4 py-1.5 text-sm font-semibold transition ' +
              (choice === key ? 'bg-accent-500 text-white' : 'border border-ink-100 bg-surface text-ink-600 hover:bg-ink-100')
            }
          >
            {label}
          </button>
        ))}
      </div>
      <ConnectionCard data={DEMOS[choice]} />
      <p className="mt-3 text-center text-xs text-ink-400">
        هذا مثال توضيحي مكتوب مسبقًا لعرض شكل النتيجة — بعد رفع سلايداتك الحقيقية، الروابط تُنشأ
        وتُتحقق تلقائيًا لكل معلومة فيها.
      </p>
    </div>
  );
}
