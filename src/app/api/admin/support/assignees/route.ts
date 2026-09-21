import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { AuthError } from '@/lib/auth';
import { requirePermission } from '@/lib/rbac';

const STAFF_ROLES = ['OWNER', 'ADMIN', 'SUPPORT', 'SALES', 'FINANCE', 'ANALYST'] as const;

/** Ticket-assignment dropdown's staff list, gated by tickets.view (mirrors leads/assignees). */
export async function GET() {
  try {
    await requirePermission('tickets.view');
    const staff = await db.user.findMany({
      where: { role: { in: [...STAFF_ROLES] } },
      select: { id: true, email: true, name: true },
      orderBy: { email: 'asc' }
    });
    return NextResponse.json({ staff });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: 'غير مسموح.' }, { status: 403 });
    return NextResponse.json({ error: 'فشل جلب الموظفين.' }, { status: 500 });
  }
}
