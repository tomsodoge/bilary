import type { ParsedEmail } from '@/types';
import type { ClassificationResult } from './types';

const BLOCKLIST_DOMAINS = [
  'newsletter',
  'noreply-marketing',
  'promo',
  'news.',
  'updates.',
  'campaigns.',
  'mailchimp.com',
  'sendgrid.net',
  'constantcontact.com',
];

const INVOICE_KEYWORDS = [
  'rechnung',
  'invoice',
  'beleg',
  'quittung',
  'abrechnung',
  'gutschrift',
  'receipt',
  'bill',
  'statement',
  'faktura',
  'credit-note',
  'creditnote',
];

const KNOWN_SENDER_DOMAINS = [
  'amazon',
  'paypal',
  'stripe',
  'hetzner',
  'digitalocean',
  'google',
  'apple',
  'microsoft',
  'adobe',
  'aws',
  'ovh',
  'ionos',
  'strato',
  'telekom',
  'vodafone',
  'o2',
  'congstar',
  'netflix',
  'spotify',
  'linkedin',
];

const INVOICE_MIME_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
];

const PORTAL_PATH_SEGMENTS = [
  '/invoice',
  '/rechnung',
  '/billing',
  '/download',
  '/receipt',
  '/beleg',
];

const URL_REGEX =
  /https?:\/\/[^\s<>"{}|\\^`[\]]+(?:\/[^\s<>"{}|\\^`[\]]*)?/gi;

function extractDomain(from: string): string {
  const match = from.match(/@([^\s>]+)/);
  return match ? match[1].toLowerCase() : '';
}

function matchesKeyword(text: string, keywords: string[]): boolean {
  const lower = text.toLowerCase();
  return keywords.some((kw) => lower.includes(kw));
}

function findPortalUrls(text: string): string[] {
  const urls: string[] = [];
  const matches = text.match(URL_REGEX) ?? [];
  for (const url of matches) {
    try {
      const lower = url.toLowerCase();
      const hasPath = PORTAL_PATH_SEGMENTS.some((seg) => lower.includes(seg));
      const hasKnownDomain = KNOWN_SENDER_DOMAINS.some((d) =>
        lower.includes(d)
      );
      if (hasPath || hasKnownDomain) {
        urls.push(url);
      }
    } catch {
      // Invalid URL, skip
    }
  }
  return urls.filter((url, index) => urls.indexOf(url) === index);
}

function createResult(
  isInvoice: boolean,
  confidence: number,
  type: ClassificationResult['type'],
  method: 'heuristic' | 'llm',
  documentType: string,
  matchedAttachments: ClassificationResult['matchedAttachments'] = [],
  portalUrls: string[] = []
): ClassificationResult {
  return {
    isInvoice,
    confidence,
    type,
    method: 'heuristic',
    documentType,
    matchedAttachments,
    portalUrls,
  };
}

export function classifyEmail(email: ParsedEmail): ClassificationResult {
  const domain = extractDomain(email.from);

  // 1. Blocklist check
  const isBlocklisted = BLOCKLIST_DOMAINS.some((b) => domain.includes(b));
  if (isBlocklisted) {
    return createResult(false, 1.0, 'none', 'heuristic', 'spam');
  }

  const pdfAttachments = email.attachments.filter(
    (a) => a.mimeType === 'application/pdf'
  );
  const invoiceLikeAttachments = email.attachments.filter(
    (a) =>
      INVOICE_MIME_TYPES.includes(a.mimeType) &&
      matchesKeyword(a.filename || '', INVOICE_KEYWORDS)
  );
  const subjectMatch = matchesKeyword(email.subject, INVOICE_KEYWORDS);
  const knownSender = KNOWN_SENDER_DOMAINS.some((d) => domain.includes(d));
  const portalUrls = findPortalUrls(email.bodyText + ' ' + email.bodyHtml);

  let best: ClassificationResult = createResult(
    false,
    0.1,
    'none',
    'heuristic',
    'other'
  );

  // 2. Attachment scan - invoice-like files
  if (invoiceLikeAttachments.length > 0) {
    const result = createResult(
      true,
      0.9,
      'attachment',
      'heuristic',
      'invoice',
      invoiceLikeAttachments.map((a) => ({
        filename: a.filename || '',
        mimeType: a.mimeType,
        attachmentId: a.attachmentId,
        size: a.size,
      })),
      []
    );
    if (result.confidence > best.confidence) best = result;
  }

  // 3. Subject keyword + PDF attachment
  if (subjectMatch && pdfAttachments.length > 0) {
    const result = createResult(
      true,
      0.8,
      'attachment',
      'heuristic',
      'invoice',
      pdfAttachments.map((a) => ({
        filename: a.filename || '',
        mimeType: a.mimeType,
        attachmentId: a.attachmentId,
        size: a.size,
      })),
      []
    );
    if (result.confidence > best.confidence) best = result;
  }

  // 3b. Subject keyword but NO attachment
  if (subjectMatch && email.attachments.length === 0) {
    const result = createResult(true, 0.6, 'none', 'heuristic', 'invoice');
    if (result.confidence > best.confidence) best = result;
  }

  // 4. Known sender + PDF
  if (knownSender && pdfAttachments.length > 0) {
    const result = createResult(
      true,
      0.85,
      'attachment',
      'heuristic',
      'invoice',
      pdfAttachments.map((a) => ({
        filename: a.filename || '',
        mimeType: a.mimeType,
        attachmentId: a.attachmentId,
        size: a.size,
      })),
      []
    );
    if (result.confidence > best.confidence) best = result;
  }

  // 4b. Known sender, no PDF - look for portal links
  if (knownSender && pdfAttachments.length === 0 && portalUrls.length > 0) {
    const result = createResult(
      true,
      0.6,
      'portal_link',
      'heuristic',
      'invoice',
      [],
      portalUrls
    );
    if (result.confidence > best.confidence) best = result;
  }

  // 5. Portal link detection
  if (portalUrls.length > 0) {
    const result = createResult(
      true,
      0.6,
      'portal_link',
      'heuristic',
      'invoice',
      [],
      portalUrls
    );
    if (result.confidence > best.confidence) best = result;
  }

  // 6. PDF without keyword match
  if (
    pdfAttachments.length > 0 &&
    !invoiceLikeAttachments.length &&
    !subjectMatch
  ) {
    const result = createResult(
      true,
      0.4,
      'attachment',
      'heuristic',
      'other',
      pdfAttachments.map((a) => ({
        filename: a.filename || '',
        mimeType: a.mimeType,
        attachmentId: a.attachmentId,
        size: a.size,
      })),
      []
    );
    if (result.confidence > best.confidence) best = result;
  }

  return best;
}
