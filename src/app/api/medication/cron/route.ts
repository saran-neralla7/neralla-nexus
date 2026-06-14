import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendPushNotification } from '@/lib/notifications/webPush';

export async function GET(request: Request) {
  try {
    const adminSupabase = createAdminClient();
    const now = new Date();
    const todayStr = now.toLocaleDateString('en-CA'); // YYYY-MM-DD
    const currentDayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const currentTimeStr = now.toTimeString().split(' ')[0]; // HH:MM:SS

    // 1. Fetch all active reminders
    const { data: reminders, error: remError } = await adminSupabase
      .from('medication_reminders')
      .select(`
        id,
        family_id,
        member_id,
        name,
        dosage,
        scheduled_time,
        frequency,
        days_of_week,
        is_active,
        family_members:family_members(id, full_name, user_id)
      `)
      .eq('is_active', true);

    if (remError) throw remError;
    if (!reminders || reminders.length === 0) {
      return NextResponse.json({ message: 'No active reminders found' });
    }

    let notifiedCount = 0;

    for (const rem of reminders) {
      // Cast the joined family_member details
      const member = rem.family_members as any;
      if (!member || !member.user_id) continue;

      // Filter by weekly days if applicable
      if (rem.frequency === 'weekly' && rem.days_of_week) {
        if (!rem.days_of_week.includes(currentDayOfWeek)) {
          continue;
        }
      }

      // Fetch today's log for this reminder
      const { data: log, error: logError } = await adminSupabase
        .from('medication_logs')
        .select('*')
        .eq('reminder_id', rem.id)
        .eq('date', todayStr)
        .maybeSingle();

      if (logError) {
        console.error(`Error fetching log for reminder ${rem.id}:`, logError);
        continue;
      }

      let shouldNotify = false;
      let isInitialTrigger = false;

      if (!log) {
        // No log today. Check if the scheduled time is due.
        if (rem.scheduled_time <= currentTimeStr) {
          shouldNotify = true;
          isInitialTrigger = true;
        }
      } else if (log.status === 'snoozed' && log.snoozed_until) {
        // Snoozed. Check if snooze period has expired.
        const snoozeDate = new Date(log.snoozed_until);
        if (snoozeDate <= now) {
          shouldNotify = true;
        }
      }

      if (shouldNotify) {
        const title = `Medication Reminder 💊`;
        const body = `${member.full_name}, it's time to take your ${rem.name}${rem.dosage ? ` (${rem.dosage})` : ''}.`;
        const url = `/medical`;

        const actions = [
          { action: 'taken', title: 'Mark Done' },
          { action: 'snooze', title: 'Snooze 15m' },
        ];

        // Send native web push notification
        const pushResult = await sendPushNotification(member.user_id, title, body, url, {
          reminderId: rem.id,
          actions,
        });

        if (pushResult.success) {
          notifiedCount++;

          // Calculate next snooze alarm: NOW + 15 minutes
          const nextSnoozeUntil = new Date(Date.now() + 15 * 60 * 1000).toISOString();

          // Create/update log to snooze state so it alerts again in 15m if ignored
          const { error: upsertErr } = await adminSupabase
            .from('medication_logs')
            .upsert({
              reminder_id: rem.id,
              date: todayStr,
              status: 'snoozed',
              snoozed_until: nextSnoozeUntil,
              logged_at: new Date().toISOString(),
            }, {
              onConflict: 'reminder_id,date',
            });

          if (upsertErr) {
            console.error(`Error updating log to snooze state for reminder ${rem.id}:`, upsertErr);
          }
        } else {
          console.warn(`Failed to dispatch push for user ${member.user_id}:`, pushResult.reason);
        }
      }
    }

    return NextResponse.json({ success: true, notifiedCount });
  } catch (err: any) {
    console.error('Medication cron handler error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
