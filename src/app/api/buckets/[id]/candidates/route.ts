import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerClient } from '@/lib/supabase/server';
import { getCandidatesForBucket } from '@/lib/db/queries';

const idSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const parsed = idSchema.safeParse({ id });

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid bucket id' },
      { status: 400 }
    );
  }

  const candidates = await getCandidatesForBucket(parsed.data.id, user.id);
  return NextResponse.json({ data: candidates });
}
