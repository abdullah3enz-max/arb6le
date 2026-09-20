'use client';

import { useState } from 'react';
import { StudyFocus } from './StudyFocus';
import { QuizzesPanel } from './QuizzesPanel';
import { ImportantInfoPanel } from './ImportantInfoPanel';

const TABS = [
  { key: 'flashcards', label: '🃏 بطاقات تعليمية' },
  { key: 'quizzes', label: '📝 اختبارات' },
  { key: 'important', label: '📌 معلومات مهمة' }
] as const;

type TabKey = (typeof TABS)[number]['key'];

export function StudyTabs() {
  const [tab, setTab] = useState<TabKey>('flashcards');

  return (
    <div>
      <div className="mb-6 flex gap-1 rounded-full border border-ink-100 bg-surface p-1.5 shadow-card sm:gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={
              'flex-1 truncate rounded-full px-2 py-2 text-xs font-bold transition sm:px-4 sm:text-sm ' +
              (tab === t.key ? 'bg-accent-500 text-white' : 'text-ink-500 hover:bg-ink-100')
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'flashcards' && <StudyFocus />}
      {tab === 'quizzes' && <QuizzesPanel />}
      {tab === 'important' && <ImportantInfoPanel />}
    </div>
  );
}
