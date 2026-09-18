import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { db } from '@/lib/db';
import { requireUser, AuthError } from '@/lib/auth';
import { validateExtractedDocument, FileValidationError, type ExtractedPageInput } from '@/lib/security/fileValidation';
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

/**
 * The document's text is extracted entirely in the browser (src/lib/client/extractDocument.ts)
 * before this ever runs — this route only ever receives already-extracted text as JSON, never
 * a file. That is a deliberate architecture choice: it removes any need for file storage
 * (temporary or permanent) and the privacy/cost tradeoffs that come with it.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    enforceRateLimit(`upload:${user.id}`, 10, 60_000);

    const plan = await getActivePlan(user.id);
    const body = await req.json().catch(() => null);
    const fileName = typeof body?.fileName === 'string' ? body.fileName.trim() : '';
    if (!fileName) {
      return NextResponse.json({ error: 'اسم الملف مفقود.' }, { status: 400 });
    }

    const fileType = validateExtractedDocument({ fileType: body?.fileType, pages: body?.pages, planCode: plan.code });
    const pages = body.pages as ExtractedPageInput[];

    const contentHash = createHash('sha256')
      .update(pages.map((p) => `${p.pageNumber}:${p.rawText}`).join('\n'))
      .digest('hex');

    const duplicate = await db.document.findUnique({ where: { userId_contentHash: { userId: user.id, contentHash } } });
    if (duplicate) {
      return NextResponse.json({ id: duplicate.id, duplicate: true });
    }

    await checkAndTrackUsage(user.id, 'documents', 'maxDocuments');

    const totalChars = pages.reduce((sum, p) => sum + p.rawText.length, 0);

    const document = await db.document.create({
      data: {
        userId: user.id,
        fileName,
        fileType,
        textSizeKb: Math.max(1, Math.round(totalChars / 1024)),
        contentHash,
        pageCount: pages.length,
        status: 'UPLOADED',
        pages: {
          create: pages.map((p) => ({
            pageNumber: p.pageNumber,
            rawText: p.rawText,
            usedOcr: Boolean(p.usedOcr)
          }))
        }
      }
    });

    await db.auditLog.create({ data: { userId: user.id, action: 'document.uploaded', metaJson: { documentId: document.id } } });

    // Fire-and-forget: pages are already persisted above, so the pipeline starts straight at
    // concept extraction. A real deployment should hand this to a queue (Inngest/BullMQ)
    // instead of an in-process promise — see docs/ARCHITECTURE.md §10.
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
