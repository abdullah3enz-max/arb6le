import { PrismaClient, Prisma } from '@prisma/client';

declare global {
  // eslint-disable-next-line no-var
  var __prisma: ReturnType<typeof createClient> | undefined;
}

/**
 * Neon (like any auto-suspending serverless Postgres) can take a few seconds to wake its compute
 * after idle time — the first query after that window fails with "Can't reach database server"
 * even though nothing is actually wrong. That error means the connection was never established,
 * so no write could have partially executed — retrying is always safe, reads and writes alike.
 * This is a real, observed failure mode here (not hypothetical), so it's handled once, centrally,
 * rather than every route needing its own try/catch for it.
 */
function isRetryableConnectionError(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientInitializationError) return true;
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P1001';
}

function createClient() {
  const base = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error']
  });

  return base.$extends({
    query: {
      $allOperations: async ({ query, args }) => {
        const maxAttempts = 2;
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
          try {
            return await query(args);
          } catch (error) {
            if (attempt === maxAttempts || !isRetryableConnectionError(error)) throw error;
            await new Promise((resolve) => setTimeout(resolve, 1500));
          }
        }
        throw new Error('unreachable');
      }
    }
  });
}

export const db = global.__prisma ?? createClient();

if (process.env.NODE_ENV !== 'production') {
  global.__prisma = db;
}
