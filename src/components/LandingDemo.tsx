'use client';

import { useState } from 'react';
import { ConnectionCard, type ConnectionCardData } from './ConnectionCard';

// Curated, fact-checked illustrative examples — NOT live AI output and NOT Lorem Ipsum. Each one
// is a real, verifiable fact (jersey numbers, cast sizes, film counts, scientific eponyms — never
// invented), spanning the same interest categories the real onboarding offers (football, series,
// countries, movies, anime) so the demo shows the range of the engine, not one lucky example.
const DEMOS: ConnectionCardData[] = [
  {
    id: 'demo-messi',
    conceptTitle: 'Dose',
    atomEmoji: '💉',
    atomLabel: '10 mg',
    worldEmoji: '⚽',
    worldRef: 'Lionel Messi',
    bridgeLine: 'Messi = 10',
    whyOneLiner: 'ميسي اشتهر بالرقم 10 طول مسيرته — برشلونة والمنتخب الأرجنتيني.',
    claimType: 'FACT'
  },
  {
    id: 'demo-zelda',
    conceptTitle: 'Trio',
    atomEmoji: '🔺',
    atomLabel: '3 أجزاء',
    worldEmoji: '🎮',
    worldRef: 'The Legend of Zelda',
    bridgeLine: 'Triforce = 3',
    whyOneLiner: 'مثلث القوة "Triforce" الشهير بسلسلة زيلدا يتكوّن فعليًا من 3 أجزاء بالضبط: القوة، الحكمة، والشجاعة.',
    claimType: 'FACT'
  },
  {
    id: 'demo-friends',
    conceptTitle: 'Group Size',
    atomEmoji: '👥',
    atomLabel: '6',
    worldEmoji: '📺',
    worldRef: 'Friends',
    bridgeLine: 'Friends = 6 أصدقاء',
    whyOneLiner: 'مسلسل Friends الشهير عالميًا بُني كامل حول 6 أصدقاء بالضبط — راشيل، مونيكا، فيبي، جوي، تشاندلر، وروس.',
    claimType: 'FACT'
  },
  {
    id: 'demo-uae',
    conceptTitle: 'Count',
    atomEmoji: '🔢',
    atomLabel: '7',
    worldEmoji: '🇦🇪',
    worldRef: 'الإمارات العربية المتحدة',
    bridgeLine: 'UAE = 7 إمارات',
    whyOneLiner: 'دولة الإمارات مكوّنة فعليًا من 7 إمارات بالضبط — أبوظبي ودبي والشارقة وغيرها.',
    claimType: 'FACT'
  },
  {
    id: 'demo-starwars',
    conceptTitle: 'Series Count',
    atomEmoji: '🎞️',
    atomLabel: '9',
    worldEmoji: '🎬',
    worldRef: 'Star Wars',
    bridgeLine: 'Star Wars = 9 أفلام',
    whyOneLiner: 'ملحمة ستار وورز الرئيسية (سكاي ووكر) فعليًا 9 أفلام بالضبط، من 1977 إلى 2019.',
    claimType: 'FACT'
  },
  {
    id: 'demo-naruto',
    conceptTitle: 'Seal Count',
    atomEmoji: '🦊',
    atomLabel: '9',
    worldEmoji: '🇯🇵',
    worldRef: 'Naruto',
    bridgeLine: 'Kyuubi = 9 ذيول',
    whyOneLiner: 'التسع ذيول (Kyuubi) أشهر وحش بأنمي ناروتو، ومحبوس داخل جسد البطل نفسه — عنصر أساسي بالقصة كلها.',
    claimType: 'FACT'
  }
];

export function LandingDemo() {
  const [index, setIndex] = useState(0);

  function tryAnother() {
    // Random, but never the same card twice in a row.
    let next = Math.floor(Math.random() * DEMOS.length);
    while (next === index && DEMOS.length > 1) next = Math.floor(Math.random() * DEMOS.length);
    setIndex(next);
  }

  return (
    <div className="mx-auto max-w-lg">
      <ConnectionCard key={DEMOS[index]!.id} data={DEMOS[index]!} onDifferentInterest={tryAnother} differentInterestLabel="🔄 جرّب ربط ثاني" />
      <p className="mt-3 text-center text-xs text-ink-400">
        هذي أمثلة توضيحية مكتوبة مسبقًا (كورة، مسلسلات، دول، أفلام، أنمي) لعرض شكل النتيجة — بعد رفع
        سلايداتك الحقيقية، الروابط تُنشأ وتُتحقق تلقائيًا لكل معلومة فيها.
      </p>
    </div>
  );
}
