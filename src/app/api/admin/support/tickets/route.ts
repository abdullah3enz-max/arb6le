import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { AuthError } from '@/lib/auth';
import { requirePermission } from '@/lib/rbac';

export async function GET() {
  try {
    await requirePermission('tickets.view');

    const tickets = await db.supportTicket.findMany({
      orderBy: { lastMessageAt: 'desc' },
      include: {
        user: { select: { id: true, email: true, name: true } },
        assignedTo: { select: { id: true, email: true, name: true } },
        _count: { select: { messages: true } }
      }
    });

    return NextResponse.json({ tickets });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: 'غير مسموح.' }, { status: 403 });
    return NextResponse.json({ error: 'فشل جلب تذاكر الدعم.' }, { status: 500 });
  }
}
