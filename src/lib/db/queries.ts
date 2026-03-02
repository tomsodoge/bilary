import { db } from './index';
import { eq, and, sql } from 'drizzle-orm';
import {
  mailboxes,
  scanRuns,
  scanTasks,
  buckets,
  invoiceCandidates,
  receipts,
} from './schema';

export async function getMailboxesForUser(userId: string) {
  return db
    .select({
      id: mailboxes.id,
      type: mailboxes.type,
      displayName: mailboxes.displayName,
      status: mailboxes.status,
      statusMessage: mailboxes.statusMessage,
      lastSyncAt: mailboxes.lastSyncAt,
      createdAt: mailboxes.createdAt,
    })
    .from(mailboxes)
    .where(eq(mailboxes.userId, userId));
}

export async function getScanRunWithTasks(scanRunId: number, userId: string) {
  const run = await db
    .select()
    .from(scanRuns)
    .where(and(eq(scanRuns.id, scanRunId), eq(scanRuns.userId, userId)))
    .limit(1);

  if (run.length === 0) return null;

  const tasks = await db
    .select({
      id: scanTasks.id,
      mailboxId: scanTasks.mailboxId,
      mailboxName: mailboxes.displayName,
      status: scanTasks.status,
      totalMessages: scanTasks.totalMessages,
      processedMessages: scanTasks.processedMessages,
      foundInvoices: scanTasks.foundInvoices,
      errorMessage: scanTasks.errorMessage,
    })
    .from(scanTasks)
    .innerJoin(mailboxes, eq(scanTasks.mailboxId, mailboxes.id))
    .where(eq(scanTasks.scanRunId, scanRunId));

  return { ...run[0], tasks };
}

export async function getBucketsWithCounts(userId: string, year: number) {
  const result = await db
    .select({
      id: buckets.id,
      senderEmail: buckets.senderEmail,
      senderDisplayName: buckets.senderDisplayName,
      year: buckets.year,
      invoiceCount: sql<number>`count(${invoiceCandidates.id})::int`,
      portalCount:
        sql<number>`count(case when ${invoiceCandidates.type} = 'portal_link' then 1 end)::int`,
      pendingCount:
        sql<number>`count(case when ${invoiceCandidates.status} = 'pending' then 1 end)::int`,
    })
    .from(buckets)
    .leftJoin(invoiceCandidates, eq(buckets.id, invoiceCandidates.bucketId))
    .where(and(eq(buckets.userId, userId), eq(buckets.year, year)))
    .groupBy(buckets.id)
    .orderBy(buckets.senderDisplayName);

  return result;
}

export async function getCandidatesForBucket(
  bucketId: number,
  userId: string
) {
  return db
    .select()
    .from(invoiceCandidates)
    .where(
      and(
        eq(invoiceCandidates.bucketId, bucketId),
        eq(invoiceCandidates.userId, userId)
      )
    )
    .orderBy(invoiceCandidates.emailDate);
}

export async function getReceiptsGroupedByBucket(
  userId: string,
  year: number
) {
  const allReceipts = await db
    .select({
      id: receipts.id,
      bucketId: receipts.bucketId,
      filename: receipts.filename,
      mimeType: receipts.mimeType,
      fileSize: receipts.fileSize,
      storagePath: receipts.storagePath,
      source: receipts.source,
      year: receipts.year,
      createdAt: receipts.createdAt,
      senderEmail: buckets.senderEmail,
      senderDisplayName: buckets.senderDisplayName,
    })
    .from(receipts)
    .innerJoin(buckets, eq(receipts.bucketId, buckets.id))
    .where(and(eq(receipts.userId, userId), eq(receipts.year, year)))
    .orderBy(buckets.senderDisplayName, receipts.createdAt);

  const grouped = new Map<
    number,
    {
      bucketId: number;
      senderEmail: string;
      senderDisplayName: string | null;
      receipts: typeof allReceipts;
    }
  >();

  for (const r of allReceipts) {
    if (!grouped.has(r.bucketId)) {
      grouped.set(r.bucketId, {
        bucketId: r.bucketId,
        senderEmail: r.senderEmail,
        senderDisplayName: r.senderDisplayName,
        receipts: [],
      });
    }
    grouped.get(r.bucketId)!.receipts.push(r);
  }

  return Array.from(grouped.values());
}
