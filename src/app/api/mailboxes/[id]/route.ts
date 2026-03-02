import { NextResponse } from 'next/server';
import { eq, and } from 'drizzle-orm';
import { createServerClient } from '@/lib/supabase/server';
import { db } from '@/lib/db';
import { mailboxes } from '@/lib/db/schema';

type RouteParams = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, { params }: RouteParams) {
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

  const result = await db
    .delete(mailboxes)
    .where(and(eq(mailboxes.id, idNum), eq(mailboxes.userId, user.id)))
    .returning({ id: mailboxes.id });

  if (result.length === 0) {
    return NextResponse.json({ error: 'Mailbox not found' }, { status: 404 });
  }

  return NextResponse.json({ data: { success: true } });
}
