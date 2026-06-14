import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();

    if (authErr || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { reminderId, status } = await request.json();

    if (!reminderId || !status || !['taken', 'snoozed'].includes(status)) {
      return NextResponse.json({ error: 'Invalid or missing parameters' }, { status: 400 });
    }

    const adminSupabase = createAdminClient();
    const todayStr = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD in local time

    if (status === 'taken') {
      const { error } = await adminSupabase
        .from('medication_logs')
        .upsert({
          reminder_id: reminderId,
          date: todayStr,
          status: 'taken',
          snoozed_until: null,
          logged_at: new Date().toISOString(),
        }, {
          onConflict: 'reminder_id,date'
        });

      if (error) throw error;
    } else if (status === 'snoozed') {
      const snoozedUntil = new Date(Date.now() + 15 * 60 * 1000).toISOString();
      const { error } = await adminSupabase
        .from('medication_logs')
        .upsert({
          reminder_id: reminderId,
          date: todayStr,
          status: 'snoozed',
          snoozed_until: snoozedUntil,
          logged_at: new Date().toISOString(),
        }, {
          onConflict: 'reminder_id,date'
        });

      if (error) throw error;
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Medication background logging error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
