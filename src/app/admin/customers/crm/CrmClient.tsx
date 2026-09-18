'use client';

import { useEffect, useState } from 'react';
import { STAGE_LABEL, STAGE_ORDER, SOURCE_LABEL } from '@/lib/admin/crmLabels';
import { LeadDrawer, type Lead } from '@/components/admin/LeadDrawer';

interface Staff {
  id: string;
  email: string;
  name: string | null;
}

export function CrmClient() {
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [openLeadId, setOpenLeadId] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', source: 'OTHER' });
  const [creating, setCreating] = useState(false);

  function load() {
    fetch('/api/admin/leads')
      .then((r) => r.json())
      .then((d) => (d.error ? setError(d.error) : setLeads(d.leads)));
  }

  useEffect(() => {
    load();
    fetch('/api/admin/leads/assignees')
      .then((r) => r.json())
      .then((d) => !d.error && setStaff(d.staff));
  }, []);

  async function moveLead(leadId: string, stage: string) {
    setLeads((prev) => (prev ? prev.map((l) => (l.id === leadId ? { ...l, stage } : l)) : prev));
    await fetch(`/api/admin/leads/${leadId}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ stage })
    });
    load();
  }

  async function createLead(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await fetch('/api/admin/leads', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(form)
      });
      if (res.ok) {
        setFormOpen(false);
        setForm({ name: '', email: '', source: 'OTHER' });
        load();
      }
    } finally {
      setCreating(false);
    }
  }

  if (error) return <p className="text-sm font-semibold text-accent-600">{error}</p>;
  if (!leads) return <p className="text-sm text-ink-400">جاري التحميل...</p>;

  const openLead = leads.find((l) => l.id === openLeadId) ?? null;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold text-ink-900">CRM — خط الأنابيب</h1>
          <p className="mt-1 text-sm text-ink-500">اسحب البطاقة بين الأعمدة لتغيير مرحلة العميل المحتمل.</p>
        </div>
        <button
          onClick={() => setFormOpen((v) => !v)}
          className="rounded-full bg-accent-500 px-4 py-2 text-sm font-bold text-white hover:bg-accent-600"
        >
          + عميل محتمل
        </button>
      </div>

      {formOpen && (
        <form onSubmit={createLead} className="flex flex-wrap items-end gap-3 rounded-xl2 border border-ink-100 bg-surface p-4">
          <div>
            <label className="mb-1 block text-xs font-bold text-ink-400">الاسم</label>
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="rounded-lg border border-ink-100 bg-surface px-3 py-2 text-sm text-ink-900"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold text-ink-400">البريد</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="rounded-lg border border-ink-100 bg-surface px-3 py-2 text-sm text-ink-900"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold text-ink-400">المصدر</label>
            <select
              value={form.source}
              onChange={(e) => setForm({ ...form, source: e.target.value })}
              className="rounded-lg border border-ink-100 bg-surface px-3 py-2 text-sm text-ink-900"
            >
              {Object.entries(SOURCE_LABEL).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" disabled={creating} className="rounded-full bg-accent-500 px-5 py-2 text-sm font-bold text-white disabled:opacity-50">
            {creating ? 'جاري الإضافة...' : 'إضافة'}
          </button>
        </form>
      )}

      <div className="scrollbar-thin flex gap-3 overflow-x-auto pb-3">
        {STAGE_ORDER.map((stage) => {
          const stageLeads = leads.filter((l) => l.stage === stage);
          return (
            <div
              key={stage}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOverStage(stage);
              }}
              onDragLeave={() => setDragOverStage((s) => (s === stage ? null : s))}
              onDrop={(e) => {
                e.preventDefault();
                const leadId = e.dataTransfer.getData('text/lead-id');
                if (leadId) moveLead(leadId, stage);
                setDragOverStage(null);
              }}
              className={
                'w-64 shrink-0 rounded-xl2 border p-2 ' +
                (dragOverStage === stage ? 'border-accent-500 bg-accent-50' : 'border-ink-100 bg-ink-50/60')
              }
            >
              <div className="mb-2 flex items-center justify-between px-2 pt-1">
                <span className="text-xs font-bold text-ink-700">{STAGE_LABEL[stage]}</span>
                <span className="rounded-full bg-ink-100 px-2 py-0.5 text-[10px] font-bold text-ink-500">{stageLeads.length}</span>
              </div>
              <div className="space-y-2">
                {stageLeads.map((lead) => (
                  <div
                    key={lead.id}
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData('text/lead-id', lead.id)}
                    onClick={() => setOpenLeadId(lead.id)}
                    className="cursor-pointer rounded-xl border border-ink-100 bg-surface p-3 shadow-card hover:border-accent-200"
                  >
                    <p className="text-sm font-bold text-ink-900">{lead.name}</p>
                    <p className="mt-0.5 text-xs text-ink-400">{SOURCE_LABEL[lead.source] ?? lead.source}</p>
                    {lead.assignedTo && (
                      <p className="mt-1 text-[11px] text-ink-500">👤 {lead.assignedTo.name ?? lead.assignedTo.email}</p>
                    )}
                  </div>
                ))}
                {stageLeads.length === 0 && <p className="px-2 py-3 text-center text-[11px] text-ink-300">فاضي</p>}
              </div>
            </div>
          );
        })}
      </div>

      {openLead && (
        <LeadDrawer
          lead={openLead}
          employees={staff}
          onClose={() => setOpenLeadId(null)}
          onChanged={load}
        />
      )}
    </div>
  );
}
