'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

const ROLE_LABELS: Record<string, string> = {
  STUDENT: 'طالب',
  OWNER: 'مالك',
  ADMIN: 'مدير',
  SUPPORT: 'دعم فني',
  SALES: 'مبيعات',
  FINANCE: 'مالية',
  ANALYST: 'محلل بيانات'
};

export function AccountClient({
  initialName,
  email,
  createdAt,
  role
}: {
  initialName: string;
  email: string;
  createdAt: string;
  role: string;
}) {
  const router = useRouter();
  const initial = (initialName || email).trim().charAt(0).toUpperCase();
  const joinedLabel = new Date(createdAt).toLocaleDateString('ar', { year: 'numeric', month: 'long', day: 'numeric' });

  // --- profile form ---
  const [name, setName] = useState(initialName);
  const [newEmail, setNewEmail] = useState(email);
  const [profilePassword, setProfilePassword] = useState('');
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const emailChanged = newEmail.trim() !== email;

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setProfileMsg(null);
    setProfileLoading(true);
    try {
      const res = await fetch('/api/account', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name,
          ...(emailChanged ? { email: newEmail.trim(), currentPassword: profilePassword } : {})
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'فشل تحديث الحساب.');
      setProfileMsg({ type: 'ok', text: 'تم حفظ التغييرات بنجاح ✅' });
      setProfilePassword('');
      router.refresh();
    } catch (err) {
      setProfileMsg({ type: 'err', text: err instanceof Error ? err.message : 'خطأ غير متوقع.' });
    } finally {
      setProfileLoading(false);
    }
  }

  // --- password form ---
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwLoading, setPwLoading] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwMsg(null);
    if (newPassword !== confirmPassword) {
      setPwMsg({ type: 'err', text: 'كلمتا المرور الجديدتان غير متطابقتين.' });
      return;
    }
    setPwLoading(true);
    try {
      const res = await fetch('/api/account/password', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'فشل تغيير كلمة المرور.');
      setPwMsg({ type: 'ok', text: 'تم تغيير كلمة المرور بنجاح ✅' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setPwMsg({ type: 'err', text: err instanceof Error ? err.message : 'خطأ غير متوقع.' });
    } finally {
      setPwLoading(false);
    }
  }

  return (
    <div className="mt-8 space-y-6 pb-16">
      {/* Hero */}
      <div className="glass animate-fade-up flex flex-col items-center gap-4 rounded-2xl border border-ink-100 p-6 text-center sm:flex-row sm:items-center sm:text-right">
        <div className="relative shrink-0">
          <span className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-accent-500 to-accent-700 text-3xl font-extrabold text-white shadow-glow">
            {initial}
          </span>
        </div>
        <div className="min-w-0">
          <h1 className="truncate text-xl font-extrabold text-ink-900">{initialName || 'بدون اسم'}</h1>
          <p className="truncate text-sm text-ink-500">{email}</p>
          <div className="mt-2 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
            <span className="rounded-full bg-accent-50 px-3 py-1 text-xs font-bold text-accent-600">
              {ROLE_LABELS[role] ?? role}
            </span>
            <span className="text-xs text-ink-400">عضو منذ {joinedLabel}</span>
          </div>
        </div>
      </div>

      {/* Profile info */}
      <form
        onSubmit={saveProfile}
        className="animate-fade-up rounded-2xl border border-ink-100 bg-surface p-6 shadow-card"
        style={{ animationDelay: '60ms' }}
      >
        <h2 className="mb-1 flex items-center gap-2 text-lg font-bold text-ink-900">👤 معلوماتك الشخصية</h2>
        <p className="mb-5 text-sm text-ink-400">عدّل اسمك أو بريدك الإلكتروني.</p>

        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-ink-500">الاسم</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border border-ink-100 bg-surface px-4 py-3 text-sm text-ink-900 outline-none placeholder:text-ink-400 focus:border-accent-500"
              placeholder="اسمك"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-ink-500">البريد الإلكتروني</label>
            <input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              className="w-full rounded-xl border border-ink-100 bg-surface px-4 py-3 text-sm text-ink-900 outline-none placeholder:text-ink-400 focus:border-accent-500"
              placeholder="بريدك الإلكتروني"
            />
          </div>

          {emailChanged && (
            <div className="animate-fade-up rounded-xl bg-ink-50 p-3">
              <label className="mb-1.5 block text-xs font-semibold text-ink-500">
                أدخل كلمة المرور الحالية لتأكيد تغيير البريد
              </label>
              <input
                type="password"
                value={profilePassword}
                onChange={(e) => setProfilePassword(e.target.value)}
                className="w-full rounded-xl border border-ink-100 bg-surface px-4 py-3 text-sm text-ink-900 outline-none placeholder:text-ink-400 focus:border-accent-500"
                placeholder="كلمة المرور الحالية"
              />
            </div>
          )}

          {profileMsg && (
            <p className={`text-sm ${profileMsg.type === 'ok' ? 'text-emerald-500' : 'text-accent-600'}`}>{profileMsg.text}</p>
          )}

          <button
            disabled={profileLoading}
            className="w-full rounded-xl bg-accent-500 py-3 text-sm font-bold text-white transition hover:bg-accent-600 disabled:opacity-50 sm:w-auto sm:px-8"
          >
            {profileLoading ? '...' : 'حفظ التغييرات'}
          </button>
        </div>
      </form>

      {/* Password */}
      <form
        onSubmit={savePassword}
        className="animate-fade-up rounded-2xl border border-ink-100 bg-surface p-6 shadow-card"
        style={{ animationDelay: '120ms' }}
      >
        <h2 className="mb-1 flex items-center gap-2 text-lg font-bold text-ink-900">🔒 تغيير كلمة المرور</h2>
        <p className="mb-5 text-sm text-ink-400">اختر كلمة مرور قوية لحماية حسابك.</p>

        <div className="space-y-4">
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="w-full rounded-xl border border-ink-100 bg-surface px-4 py-3 text-sm text-ink-900 outline-none placeholder:text-ink-400 focus:border-accent-500"
            placeholder="كلمة المرور الحالية"
          />
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full rounded-xl border border-ink-100 bg-surface px-4 py-3 text-sm text-ink-900 outline-none placeholder:text-ink-400 focus:border-accent-500"
            placeholder="كلمة المرور الجديدة (8 أحرف على الأقل)"
          />
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full rounded-xl border border-ink-100 bg-surface px-4 py-3 text-sm text-ink-900 outline-none placeholder:text-ink-400 focus:border-accent-500"
            placeholder="تأكيد كلمة المرور الجديدة"
          />

          {pwMsg && <p className={`text-sm ${pwMsg.type === 'ok' ? 'text-emerald-500' : 'text-accent-600'}`}>{pwMsg.text}</p>}

          <button
            disabled={pwLoading}
            className="w-full rounded-xl bg-accent-500 py-3 text-sm font-bold text-white transition hover:bg-accent-600 disabled:opacity-50 sm:w-auto sm:px-8"
          >
            {pwLoading ? '...' : 'تحديث كلمة المرور'}
          </button>
        </div>
      </form>
    </div>
  );
}
