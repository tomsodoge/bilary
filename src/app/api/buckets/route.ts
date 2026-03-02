import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerClient } from '@/lib/supabase/server';
import { getBucketsWithCounts } from '@/lib/db/queries';

const yearSchema = z.object({
  year: z.coerce.number().int().min(2020).max(2100),
});

export async function GET(request: NextRequest) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const parsed = yearSchema.safeParse({
    year: searchParams.get('year'),
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Query param year is required and must be a valid integer' },
      { status: 400 }
    );
  }

  const buckets = await getBucketsWithCounts(user.id, parsed.data.year);
  return NextResponse.json({ data: buckets });
}
