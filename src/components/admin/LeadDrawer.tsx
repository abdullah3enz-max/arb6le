'use client';

import { useState } from 'react';
import { STAGE_LABEL, STAGE_ORDER, SOURCE_LABEL, PLAN_LABEL } from '@/lib/admin/crmLabels';

export interface LeadNote {
  id: string;
  body: string;
  createdAt: string;
  author: { name: string | null; email: string };
}

export interface Lead {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  source: string;
  stage: string;
  potentialPlan: string | null;
  valueCents: number | null;
  assignedTo: { id: string; email: string; name: string | null } | null;
  lastContactAt: string | null;
  createdAt: string;
  notes: LeadNote[];
}

export function LeadDrawer({
  lead,
  employees,
  onClose,
  onChanged
}: {
  lead: Lead;
  employees: { id: string; email: string; name: string | null }[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [addingNote, setAddingNote] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function patch(data: Record<string, unknown>) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/leads/${lead.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'فشل التحديث.');
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطأ غير متوقع.');
    } finally {
      setSaving(false);
    }
  }

  async function addNote() {
    if (!noteText.trim()) return;
    setAddingNote(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/leads/${lead.id}/notes`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ body: noteText.trim() })
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'فشل إضافة الملاحظة.');
      setNoteText('');
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطأ غير متوقع.');
    } finally {
      setAddingNote(false);
    }
  }

  async function deleteLead() {
    if (!confirm(`متأكد تبي تحذف "${lead.name}"؟ هذا الإجراء ما يترجع.`)) return;
    const res = await fetch(`/api/admin/leads/${lead.id}`, { method: 'DELETE' });
    if (res.ok) {
      onChanged();
      onClose();
    } else {
      setError((await res.json()).error ?? 'فشل الحذف.');
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50" onClick={onClose}>
      <div
        className="scrollbar-thin h-full w-full max-w-md overflow-y-auto bg-surface p-5 shadow-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-extrabold text-ink-900">{lead.name}</h2>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-700">
            ✕
          </button>
        </div>

        {error && <p className="mb-3 text-sm font-semibold text-accent-600">{error}</p>}

        <div className="space-y-3">
          <Field label="الاسم" value={lead.name} onSave={(v) => patch({ name: v })} disabled={saving} />
          <Field label="البريد" value={lead.email ?? ''} onSave={(v) => patch({ email: v || null })} disabled={saving} />
          <Field label="الجوال" value={lead.phone ?? ''} onSave={(v) => patch({ phone: v || null })} disabled={saving} />

          <div>
            <label className="mb-1 block text-xs font-bold text-ink-400">المرحلة</label>
            <select
              value={lead.stage}
              onChange={(e) => patch({ stage: e.target.value })}
              disabled={saving}
              className="w-full rounded-lg border border-ink-100 bg-surface px-3 py-2 text-sm text-ink-900"
            >
              {STAGE_ORDER.map((s) => (
                <option key={s} value={s}>
                  {STAGE_LABEL[s]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-bold text-ink-400">المصدر</label>
            <select
              value={lead.source}
              onChange={(e) => patch({ source: e.target.value })}
              disabled={saving}
              className="w-full rounded-lg border border-ink-100 bg-surface px-3 py-2 text-sm text-ink-900"
            >
              {Object.entries(SOURCE_LABEL).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-bold text-ink-400">الباقة المحتملة</label>
            <select
              value={lead.potentialPlan ?? ''}
              onChange={(e) => patch({ potentialPlan: e.target.value || null })}
              disabled={saving}
              className="w-full rounded-lg border border-ink-100 bg-surface px-3 py-2 text-sm text-ink-900"
            >
              <option value="">—</option>
              {Object.entries(PLAN_LABEL).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-bold text-ink-400">الموظف المسؤول</label>
            <select
              value={lead.assignedTo?.id ?? ''}
              onChange={(e) => patch({ assignedToId: e.target.value || null })}
              disabled={saving}
              className="w-full rounded-lg border border-ink-100 bg-surface px-3 py-2 text-sm text-ink-900"
            >
              <option value="">بدون تعيين</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name ?? e.email}
                </option>
              ))}
            </select>
          </div>

          <Field
            label="القيمة التقديرية (ريال)"
            value={lead.valueCents ? String(Math.round(lead.valueCents / 100)) : ''}
            onSave={(v) => patch({ valueCents: v ? Math.round(Number(v) * 100) : null })}
            disabled={saving}
            type="number"
          />
        </div>

        <div className="mt-6 border-t border-ink-100 pt-4">
          <h3 className="mb-3 text-sm font-bold text-ink-900">الملاحظات</h3>
          <div className="mb-3 flex gap-2">
            <input
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="أضف ملاحظة..."
              className="flex-1 rounded-lg border border-ink-100 bg-surface px-3 py-2 text-sm text-ink-900 outline-none placeholder:text-ink-400"
            />
            <button
              onClick={addNote}
              disabled={addingNote || !noteText.trim()}
              className="rounded-lg bg-accent-500 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
            >
              إضافة
            </button>
          </div>
          <div className="space-y-2">
            {lead.notes.length === 0 && <p className="text-sm text-ink-400">ما فيه ملاحظات بعد.</p>}
            {lead.notes.map((n) => (
              <div key={n.id} className="rounded-lg border border-ink-100 bg-ink-50/60 p-3">
                <p className="text-sm text-ink-800">{n.body}</p>
                <p className="mt-1 text-xs text-ink-400">
                  {n.author.name ?? n.author.email} · {new Date(n.createdAt).toLocaleString('ar-SA')}
                </p>
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={deleteLead}
          className="mt-6 w-full rounded-full border border-accent-300/40 py-2 text-sm font-bold text-accent-600 hover:bg-accent-50"
        >
          🗑 حذف العميل المحتمل
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onSave,
  disabled,
  type = 'text'
}: {
  label: string;
  value: string;
  onSave: (v: string) => void;
  disabled?: boolean;
  type?: string;
}) {
  const [local, setLocal] = useState(value);
  return (
    <div>
      <label className="mb-1 block text-xs font-bold text-ink-400">{label}</label>
      <input
        type={type}
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={() => {
          if (local !== value) onSave(local);
        }}
        disabled={disabled}
        className="w-full rounded-lg border border-ink-100 bg-surface px-3 py-2 text-sm text-ink-900 outline-none"
      />
    </div>
  );
}
