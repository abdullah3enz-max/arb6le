import { PERMISSIONS } from '@/lib/rbac/permissions';

const PERMISSION_LABEL = new Map<string, string>(PERMISSIONS.map((p) => [p.key, p.descriptionAr]));

const ROLE_LABEL: Record<string, string> = {
  OWNER: 'المالك',
  ADMIN: 'مدير',
  SUPPORT: 'الدعم',
  SALES: 'المبيعات',
  FINANCE: 'المالية',
  ANALYST: 'محلل'
};

const PLAN_LABEL: Record<string, string> = { FREE: 'مجاني', PLUS: 'بلَس', PRO: 'برو' };

const STAGE_LABEL: Record<string, string> = {
  LEAD: 'عميل محتمل',
  CONTACTED: 'تم التواصل',
  TRIAL: 'تجربة',
  QUALIFIED: 'مؤهّل',
  PAID: 'مدفوع',
  RETENTION: 'احتفاظ',
  CHURNED: 'منسحب'
};

export interface AuditLogLike {
  action: string;
  metaJson: unknown;
}

type TargetLookup = (userId: string) => string | undefined; // returns a display name/email, if known

/**
 * Item 16's own example is "Ahmed changed Abdullah's subscription from Basic → Pro" — a raw
 * `metaJson` dump (`{"target":"...","planCode":"PRO"}`) is not that. This turns each known
 * action into one readable Arabic sentence; unrecognized actions fall back to the raw key so
 * nothing is silently hidden.
 */
export function describeAuditLog(log: AuditLogLike, resolveTarget: TargetLookup): string {
  const meta = (log.metaJson ?? {}) as Record<string, unknown>;
  const targetName = (id: unknown) => (typeof id === 'string' ? (resolveTarget(id) ?? id) : 'مستخدم محذوف');

  switch (log.action) {
    case 'admin.user_status_changed':
      return `غيّر حالة ${targetName(meta.target)} إلى ${meta.status === 'ACTIVE' ? 'فعّال' : 'معطّل'}`;
    case 'admin.plan_changed':
      return `غيّر خطة ${targetName(meta.target)} إلى ${PLAN_LABEL[meta.planCode as string] ?? meta.planCode}`;
    case 'admin.plan_updated':
      return `حدّث إعدادات باقة ${PLAN_LABEL[meta.code as string] ?? meta.code}`;
    case 'admin.employee_created':
      return `أضاف موظفًا جديدًا (${meta.email}) بدور ${ROLE_LABEL[meta.role as string] ?? meta.role}`;
    case 'admin.employee_status_changed':
      return `غيّر حالة الموظف ${targetName(meta.target)} إلى ${meta.status === 'ACTIVE' ? 'فعّال' : 'معلّق'}`;
    case 'admin.permission_updated': {
      const permLabel = PERMISSION_LABEL.get(meta.key as string) ?? meta.key;
      const verb = meta.granted ? 'منح' : 'سحب';
      if (meta.scope === 'role') {
        return `${verb} صلاحية "${permLabel}" لدور ${ROLE_LABEL[meta.role as string] ?? meta.role}`;
      }
      return `${verb} صلاحية "${permLabel}" كاستثناء لـ ${targetName(meta.userId)}`;
    }
    case 'admin.lead_created':
      return `أضاف عميلًا محتملًا جديدًا (${meta.name})`;
    case 'admin.lead_updated':
      return `حدّث بيانات العميل المحتمل ${meta.name}`;
    case 'admin.lead_stage_changed':
      return `نقل ${meta.name} من "${STAGE_LABEL[meta.from as string] ?? meta.from}" إلى "${STAGE_LABEL[meta.to as string] ?? meta.to}"`;
    case 'admin.lead_note_added':
      return `أضاف ملاحظة على ${meta.name}`;
    case 'admin.lead_deleted':
      return `حذف العميل المحتمل ${meta.name}`;
    case 'user.registered':
      return 'أنشأ حسابًا جديدًا';
    case 'document.uploaded':
      return 'رفع ملفًا للمعالجة';
    default:
      return log.action;
  }
}

/** Every metaJson shape above that references another account uses either `target` or `userId`. */
export function extractTargetUserIds(metaJson: unknown): string[] {
  const meta = (metaJson ?? {}) as Record<string, unknown>;
  return [meta.target, meta.userId].filter((v): v is string => typeof v === 'string');
}
