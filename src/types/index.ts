import { z } from 'zod';

// Mailbox types
export type MailboxType = 'gmail' | 'imap';
export type MailboxStatus = 'connected' | 'failed' | 'disconnected';

export const imapConfigSchema = z.object({
  host: z.string().min(1),
  port: z.number().int().min(1).max(65535),
  username: z.string().min(1),
  password: z.string().min(1),
  tls: z.boolean().default(true),
});

export type ImapConfig = z.infer<typeof imapConfigSchema>;

export interface GmailTokens {
  accessToken: string;
  refreshToken: string;
  expiry: number;
  email: string;
}

export interface ParsedEmailAttachment {
  filename: string;
  mimeType: string;
  size: number;
  attachmentId: string;
  content?: Buffer;
}

export interface ParsedEmail {
  messageId: string;
  emailMessageId: string;
  from: string;
  fromName: string;
  subject: string;
  date: Date;
  attachments: ParsedEmailAttachment[];
  bodyText: string;
  bodyHtml: string;
}

// Scan types
export type ScanRunStatus =
  | 'queued'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled';
export type ScanTaskStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface GmailCheckpoint {
  phase: 'listing' | 'processing';
  nextPageToken?: string;
  messageIds?: string[];
  nextBatchStart?: number;
}

export interface ImapCheckpoint {
  phase: 'listing' | 'processing';
  totalUids?: number;
  uids?: number[];
  lastProcessedIndex?: number;
}

// Candidate types
export type CandidateType = 'attachment' | 'portal_link';
export type CandidateStatus = 'pending' | 'added' | 'dismissed';
export type ClassificationMethod = 'heuristic' | 'llm';

// Receipt types
export type ReceiptSource = 'scan' | 'upload';

// API schemas
export const createScanSchema = z.object({
  year: z.number().int().min(2025),
});

export const addReceiptsSchema = z.object({
  candidateIds: z.array(z.number().int().positive()).min(1),
});

export const dismissCandidatesSchema = z.object({
  candidateIds: z.array(z.number().int().positive()).min(1),
});

export const addImapMailboxSchema = z.object({
  displayName: z.string().min(1).max(255),
  host: z.string().min(1),
  port: z.number().int().min(1).max(65535),
  username: z.string().min(1),
  password: z.string().min(1),
  tls: z.boolean().default(true),
});

// API response types
export interface ApiError {
  error: string;
  details?: string;
}

export interface BucketWithCounts {
  id: number;
  senderEmail: string;
  senderDisplayName: string | null;
  year: number;
  invoiceCount: number;
  portalCount: number;
  pendingCount: number;
}

export interface ScanRunWithTasks {
  id: number;
  year: number;
  status: ScanRunStatus;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  tasks: ScanTaskWithProgress[];
}

export interface ScanTaskWithProgress {
  id: number;
  mailboxId: number;
  mailboxName: string;
  status: ScanTaskStatus;
  totalMessages: number;
  processedMessages: number;
  foundInvoices: number;
  errorMessage: string | null;
}
