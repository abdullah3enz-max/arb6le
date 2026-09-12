import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireUser, AuthError } from '@/lib/auth';
import { getStorageDriver } from '@/lib/storage';

/**
 * Stands in for a signed URL in dev (item 40): the "signature" is this route's own
 * ownership check, since storageKey is namespaced `${userId}/...` and we verify the
 * requesting session owns a Document pointing at that exact key before ever touching disk.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  try {
    const user = await requireUser();
    const { key } = await params;
    const storageKey = decodeURIComponent(key);

    const document = await db.document.findFirst({ where: { userId: user.id, storageKey } });
    if (!document) return NextResponse.json({ error: 'غير مسموح.' }, { status: 403 });

    const buffer = await getStorageDriver().read(storageKey);
    return new NextResponse(new Uint8Array(buffer), {
      headers: { 'Content-Type': mimeFor(document.fileType), 'Content-Disposition': `inline; filename="${document.fileName}"` }
    });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: 'يجب تسجيل الدخول.' }, { status: 401 });
    return NextResponse.json({ error: 'فشل جلب الملف.' }, { status: 500 });
  }
}

function mimeFor(type: string) {
  if (type === 'PDF') return 'application/pdf';
  if (type === 'PPTX') return 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
  return 'application/vnd.ms-powerpoint';
}
