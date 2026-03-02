import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { createServerClient } from '@/lib/supabase/server';
import { db } from '@/lib/db';
import { mailboxes } from '@/lib/db/schema';
import { encryptJson } from '@/lib/crypto';
import { addImapMailboxSchema } from '@/types';

export async function GET() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rows = await db
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
    .where(eq(mailboxes.userId, user.id));

  return NextResponse.json({ data: rows });
}

export async function POST(request: Request) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = addImapMailboxSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors.map((e) => e.message).join(', ') },
      { status: 400 }
    );
  }

  const { displayName, host, port, username, password, tls } = parsed.data;
  const credentials = encryptJson({
    host,
    port,
    username,
    password,
    tls,
  });

  const [mailbox] = await db
    .insert(mailboxes)
    .values({
      userId: user.id,
      type: 'imap',
      displayName,
      credentials,
      status: 'connected',
    })
    .returning({
      id: mailboxes.id,
      type: mailboxes.type,
      displayName: mailboxes.displayName,
      status: mailboxes.status,
      statusMessage: mailboxes.statusMessage,
      lastSyncAt: mailboxes.lastSyncAt,
      createdAt: mailboxes.createdAt,
    });

  return NextResponse.json({ data: mailbox });
}
