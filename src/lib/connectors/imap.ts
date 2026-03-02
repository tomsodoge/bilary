import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import type { ImapConfig, ParsedEmail } from '@/types';
import type { AddressObject } from 'mailparser';
import type { MessageStructureObject } from 'imapflow';

const BODY_MAX_LEN = 2000;
const BATCH_SIZE = 50;

function createClient(config: ImapConfig): ImapFlow {
  return new ImapFlow({
    host: config.host,
    port: config.port,
    secure: config.tls,
    auth: {
      user: config.username,
      pass: config.password,
    },
  });
}

function formatAddress(from: AddressObject | undefined): { email: string; name: string } {
  if (!from?.value?.[0]) {
    return { email: '', name: '' };
  }
  const addr = from.value[0];
  return {
    email: addr.address ?? '',
    name: addr.name ?? addr.address ?? '',
  };
}

function collectAttachmentParts(
  node: MessageStructureObject | null | undefined,
  acc: Array<{ partId: string; filename: string; mimeType: string; size: number }>
): void {
  if (!node) return;

  const mimeType = (node.type ?? '').toLowerCase();
  const disposition = (node.disposition ?? '').toLowerCase();
  const filename =
    node.dispositionParameters?.filename ??
    node.dispositionParameters?.['filename*'] ??
    node.parameters?.name ??
    'attachment';
  const isAttachment =
    disposition === 'attachment' ||
    !!node.dispositionParameters?.filename ||
    (!!filename && !mimeType.startsWith('text/'));

  if (node.childNodes?.length) {
    for (const child of node.childNodes) {
      collectAttachmentParts(child, acc);
    }
    return;
  }

  if (isAttachment && node.part && !mimeType.startsWith('text/')) {
    acc.push({
      partId: node.part,
      filename,
      mimeType: node.type ?? 'application/octet-stream',
      size: node.size ?? 0,
    });
  }
}

export async function testConnection(config: ImapConfig): Promise<{
  ok: boolean;
  error?: string;
}> {
  const client = createClient(config);
  try {
    await client.connect();
    await client.logout();
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  } finally {
    client.close();
  }
}

export async function listMessageUids(config: ImapConfig, year: number): Promise<number[]> {
  const client = createClient(config);
  try {
    await client.connect();
    await client.mailboxOpen('INBOX');

    const since = new Date(year, 0, 1);
    const before = new Date(year + 1, 0, 1);
    const uids = await client.search(
      {
        since,
        before,
      },
      { uid: true }
    );

    await client.logout();
    return (Array.isArray(uids) ? uids : []) as number[];
  } finally {
    client.close();
  }
}

export async function fetchMessages(
  config: ImapConfig,
  uids: number[]
): Promise<ParsedEmail[]> {
  const client = createClient(config);
  try {
    await client.connect();
    await client.mailboxOpen('INBOX');

    const results: ParsedEmail[] = [];

    for (let i = 0; i < uids.length; i += BATCH_SIZE) {
      const batch = uids.slice(i, i + BATCH_SIZE);
      const messages = await client.fetchAll(
        batch,
        { source: true, bodyStructure: true },
        { uid: true }
      );

      for (const msg of messages) {
        if (!msg.source) continue;

        const source = Buffer.isBuffer(msg.source) ? msg.source : Buffer.from(msg.source);
        const mail = await simpleParser(source);

        const attachmentParts: Array<{ partId: string; filename: string; mimeType: string; size: number }> = [];
        collectAttachmentParts(msg.bodyStructure, attachmentParts);

        const mailAttachments = (mail.attachments ?? []).filter((a) => !a.related);
        const attachments = attachmentParts.map((part, idx) => {
          const att = mailAttachments[idx];
          return {
            filename: part.filename,
            mimeType: part.mimeType,
            size: part.size,
            attachmentId: part.partId,
            content: att?.content,
          };
        });

        const { email: from, name: fromName } = formatAddress(mail.from);
        const bodyText = (mail.text ?? '').slice(0, BODY_MAX_LEN);
        const bodyHtml = (mail.html ? String(mail.html) : '').slice(0, BODY_MAX_LEN);

        results.push({
          messageId: String(msg.uid),
          emailMessageId: (typeof mail.messageId === 'string' ? mail.messageId : '') ?? '',
          from,
          fromName,
          subject: mail.subject ?? '',
          date: mail.date ?? new Date(0),
          attachments,
          bodyText,
          bodyHtml,
        });
      }
    }

    await client.logout();
    return results;
  } finally {
    client.close();
  }
}

export async function downloadAttachment(
  config: ImapConfig,
  uid: number,
  partId: string
): Promise<Buffer> {
  const client = createClient(config);
  try {
    await client.connect();
    await client.mailboxOpen('INBOX');

    const download = await client.download(String(uid), partId, { uid: true });
    const chunks: Buffer[] = [];

    for await (const chunk of download.content) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }

    await client.logout();
    return Buffer.concat(chunks);
  } finally {
    client.close();
  }
}
