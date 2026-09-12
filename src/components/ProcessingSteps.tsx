'use client';

// Mirrors Document.status exactly (src/lib/ai/pipeline.ts) — every label here reflects a real
// pipeline stage that actually ran, never a canned animation (item 38).
const STAGES: { key: string; label: string }[] = [
  { key: 'UPLOADED', label: '📄 استلمنا ملفك' },
  { key: 'EXTRACTING', label: '📄 نقرأ السلايدات...' },
  { key: 'OCR', label: '🔎 نقرأ الصور داخل السلايدات...' },
  { key: 'PARSING', label: '🧩 ننظم النصوص والجداول...' },
  { key: 'MAPPING_CONCEPTS', label: '🧠 نفهم المفاهيم...' },
  { key: 'FINDING_CONNECTIONS', label: '🔎 نبحث عن روابط مناسبة...' },
  { key: 'FACT_CHECKING', label: '🔗 نختبر قوة الروابط ونتحقق من الحقائق...' },
  { key: 'GENERATING', label: '✨ نجهز طريقة الحفظ والاختبارات...' },
  { key: 'READY', label: '✅ جاهز!' }
];

export function ProcessingSteps({ status }: { status: string }) {
  if (status === 'FAILED') {
    return <p className="text-sm font-semibold text-accent-600">حصل خطأ في المعالجة — جرّب رفع الملف مرة ثانية.</p>;
  }

  const currentIndex = STAGES.findIndex((s) => s.key === status);

  return (
    <div className="space-y-1.5">
      {STAGES.map((s, i) => {
        const done = currentIndex > i || status === 'READY';
        const active = i === currentIndex && status !== 'READY';
        return (
          <div key={s.key} className={'flex items-center gap-2 text-sm ' + (done || active ? 'text-ink-800' : 'text-ink-300')}>
            <span className={active ? 'animate-pulse' : ''}>{done ? '✅' : active ? '⏳' : '⚪'}</span>
            <span>{s.label}</span>
          </div>
        );
      })}
    </div>
  );
}
