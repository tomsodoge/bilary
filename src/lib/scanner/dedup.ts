import { eq, and } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '@/lib/db/schema';
import { invoiceCandidates } from '@/lib/db/schema';

export async function getExistingMessageIds(
  db: PostgresJsDatabase<typeof schema>,
  userId: string,
  year: number
): Promise<Set<string>> {
  const rows = await db
    .select({ emailMessageId: invoiceCandidates.emailMessageId })
    .from(invoiceCandidates)
    .where(and(eq(invoiceCandidates.userId, userId), eq(invoiceCandidates.year, year)));

  return new Set(rows.map((r) => r.emailMessageId));
}
