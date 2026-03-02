import { NextResponse } from 'next/server';
import { eq, and } from 'drizzle-orm';
import { createServerClient } from '@/lib/supabase/server';
import { db } from '@/lib/db';
import { mailboxes } from '@/lib/db/schema';
import { decryptJson } from '@/lib/crypto';
import { testConnection } from '@/lib/connectors/imap';
import { refreshAccessToken } from '@/lib/connectors/gmail';
import type { ImapConfig, GmailTokens } from '@/types';

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: RouteParams) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const idNum = parseInt(id, 10);
  if (Number.isNaN(idNum)) {
    return NextResponse.json({ error: 'Invalid mailbox id' }, { status: 400 });
  }

  const [mailbox] = await db
    .select()
    .from(mailboxes)
    .where(and(eq(mailboxes.id, idNum), eq(mailboxes.userId, user.id)))
    .limit(1);

  if (!mailbox) {
    return NextResponse.json({ error: 'Mailbox not found' }, { status: 404 });
  }

  try {
    if (mailbox.type === 'imap') {
      const config = decryptJson<ImapConfig>(mailbox.credentials);
      const result = await testConnection(config);
      if (!result.ok) {
        return NextResponse.json(
          { error: result.error ?? 'Connection test failed' },
          { status: 500 }
        );
      }
    } else if (mailbox.type === 'gmail') {
      const tokens = decryptJson<GmailTokens>(mailbox.credentials);
      await refreshAccessToken(tokens);
    } else {
      return NextResponse.json({ error: 'Unknown mailbox type' }, { status: 400 });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Connection test failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ data: { ok: true } });
}
