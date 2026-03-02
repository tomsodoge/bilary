import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getOAuthUrl } from '@/lib/connectors/gmail';

export async function GET() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const authUrl = getOAuthUrl(user.id);
  return NextResponse.redirect(authUrl);
}
