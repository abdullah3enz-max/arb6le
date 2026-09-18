import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { AuthError } from '@/lib/auth';
import { requirePermission } from '@/lib/rbac';
import { describeAuditLog, extractTargetUserIds } from '@/lib/admin/auditFormat';

const PAGE_SIZE = 40;

/** Read-only by design (item 16) — there is deliberately no PATCH/DELETE on this route. */
export async function GET(req: NextRequest) {
  try {
    await requirePermission('audit_logs.view');

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, Number(searchParams.get('page') ?? '1'));
    const action = searchParams.get('action')?.trim();
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    const where = {
      ...(action ? { action: { contains: action, mode: 'insensitive' as const } } : {}),
      ...(from || to
        ? {
            createdAt: {
              ...(from ? { gte: new Date(from) } : {}),
              ...(to ? { lte: new Date(to) } : {})
            }
          }
        : {})
    };

    const [logs, total] = await Promise.all([
      db.auditLog.findMany({
        where,
        include: { user: { select: { email: true, name: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE
      }),
      db.auditLog.count({ where })
    ]);

    const targetIds = Array.from(new Set(logs.flatMap((l) => extractTargetUserIds(l.metaJson))));
    const targetUsers = await db.user.findMany({ where: { id: { in: targetIds } }, select: { id: true, email: true, name: true } });
    const targetMap = new Map(targetUsers.map((u) => [u.id, u.name ?? u.email]));

    const enriched = logs.map((l) => ({
      ...l,
      summary: describeAuditLog(l, (id) => targetMap.get(id))
    }));

    return NextResponse.json({ logs: enriched, total, page, pageSize: PAGE_SIZE });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: 'غير مسموح.' }, { status: 403 });
    return NextResponse.json({ error: 'فشل جلب سجل الأمان.' }, { status: 500 });
  }
}
