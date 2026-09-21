import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// Public, unauthenticated on purpose: this is what you hit from outside (or CranL's own health
// check) to tell "the box is up but the DB is unreachable" apart from "the whole thing is down" —
// gating it behind a session would defeat that, since a DB outage usually takes login down too.
export async function GET() {
  const startedAt = Date.now();
  try {
    await db.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: 'ok', db: 'ok', dbLatencyMs: Date.now() - startedAt });
  } catch (error) {
    return NextResponse.json(
      { status: 'degraded', db: 'error', error: error instanceof Error ? error.message : 'unknown' },
      { status: 503 }
    );
  }
}
