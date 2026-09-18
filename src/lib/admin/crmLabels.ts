export const STAGE_ORDER = ['LEAD', 'CONTACTED', 'TRIAL', 'QUALIFIED', 'PAID', 'RETENTION', 'CHURNED'] as const;

export const STAGE_LABEL: Record<string, string> = {
  LEAD: 'عميل محتمل',
  CONTACTED: 'تم التواصل',
  TRIAL: 'تجربة',
  QUALIFIED: 'مؤهّل',
  PAID: 'مدفوع',
  RETENTION: 'احتفاظ',
  CHURNED: 'منسحب'
};

export const SOURCE_LABEL: Record<string, string> = {
  INSTAGRAM: '📷 Instagram',
  TIKTOK: '🎵 TikTok',
  X: '𝕏',
  GOOGLE: '🔍 Google',
  REFERRAL: '🔗 إحالة',
  WEBSITE: '🌐 الموقع',
  CAMPAIGN: '📣 حملة',
  OTHER: '❓ أخرى'
};

export const SOURCES = Object.keys(SOURCE_LABEL);
export const PLAN_LABEL: Record<string, string> = { FREE: 'مجاني', PLUS: 'بلَس', PRO: 'برو' };
