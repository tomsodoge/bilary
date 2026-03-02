import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { db } from '@/lib/db';
import { mailboxes } from '@/lib/db/schema';
import { encryptJson } from '@/lib/crypto';
import { exchangeCodeForTokens } from '@/lib/connectors/gmail';

export async function GET(request: Request) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');

  if (!user || !state || state !== user.id) {
    return NextResponse.redirect(new URL('/login', process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'));
  }

  if (!code) {
    return NextResponse.json({ error: 'Missing authorization code' }, { status: 400 });
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    const credentials = encryptJson(tokens as unknown as Record<string, unknown>);

    await db.insert(mailboxes).values({
      userId: user.id,
      type: 'gmail',
      displayName: tokens.email,
      credentials,
      status: 'connected',
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to connect Gmail';
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.redirect(new URL('/inbox-scan', process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'));
}
