import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendPushNotification } from '@/lib/notifications/webPush';

export async function GET(request: Request) {
  try {
    const adminSupabase = createAdminClient();

    // 1. Fetch all families to inspect timezone settings
    const { data: families, error: famErr } = await adminSupabase
      .from('families')
      .select('id, settings');

    if (famErr) throw famErr;
    if (!families || families.length === 0) {
      return NextResponse.json({ message: 'No families found' });
    }

    let notifiedCount = 0;

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

      const year = nowInTz.getFullYear();
      const month = String(nowInTz.getMonth() + 1).padStart(2, '0');
      const day = String(nowInTz.getDate()).padStart(2, '0');
      const todayStr = `${year}-${month}-${day}`;

      const hour = String(nowInTz.getHours()).padStart(2, '0');
      const minute = String(nowInTz.getMinutes()).padStart(2, '0');
      const second = String(nowInTz.getSeconds()).padStart(2, '0');
      const currentTimeStr = `${hour}:${minute}:${second}`;
      const currentDayOfWeek = nowInTz.getDay(); // 0 = Sunday, 1 = Monday, etc.

      // 3. Fetch active reminders for this family
      const { data: reminders, error: remErr } = await adminSupabase
        .from('reminders')
        .select('*')
        .eq('family_id', family.id)
        .eq('is_active', true);

      if (remErr || !reminders) continue;

      for (const rem of reminders) {
        // Filter by weekly days if applicable
        if (rem.frequency === 'weekly' && rem.days_of_week) {
          if (!rem.days_of_week.includes(currentDayOfWeek)) {
            continue;
          }
        }

        // Check if reminder scheduled time has been reached
        if (rem.scheduled_time > currentTimeStr) {
          continue;
        }

        // Fetch today's log for this reminder
        const { data: log, error: logError } = await adminSupabase
          .from('reminder_logs')
          .select('*')
          .eq('reminder_id', rem.id)
          .eq('date', todayStr)
          .maybeSingle();

        if (logError) {
          console.error(`Error checking reminder log for reminder ${rem.id}:`, logError);
          continue;
        }

        // If not already notified today, send notification
        if (!log) {
          const title = `Reminder Alert ⏰`;
          const body = rem.description ? `${rem.title}: ${rem.description}` : rem.title;
          const url = `/reminders`;
          const recipientId = rem.assigned_to || rem.created_by;

          const pushResult = await sendPushNotification(
            recipientId,
            title,
            body,
            url
          );

          if (pushResult.success) {
            notifiedCount++;

            // Create log entry to prevent duplicate notification today
            const { error: insertErr } = await adminSupabase
              .from('reminder_logs')
              .insert({
                reminder_id: rem.id,
                date: todayStr,
                status: 'notified',
              });

            if (insertErr) {
              console.error(`Error inserting reminder log for reminder ${rem.id}:`, insertErr);
            }

            // Also create a system notification to display inside the in-app inbox
            const { error: inAppErr } = await adminSupabase
              .from('notifications')
              .insert({
                family_id: family.id,
                user_id: recipientId,
                type: 'system',
                title: title,
                body: body,
                data: { reminder_id: rem.id }
              });

            if (inAppErr) {
              console.error(`Error creating in-app notification for reminder ${rem.id}:`, inAppErr);
            }
          }
        }
      }
    }

    return NextResponse.json({ success: true, notifiedCount });
  } catch (err: any) {
    console.error('Reminders cron error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
