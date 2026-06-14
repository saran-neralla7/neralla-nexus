import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendPushNotification } from '@/lib/notifications/webPush';

export async function GET(request: Request) {
  try {
    const adminSupabase = createAdminClient();

    // 1. Fetch all families to inspect timezone settings
    const { data: families, error: famErr } = await adminSupabase
      .from('families')
      .select('id, name, settings');

    if (famErr) throw famErr;
    if (!families || families.length === 0) {
      return NextResponse.json({ message: 'No families found' });
    }

    let totalSent = 0;

    // 2. Loop through families
    for (const family of families) {
      const settings = (family.settings || {}) as Record<string, any>;
      const timezone = settings.timezone || 'Asia/Kolkata';

      // Get current date/time in the family's timezone
      let nowInTz: Date;
      try {
        const formatter = new Intl.DateTimeFormat('en-US', {
          timeZone: timezone,
          year: 'numeric',
          month: 'numeric',
          day: 'numeric',
          hour: 'numeric',
          minute: 'numeric',
          second: 'numeric',
          hour12: false,
        });
        const parts = formatter.formatToParts(new Date());
        const tempMap = new Map(parts.map(p => [p.type, p.value]));
        
        nowInTz = new Date(
          parseInt(tempMap.get('year')!),
          parseInt(tempMap.get('month')!) - 1,
          parseInt(tempMap.get('day')!),
          parseInt(tempMap.get('hour')!),
          parseInt(tempMap.get('minute')!),
          parseInt(tempMap.get('second')!)
        );
      } catch (tzError) {
        console.warn(`Fallback to local time for timezone ${timezone}:`, tzError);
        nowInTz = new Date();
      }

      const hour = nowInTz.getHours();
      const minute = nowInTz.getMinutes();
      const timeStr = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;

      // Check if current time matches greeting slot
      let greetingTitle = '';
      let greetingBody = '';

      if (timeStr === '06:00') {
        greetingTitle = 'Good Morning! ☀️';
        greetingBody = 'Wishing you a wonderful, energized, and productive day ahead.';
      } else if (timeStr === '12:30') {
        greetingTitle = 'Good Afternoon! 🌤️';
        greetingBody = 'Hope you are having a great day. Don\'t forget to take a healthy lunch break!';
      } else if (timeStr === '16:00') {
        greetingTitle = 'Good Evening! 🌇';
        greetingBody = 'Hope your day went well. Take a moment to stretch and unwind.';
      } else if (timeStr === '22:00') {
        greetingTitle = 'Good Night! 🌙';
        greetingBody = 'Time to switch off screens, relax, and get some restful sleep. Sweet dreams!';
      }

      // If it doesn't match any schedule, proceed to the next family
      if (!greetingTitle) continue;

      // 3. Fetch the family owner's details to retrieve their avatar
      const { data: owner } = await adminSupabase
        .from('users')
        .select('avatar_url, full_name')
        .eq('family_id', family.id)
        .eq('is_owner', true)
        .maybeSingle();

      // Use the owner's avatar if uploaded, otherwise fallback to app icon
      const avatarUrl = owner?.avatar_url || '/logo.png';

      // 4. Fetch all users in this family who might be subscribed
      const { data: users, error: userErr } = await adminSupabase
        .from('users')
        .select('id, full_name')
        .eq('family_id', family.id);

      if (userErr || !users) continue;

      for (const u of users) {
        // Send notification using owner's avatar as the icon
        const pushResult = await sendPushNotification(
          u.id,
          greetingTitle,
          `Hey ${u.full_name.split(' ')[0]}, ${greetingBody}`,
          '/dashboard',
          {
            icon: avatarUrl,
          }
        );
        if (pushResult.success && pushResult.sent && pushResult.sent > 0) {
          totalSent += pushResult.sent;
        }
      }
    }

    return NextResponse.json({ success: true, totalSent });
  } catch (err: any) {
    console.error('Greeting notification cron error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
