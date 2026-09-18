'use client';

// Mirrors Document.status exactly (src/lib/ai/pipeline.ts) — every label here reflects a real
// pipeline stage that actually ran, never a canned animation (item 38). Text extraction itself
// happens client-side before upload (see UploadArea's own extraction progress UI), so the first
// server-side stage is straight to concept mapping.
const STAGES: { key: string; label: string }[] = [
  { key: 'UPLOADED', label: '📄 استلمنا النص المستخرج' },
  { key: 'MAPPING_CONCEPTS', label: '🧠 نستخرج المعلومات المهمة...' },
  { key: 'FINDING_CONNECTIONS', label: '🔎 نبحث عن أفضل الروابط...' },
  { key: 'FACT_CHECKING', label: '🔗 نتحقق من الحقائق ونختبر قوة الروابط...' },
  { key: 'GENERATING', label: '✨ نجهز الاختبارات وبطاقات المراجعة...' },
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
