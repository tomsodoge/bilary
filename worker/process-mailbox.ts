import { eq, and } from 'drizzle-orm';
import { createClient } from '@supabase/supabase-js';
import type { GmailTokens, ImapConfig, GmailCheckpoint, ImapCheckpoint } from '../src/types';
import type { ParsedEmail } from '../src/types';
import { db } from './db';
import {
  mailboxes,
  scanRuns,
  scanTasks,
  buckets,
  invoiceCandidates,
} from '../src/lib/db/schema';
import { decryptJson } from '../src/lib/crypto';
import { listMessageIds, fetchMessages as gmailFetchMessages, downloadAttachment as gmailDownloadAttachment, refreshAccessToken } from '../src/lib/connectors/gmail';
import { listMessageUids, fetchMessages as imapFetchMessages, downloadAttachment as imapDownloadAttachment } from '../src/lib/connectors/imap';
import { classifyEmail } from '../src/lib/classifier/heuristics';
import { getExistingMessageIds } from '../src/lib/scanner/dedup';
import { BATCH_SIZE } from '../src/lib/scanner/pipeline';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface ScanTaskRow {
  id: number;
  scanRunId: number;
  mailboxId: number;
  userId: string;
  status: string;
  totalMessages: number | null;
  processedMessages: number | null;
  foundInvoices: number | null;
  checkpoint: GmailCheckpoint | ImapCheckpoint | null;
}

