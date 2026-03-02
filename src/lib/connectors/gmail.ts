import { google } from 'googleapis';
import type { GmailTokens, ParsedEmail } from '@/types';
import type { gmail_v1 } from 'googleapis';

const BODY_MAX_LEN = 2000;
const BATCH_SIZE = 50;
const MAX_RESULTS = 500;

function getOAuth2Client() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      'Missing Gmail OAuth env: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI'
    );
  }

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

export function getOAuthUrl(state: string): string {
  const oauth2Client = getOAuth2Client();
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/userinfo.email',
    ],
    state,
    prompt: 'consent',
  });
}

export async function exchangeCodeForTokens(code: string): Promise<GmailTokens> {
  const oauth2Client = getOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);

  if (!tokens.access_token || !tokens.refresh_token) {
    throw new Error('Invalid token response: missing access_token or refresh_token');
  }

  const expiry = tokens.expiry_date
    ? Math.floor(tokens.expiry_date / 1000)
    : 0;

  const oauth2 = new google.auth.OAuth2();
  oauth2.setCredentials(tokens);
  const oauth2Api = google.oauth2({ version: 'v2', auth: oauth2 });
  const { data } = await oauth2Api.userinfo.get();
  const email = data.email ?? '';

  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiry,
    email,
  };
}

export async function refreshAccessToken(tokens: GmailTokens): Promise<GmailTokens> {
  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({
    access_token: tokens.accessToken,
    refresh_token: tokens.refreshToken,
    expiry_date: tokens.expiry * 1000,
  });

  const { credentials } = await oauth2Client.refreshAccessToken();

  if (!credentials.access_token) {
    throw new Error('Failed to refresh access token');
  }

  const expiry = credentials.expiry_date
    ? Math.floor(credentials.expiry_date / 1000)
    : tokens.expiry;

  return {
    ...tokens,
    accessToken: credentials.access_token,
    expiry,
  };
}

function createGmailClient(tokens: GmailTokens): gmail_v1.Gmail {
  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({
    access_token: tokens.accessToken,
    refresh_token: tokens.refreshToken,
    expiry_date: tokens.expiry * 1000,
  });
  return google.gmail({ version: 'v1', auth: oauth2Client });
}

export async function listMessageIds(tokens: GmailTokens, year: number): Promise<string[]> {
  const gmail = createGmailClient(tokens);
  const after = `${year}/01/01`;
  const before = `${year + 1}/01/01`;
  const query = `after:${after} before:${before}`;

  const ids: string[] = [];
  let pageToken: string | undefined;

  do {
    const res = await gmail.users.messages.list({
      userId: 'me',
      q: query,
      maxResults: MAX_RESULTS,
      pageToken,
    });

    const messages = res.data.messages ?? [];
    for (const m of messages) {
      if (m.id) ids.push(m.id);
    }
    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken);

  return ids;
}

function getHeaderValue(headers: gmail_v1.Schema$MessagePartHeader[] | undefined, name: string): string {
  if (!headers) return '';
  const h = headers.find((x) => x.name?.toLowerCase() === name.toLowerCase());
  return (h?.value ?? '').trim();
}

function parseAddress(headerValue: string): { email: string; name: string } {
  const match = headerValue.match(/^(?:"?([^"]*)"?\s*)?<?([^>]+)>?$/);
  if (match) {
    const name = (match[1] ?? '').trim();
    const email = (match[2] ?? '').trim();
    return { email, name: name || email };
  }
  return { email: headerValue, name: headerValue };
}

