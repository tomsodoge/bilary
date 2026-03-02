import {
  pgTable,
  serial,
  uuid,
  varchar,
  text,
  integer,
  real,
  timestamp,
  unique,
  jsonb,
} from 'drizzle-orm/pg-core';

export const mailboxes = pgTable('mailboxes', {
  id: serial('id').primaryKey(),
  userId: uuid('user_id').notNull(),
  type: varchar('type', { length: 10 }).notNull(),
  displayName: varchar('display_name', { length: 255 }).notNull(),
  credentials: text('credentials').notNull(),
  status: varchar('status', { length: 20 }).default('connected').notNull(),
  statusMessage: text('status_message'),
  lastSyncAt: timestamp('last_sync_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const scanRuns = pgTable('scan_runs', {
  id: serial('id').primaryKey(),
  userId: uuid('user_id').notNull(),
  year: integer('year').notNull(),
  status: varchar('status', { length: 20 }).default('queued').notNull(),
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const scanTasks = pgTable('scan_tasks', {
  id: serial('id').primaryKey(),
  scanRunId: integer('scan_run_id')
    .references(() => scanRuns.id, { onDelete: 'cascade' })
    .notNull(),
  mailboxId: integer('mailbox_id')
    .references(() => mailboxes.id, { onDelete: 'cascade' })
    .notNull(),
  userId: uuid('user_id').notNull(),
  status: varchar('status', { length: 20 }).default('pending').notNull(),
  totalMessages: integer('total_messages').default(0),
  processedMessages: integer('processed_messages').default(0),
  foundInvoices: integer('found_invoices').default(0),
  checkpoint: jsonb('checkpoint'),
  lockedAt: timestamp('locked_at'),
  attemptCount: integer('attempt_count').default(0),
  errorMessage: text('error_message'),
  completedAt: timestamp('completed_at'),
});

export const buckets = pgTable(
  'buckets',
  {
    id: serial('id').primaryKey(),
    userId: uuid('user_id').notNull(),
    senderEmail: varchar('sender_email', { length: 255 }).notNull(),
    senderDisplayName: varchar('sender_display_name', { length: 255 }),
    year: integer('year').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [unique('uq_bucket_sender_year').on(t.userId, t.senderEmail, t.year)]
);

export const invoiceCandidates = pgTable(
  'invoice_candidates',
  {
    id: serial('id').primaryKey(),
    userId: uuid('user_id').notNull(),
    bucketId: integer('bucket_id')
      .references(() => buckets.id, { onDelete: 'cascade' })
      .notNull(),
    scanRunId: integer('scan_run_id')
      .references(() => scanRuns.id, { onDelete: 'cascade' })
      .notNull(),
    mailboxId: integer('mailbox_id')
      .references(() => mailboxes.id, { onDelete: 'cascade' })
      .notNull(),
    emailMessageId: varchar('email_message_id', { length: 512 }).notNull(),
    emailSubject: varchar('email_subject', { length: 1000 }),
    emailDate: timestamp('email_date'),
    type: varchar('type', { length: 20 }).notNull(),
    filename: varchar('filename', { length: 500 }),
    mimeType: varchar('mime_type', { length: 100 }),
    fileSize: integer('file_size'),
    storagePath: varchar('storage_path', { length: 1000 }),
    portalUrl: varchar('portal_url', { length: 2000 }),
    confidenceScore: real('confidence_score'),
    classificationMethod: varchar('classification_method', { length: 20 }),
    status: varchar('status', { length: 20 }).default('pending').notNull(),
    year: integer('year').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [
    unique('uq_candidate_msg_file').on(
      t.userId,
      t.emailMessageId,
      t.filename,
      t.year
    ),
  ]
);

export const receipts = pgTable('receipts', {
  id: serial('id').primaryKey(),
  userId: uuid('user_id').notNull(),
  bucketId: integer('bucket_id')
    .references(() => buckets.id, { onDelete: 'cascade' })
    .notNull(),
  candidateId: integer('candidate_id').references(() => invoiceCandidates.id),
  filename: varchar('filename', { length: 500 }).notNull(),
  mimeType: varchar('mime_type', { length: 100 }),
  fileSize: integer('file_size'),
  storagePath: varchar('storage_path', { length: 1000 }).notNull(),
  source: varchar('source', { length: 10 }).notNull(),
  year: integer('year').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
