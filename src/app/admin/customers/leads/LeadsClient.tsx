'use client';

import { useEffect, useMemo, useState } from 'react';
import { STAGE_LABEL, SOURCE_LABEL } from '@/lib/admin/crmLabels';
import { LeadDrawer, type Lead } from '@/components/admin/LeadDrawer';

interface SourceConversion {
  source: string;
  total: number;
  converted: number;
  conversionRate: number;
}

export function LeadsClient() {
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [sourceConversion, setSourceConversion] = useState<SourceConversion[]>([]);
  const [staff, setStaff] = useState<{ id: string; email: string; name: string | null }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState('ALL');
  const [openLeadId, setOpenLeadId] = useState<string | null>(null);

  function load() {
    fetch('/api/admin/leads')
      .then((r) => r.json())
      .then((d) => (d.error ? setError(d.error) : (setLeads(d.leads), setSourceConversion(d.sourceConversion))));
  }

  useEffect(() => {
    load();
    fetch('/api/admin/leads/assignees')
      .then((r) => r.json())
      .then((d) => !d.error && setStaff(d.staff));
  }, []);

  const filtered = useMemo(() => {
    if (!leads) return null;
    const q = search.trim().toLowerCase();
    return leads.filter((l) => {
      if (stageFilter !== 'ALL' && l.stage !== stageFilter) return false;
      if (!q) return true;
      return l.name.toLowerCase().includes(q) || (l.email ?? '').toLowerCase().includes(q);
    });
  }, [leads, search, stageFilter]);

  if (error) return <p className="text-sm font-semibold text-accent-600">{error}</p>;
  if (!leads) return <p className="text-sm text-ink-400">جاري التحميل...</p>;

  const openLead = leads.find((l) => l.id === openLeadId) ?? null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-extrabold text-ink-900">العملاء المحتملون</h1>
        <p className="mt-1 text-sm text-ink-500">قائمة كل الـ Leads، وتحويل كل مصدر منهم لعملاء فعليين.</p>
      </div>

      <section>
        <h2 className="mb-3 text-sm font-bold text-ink-900">التحويل حسب المصدر</h2>
        <div className="overflow-x-auto rounded-xl2 border border-ink-100 bg-surface">
          <table className="w-full text-sm">
            <thead className="bg-ink-50 text-ink-500">
              <tr>
                <th className="px-4 py-2 text-right">المصدر</th>
                <th className="px-4 py-2 text-right">الإجمالي</th>
                <th className="px-4 py-2 text-right">تحوّلوا لمدفوع</th>
                <th className="px-4 py-2 text-right">نسبة التحويل</th>
              </tr>
            </thead>
            <tbody>
              {sourceConversion.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-ink-400">
                    ما فيه عملاء محتملون بعد.
                  </td>
                </tr>
              )}
              {sourceConversion
                .sort((a, b) => b.total - a.total)
                .map((s) => (
                  <tr key={s.source} className="border-t border-ink-100">
                    <td className="px-4 py-2 font-semibold text-ink-800">{SOURCE_LABEL[s.source] ?? s.source}</td>
                    <td className="px-4 py-2 text-ink-500">{s.total}</td>
                    <td className="px-4 py-2 text-ink-500">{s.converted}</td>
                    <td className="px-4 py-2 text-ink-500">{(s.conversionRate * 100).toFixed(0)}%</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="دوّر بالاسم أو البريد..."
          className="w-64 rounded-lg border border-ink-100 bg-surface px-3 py-2 text-sm text-ink-900 outline-none placeholder:text-ink-400"
        />
        <select
          value={stageFilter}
          onChange={(e) => setStageFilter(e.target.value)}
          className="rounded-lg border border-ink-100 bg-surface px-3 py-2 text-sm text-ink-900"
        >
          <option value="ALL">كل المراحل</option>
          {Object.entries(STAGE_LABEL).map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {filtered && filtered.length === 0 && <p className="text-sm text-ink-400">ما فيه نتائج مطابقة.</p>}

      {filtered && filtered.length > 0 && (
        <div className="overflow-x-auto rounded-xl2 border border-ink-100 bg-surface">
          <table className="w-full text-sm">
            <thead className="bg-ink-50 text-ink-500">
              <tr>
                <th className="px-4 py-2 text-right">الاسم</th>
                <th className="px-4 py-2 text-right">المصدر</th>
                <th className="px-4 py-2 text-right">المرحلة</th>
                <th className="px-4 py-2 text-right">المسؤول</th>
                <th className="px-4 py-2 text-right">تاريخ الإضافة</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((l) => (
                <tr key={l.id} onClick={() => setOpenLeadId(l.id)} className="cursor-pointer border-t border-ink-100 hover:bg-ink-50">
                  <td className="px-4 py-2">
                    <p className="font-semibold text-ink-900">{l.name}</p>
                    <p className="text-xs text-ink-400">{l.email ?? '—'}</p>
                  </td>
                  <td className="px-4 py-2 text-ink-500">{SOURCE_LABEL[l.source] ?? l.source}</td>
                  <td className="px-4 py-2 text-ink-500">{STAGE_LABEL[l.stage] ?? l.stage}</td>
                  <td className="px-4 py-2 text-ink-500">{l.assignedTo?.name ?? l.assignedTo?.email ?? '—'}</td>
                  <td className="px-4 py-2 text-ink-500">{new Date(l.createdAt).toLocaleDateString('ar-SA')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {openLead && <LeadDrawer lead={openLead} employees={staff} onClose={() => setOpenLeadId(null)} onChanged={load} />}
    </div>
  );
}
