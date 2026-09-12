import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { db } from '@/lib/db';
import { requireUser, AuthError } from '@/lib/auth';
import { validateUploadedFile, FileValidationError } from '@/lib/security/fileValidation';
import { getStorageDriver } from '@/lib/storage';
import { checkAndTrackUsage, getActivePlan, EntitlementError } from '@/lib/billing/entitlements';
import { enforceRateLimit, RateLimitError } from '@/lib/security/rateLimit';
import { runPipeline } from '@/lib/ai/pipeline';

export async function GET() {
  try {
    const user = await requireUser();
    // Tenant isolation: always scoped by the session's own userId, never a client-supplied one.
    const documents = await db.document.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      select: { id: true, fileName: true, fileType: true, status: true, pageCount: true, createdAt: true, errorMessage: true }
    });
    return NextResponse.json({ documents });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: 'يجب تسجيل الدخول.' }, { status: 401 });
    return NextResponse.json({ error: 'فشل جلب الملفات.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    enforceRateLimit(`upload:${user.id}`, 10, 60_000);

    const plan = await getActivePlan(user.id);
    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'لم يتم إرسال ملف.' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const fileType = validateUploadedFile({
      fileName: file.name,
      mimeType: file.type,
      sizeBytes: buffer.byteLength,
      buffer,
      planCode: plan.code
    });

    const contentHash = createHash('sha256').update(buffer).digest('hex');

    const duplicate = await db.document.findUnique({ where: { userId_contentHash: { userId: user.id, contentHash } } });
    if (duplicate) {
      return NextResponse.json({ id: duplicate.id, duplicate: true });
    }

    await checkAndTrackUsage(user.id, 'documents', 'maxDocuments');

    const storageKey = `${user.id}/${contentHash}-${file.name}`;
    await getStorageDriver().write(storageKey, buffer);

    const document = await db.document.create({
      data: {
        userId: user.id,
        fileName: file.name,
        fileType,
        fileSizeKb: Math.round(buffer.byteLength / 1024),
        storageKey,
        contentHash,
        status: 'UPLOADED'
      }
    });

    await db.auditLog.create({ data: { userId: user.id, action: 'document.uploaded', metaJson: { documentId: document.id } } });

    // Fire-and-forget: the pipeline runs in the background and updates Document.status as it
    // progresses; the client polls GET /api/documents/[id] to drive the ProcessingSteps UI.
    // A real deployment should hand this to a queue (BullMQ/Redis) instead of an in-process
    // promise — see docs/ARCHITECTURE.md §10.
    runPipeline(document.id).catch((err) => console.error('Pipeline failed', document.id, err));

    return NextResponse.json({ id: document.id, duplicate: false });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: 'يجب تسجيل الدخول.' }, { status: 401 });
    if (error instanceof FileValidationError) return NextResponse.json({ error: error.message }, { status: 400 });
    if (error instanceof EntitlementError) return NextResponse.json({ error: error.message }, { status: 402 });
    if (error instanceof RateLimitError) return NextResponse.json({ error: error.message }, { status: 429 });
    console.error(error);
    return NextResponse.json({ error: 'فشل رفع الملف.' }, { status: 500 });
  }
}