function collectParts(
  part: gmail_v1.Schema$MessagePart | null | undefined,
  acc: { attachments: ParsedEmail['attachments']; bodyText: string; bodyHtml: string }
): void {
  if (!part) return;

  const mimeType = (part.mimeType ?? '').toLowerCase();
  const disposition = getHeaderValue(part.headers ?? [], 'Content-Disposition');
  const isAttachment = disposition.toLowerCase().includes('attachment') || !!part.filename;

  if (part.parts?.length) {
    for (const p of part.parts) {
      collectParts(p, acc);
    }
    return;
  }

  if (isAttachment && part.body?.attachmentId) {
    acc.attachments.push({
      filename: part.filename ?? 'attachment',
      mimeType: mimeType || 'application/octet-stream',
      size: part.body.size ?? 0,
      attachmentId: part.body.attachmentId,
    });
    return;
  }

  if (mimeType === 'text/plain' && part.body?.data && !acc.bodyText) {
    try {
      const decoded = Buffer.from(part.body.data, 'base64url').toString('utf-8');
      acc.bodyText = decoded.slice(0, BODY_MAX_LEN);
    } catch {
      acc.bodyText = '';
    }
  }
  if (mimeType === 'text/html' && part.body?.data && !acc.bodyHtml) {
    try {
      const decoded = Buffer.from(part.body.data, 'base64url').toString('utf-8');
      acc.bodyHtml = decoded.slice(0, BODY_MAX_LEN);
    } catch {
      acc.bodyHtml = '';
    }
  }
}

function parseGmailMessage(msg: gmail_v1.Schema$Message, messageId: string): ParsedEmail {
  const payload = msg.payload;
  const headers = payload?.headers ?? [];

  const fromHeader = getHeaderValue(headers, 'From');
  const { email: from, name: fromName } = parseAddress(fromHeader);
  const subject = getHeaderValue(headers, 'Subject');
  const emailMessageId = getHeaderValue(headers, 'Message-ID');
  const dateStr = getHeaderValue(headers, 'Date');
  const date = dateStr ? new Date(dateStr) : new Date(0);

  const acc: {
    attachments: ParsedEmail['attachments'];
    bodyText: string;
    bodyHtml: string;
  } = { attachments: [], bodyText: '', bodyHtml: '' };
  collectParts(payload, acc);

  return {
    messageId,
    emailMessageId,
    from,
    fromName,
    subject,
    date,
    attachments: acc.attachments,
    bodyText: acc.bodyText,
    bodyHtml: acc.bodyHtml,
  };
}

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function fetchMessages(
  tokens: GmailTokens,
  messageIds: string[]
): Promise<ParsedEmail[]> {
  const gmail = createGmailClient(tokens);
  const results: ParsedEmail[] = [];
  let backoff = 1000;

  for (let i = 0; i < messageIds.length; i += BATCH_SIZE) {
    const batch = messageIds.slice(i, i + BATCH_SIZE);
    let success = false;
    let attempts = 0;
    const maxAttempts = 5;

    while (!success && attempts < maxAttempts) {
      try {
        const promises = batch.map((id) =>
          gmail.users.messages.get({ userId: 'me', id, format: 'full' })
        );
        const responses = await Promise.all(promises);

        for (const res of responses) {
          const msg = res.data;
          if (msg.id) {
            results.push(parseGmailMessage(msg, msg.id));
          }
        }
        success = true;
        backoff = 1000;
      } catch (err: unknown) {
        const status = (err as { response?: { status?: number } })?.response?.status;
        if (status === 429 && attempts < maxAttempts - 1) {
          attempts++;
          await sleep(backoff);
          backoff = Math.min(backoff * 2, 32000);
        } else {
          throw err;
        }
      }
    }
  }

  return results;
}

export async function downloadAttachment(
  tokens: GmailTokens,
  messageId: string,
  attachmentId: string
): Promise<Buffer> {
  const gmail = createGmailClient(tokens);
  const res = await gmail.users.messages.attachments.get({
    userId: 'me',
    messageId,
    id: attachmentId,
  });

  const data = res.data.data;
  if (!data) {
    throw new Error(`No attachment data for message ${messageId} attachment ${attachmentId}`);
  }

  return Buffer.from(data, 'base64url');
}
