'use client';

import { useState } from 'react';
import { ConnectionCard, type ConnectionCardData } from './ConnectionCard';

// Curated, fact-checked illustrative examples — NOT live AI output and NOT Lorem Ipsum
// (item 36/35). Both are genuine, verifiable patterns: a well-known football tactical
// behavior, and a widely documented plot mechanic — not invented statistics or events.
const DEMOS: { football: ConnectionCardData; breakingbad: ConnectionCardData } = {
  football: {
    id: 'demo-football',
    conceptTitle: 'Negative Feedback Loop',
    worldRef: 'كرة القدم — تكتيك "حماية النتيجة"',
    worldEmoji: '⚽',
    relationExplain:
      'في Negative Feedback، ازدياد الناتج يقلل من نشاط العملية التي أنتجته. نفس النمط ' +
      'موجود في تكتيك معروف بكرة القدم: عندما يتقدم فريق بهدف، غالبًا يقل ضغطه الهجومي ' +
      'ويتحول لشكل دفاعي أكثر — الناتج (التقدم بالنتيجة) قلل من نفس السلوك الذي أدى له. ' +
      'هذا نمط تكتيكي عام معروف في كرة القدم، وليس إحصائية أو مباراة محددة.',
    memoryHook: 'زاد الناتج (تقدم بالنتيجة) → قلّ نشاط السبب (الضغط الهجومي). نفس منطق Negative Feedback.',
    claimType: 'INTERPRETATION',
    score: 88,
    sourceLabel: 'نمط تكتيكي عام موثّق في تحليلات كرة القدم'
  },
  breakingbad: {
    id: 'demo-bb',
    conceptTitle: 'Positive Feedback Loop',
    worldRef: 'Breaking Bad — تحول Walter White',
    worldEmoji: '🎬',
    relationExplain:
      'في Positive Feedback، الناتج يعزز نفس السبب الذي أنتجه، فتكبر الدورة باستمرار. هذا هو ' +
      'المحرك الأساسي لقصة Breaking Bad: كل عملية طبخ وبيع ناجحة تزيد ثقة/طموح والتر، وهذا ' +
      'الطموح يدفعه لعمليات أكبر وأخطر، فتزيد النتيجة أكثر. هذه الحلقة المتصاعدة هي الخط ' +
      'الدرامي المُعلن للمسلسل نفسه، وليست تفصيلة مُختَرعة.',
    memoryHook: 'كل "نجاح" في المسلسل يغذي رغبة أكبر تصنع "نجاح" أخطر. هذا Positive Feedback بحرفيته.',
    claimType: 'ANALOGY',
    score: 91,
    sourceLabel: 'خط درامي معروف ومُوثّق للمسلسل'
  }
};

export function LandingDemo() {
  const [choice, setChoice] = useState<keyof typeof DEMOS>('football');

  return (
    <div className="mx-auto max-w-lg">
      <div className="mb-4 flex justify-center gap-2">
        {(
          [
            ['football', '⚽ كرة القدم'],
            ['breakingbad', '🎬 Breaking Bad']
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setChoice(key)}
            className={
              'rounded-full px-4 py-1.5 text-sm font-semibold transition ' +
              (choice === key ? 'bg-ink-900 text-white' : 'border border-ink-100 bg-white text-ink-600 hover:bg-ink-50')
            }
          >
            {label}
          </button>
        ))}
      </div>
      <ConnectionCard data={DEMOS[choice]} />
      <p className="mt-3 text-center text-xs text-ink-400">
        هذا مثال توضيحي مكتوب مسبقًا لعرض شكل النتيجة — بعد رفع سلايداتك الحقيقية، الروابط تُنشأ
        وتُتحقق تلقائيًا لكل مفهوم فيها.
      </p>
    </div>
  );
}