export async function processMailboxTask(task: ScanTaskRow): Promise<void> {
  const [mailboxRow] = await db
    .select()
    .from(mailboxes)
    .where(eq(mailboxes.id, task.mailboxId))
    .limit(1);

  if (!mailboxRow) {
    throw new Error(`Mailbox ${task.mailboxId} not found`);
  }

  const [scanRunRow] = await db
    .select()
    .from(scanRuns)
    .where(eq(scanRuns.id, task.scanRunId))
    .limit(1);

  if (!scanRunRow) {
    throw new Error(`Scan run ${task.scanRunId} not found`);
  }

  const year = scanRunRow.year;
  const credentials = decryptJson<GmailTokens | ImapConfig>(mailboxRow.credentials);
  const isGmail = mailboxRow.type === 'gmail';

  let messageIds: string[] = [];
  let uids: number[] = [];
  let checkpoint = task.checkpoint as GmailCheckpoint | ImapCheckpoint | null;

  // Listing phase
  if (!checkpoint || checkpoint.phase !== 'processing') {
    if (isGmail) {
      const tokens = credentials as GmailTokens;
      if (tokens.expiry && tokens.expiry < Math.floor(Date.now() / 1000) + 300) {
        const refreshed = await refreshAccessToken(tokens);
        await db
          .update(mailboxes)
          .set({ credentials: JSON.stringify(refreshed) })
          .where(eq(mailboxes.id, task.mailboxId));
        Object.assign(credentials, refreshed);
      }
      messageIds = await listMessageIds(credentials as GmailTokens, year);
      checkpoint = { phase: 'processing', messageIds, nextBatchStart: 0 };
    } else {
      uids = await listMessageUids(credentials as ImapConfig, year);
      checkpoint = { phase: 'processing', uids, lastProcessedIndex: -1 };
    }

    await db
      .update(scanTasks)
      .set({
        totalMessages: isGmail ? messageIds.length : uids.length,
        checkpoint,
      })
      .where(eq(scanTasks.id, task.id));
  } else {
    messageIds = (checkpoint as GmailCheckpoint).messageIds ?? [];
    uids = (checkpoint as ImapCheckpoint).uids ?? [];
  }

  const ids = isGmail ? messageIds : uids;
  const totalCount = ids.length;

  if (totalCount === 0) {
    await db
      .update(scanTasks)
      .set({ status: 'completed', completedAt: new Date() })
      .where(eq(scanTasks.id, task.id));
    return;
  }

  const dedupSet = await getExistingMessageIds(db, task.userId, year);
  let nextBatchStart = (checkpoint as GmailCheckpoint).nextBatchStart ?? (checkpoint as ImapCheckpoint).lastProcessedIndex ?? 0;
  if (nextBatchStart > 0 && (checkpoint as ImapCheckpoint).lastProcessedIndex !== undefined) {
    nextBatchStart = ((checkpoint as ImapCheckpoint).lastProcessedIndex ?? -1) + 1;
  }

  let processedCount = task.processedMessages ?? 0;
  let foundCount = task.foundInvoices ?? 0;

  while (nextBatchStart < totalCount) {
    const [runCheck] = await db
      .select({ status: scanRuns.status })
      .from(scanRuns)
      .where(eq(scanRuns.id, task.scanRunId))
      .limit(1);

    if (runCheck?.status === 'cancelled') {
      await db
        .update(scanTasks)
        .set({ status: 'completed', completedAt: new Date() })
        .where(eq(scanTasks.id, task.id));
      return;
    }

    const batchIds = isGmail
      ? (ids as string[]).slice(nextBatchStart, nextBatchStart + BATCH_SIZE)
      : (ids as number[]).slice(nextBatchStart, nextBatchStart + BATCH_SIZE);

    let messages: ParsedEmail[];
    if (isGmail) {
      const tokens = credentials as GmailTokens;
      if (tokens.expiry && tokens.expiry < Math.floor(Date.now() / 1000) + 300) {
        const refreshed = await refreshAccessToken(tokens);
        await db
          .update(mailboxes)
          .set({ credentials: JSON.stringify(refreshed) })
          .where(eq(mailboxes.id, task.mailboxId));
        Object.assign(credentials, refreshed);
      }
      messages = await gmailFetchMessages(tokens, batchIds as string[]);
    } else {
      messages = await imapFetchMessages(credentials as ImapConfig, batchIds as number[]);
    }

    for (const email of messages) {
      const dedupId = email.emailMessageId || email.messageId;
      if (dedupSet.has(dedupId)) continue;

      const result = classifyEmail(email);
      if (!result.classified || !result.type) continue;

      dedupSet.add(dedupId);
      foundCount++;

      await db
        .insert(buckets)
        .values({
          userId: task.userId,
          senderEmail: email.from,
          senderDisplayName: email.fromName || null,
          year,
        })
        .onConflictDoNothing();

      const [bucket] = await db
        .select()
        .from(buckets)
        .where(
          and(
            eq(buckets.userId, task.userId),
            eq(buckets.senderEmail, email.from),
            eq(buckets.year, year)
          )
        )
        .limit(1);

      if (!bucket) continue;

      if (result.type === 'portal_link' && result.portalUrl) {
        await db
          .insert(invoiceCandidates)
          .values({
            userId: task.userId,
            bucketId: bucket.id,
            scanRunId: task.scanRunId,
            mailboxId: task.mailboxId,
            emailMessageId: dedupId,
            emailSubject: email.subject.slice(0, 1000),
            emailDate: email.date,
            type: 'portal_link',
            filename: '',
            portalUrl: result.portalUrl,
            confidenceScore: result.confidenceScore ?? null,
            classificationMethod: 'heuristic',
            year,
          })
          .onConflictDoNothing();
      } else if (result.type === 'attachment' && email.attachments.length > 0) {
        for (const att of email.attachments) {
          let buffer: Buffer;
          if (isGmail) {
            buffer = await gmailDownloadAttachment(
              credentials as GmailTokens,
              email.messageId,
              att.attachmentId
            );
          } else {
            buffer = att.content
              ? Buffer.isBuffer(att.content)
                ? att.content
                : Buffer.from(att.content)
              : await imapDownloadAttachment(
                  credentials as ImapConfig,
                  parseInt(email.messageId, 10),
                  att.attachmentId
                );
          }

          const storagePath = `${task.userId}/${year}/${bucket.id}/${att.filename}`;
          await supabase.storage
            .from('documents')
            .upload(storagePath, buffer, {
              contentType: att.mimeType || 'application/octet-stream',
              upsert: true,
            });

          await db
            .insert(invoiceCandidates)
            .values({
              userId: task.userId,
              bucketId: bucket.id,
              scanRunId: task.scanRunId,
              mailboxId: task.mailboxId,
              emailMessageId: dedupId,
              emailSubject: email.subject.slice(0, 1000),
              emailDate: email.date,
              type: 'attachment',
              filename: att.filename,
              mimeType: att.mimeType,
              fileSize: att.size,
              storagePath,
              confidenceScore: result.confidenceScore ?? null,
              classificationMethod: 'heuristic',
              year,
            })
            .onConflictDoNothing();
        }
      } else if (result.type === 'attachment' && email.attachments.length === 0) {
        await db
          .insert(invoiceCandidates)
          .values({
            userId: task.userId,
            bucketId: bucket.id,
            scanRunId: task.scanRunId,
            mailboxId: task.mailboxId,
            emailMessageId: dedupId,
            emailSubject: email.subject.slice(0, 1000),
            emailDate: email.date,
            type: 'portal_link',
            filename: '',
            portalUrl: result.portalUrl ?? null,
            confidenceScore: result.confidenceScore ?? null,
            classificationMethod: 'heuristic',
            year,
          })
          .onConflictDoNothing();
      }
    }

    processedCount += messages.length;
    const newNextBatchStart = nextBatchStart + batchIds.length;
    const newCheckpoint = isGmail
      ? { ...checkpoint, nextBatchStart: newNextBatchStart }
      : { ...checkpoint, lastProcessedIndex: newNextBatchStart - 1 };

    await db
      .update(scanTasks)
      .set({
        processedMessages: processedCount,
        foundInvoices: foundCount,
        checkpoint: newCheckpoint,
      })
      .where(eq(scanTasks.id, task.id));

    checkpoint = newCheckpoint;
    nextBatchStart = newNextBatchStart;
  }

  await db
    .update(scanTasks)
    .set({ status: 'completed', completedAt: new Date() })
    .where(eq(scanTasks.id, task.id));
}
