import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendWhatsAppMessage } from '@/lib/notifications/whatsapp';

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

      const currentYear = nowInTz.getFullYear();
      const currentMonth = nowInTz.getMonth() + 1; // Month index starts at 0
      const currentDay = nowInTz.getDate();

      // 3. Fetch all occasions for this family
      const { data: occasions, error: occErr } = await adminSupabase
        .from('occasions')
        .select('*')
        .eq('family_id', family.id);

      if (occErr || !occasions) {
        console.error(`Error fetching occasions for family ${family.id}:`, occErr);
        continue;
      }

      // Filter occasions that match today's month and day (birthdays, anniversaries)
      const todayOccasions = occasions.filter(occ => {
        if (!occ.date || !occ.phone) return false;
        
        // Parse date from YYYY-MM-DD
        const [oYear, oMonth, oDay] = occ.date.split('-').map(Number);
        return oMonth === currentMonth && oDay === currentDay;
      });

      if (todayOccasions.length === 0) continue;

      // 4. Fetch the family owner details as a fallback notification recipient
      const { data: owner } = await adminSupabase
        .from('users')
        .select('id')
        .eq('family_id', family.id)
        .eq('is_owner', true)
        .maybeSingle();

      if (!owner) {
        console.warn(`No owner found for family ${family.id}, skipping wishing bot for today`);
        continue;
      }

      for (const occ of todayOccasions) {
        // Prevent duplicate wish for this year
        const { data: existingWish, error: checkErr } = await adminSupabase
          .from('notifications')
          .select('id')
          .eq('family_id', family.id)
          .eq('type', 'whatsapp_wish')
          .eq('data->>occasion_id', occ.id)
          .eq('data->>year', String(currentYear))
          .maybeSingle();

        if (checkErr) {
          console.error(`Error checking duplicate wish for occasion ${occ.id}:`, checkErr);
          continue;
        }

        if (existingWish) {
          // Already sent this year
          continue;
        }

        // Format parameters for Meta template:
        // Template: Hey {{1}}! {{2}} wishes you a very {{3}}. Personal note: {{4}}
        const recipientName = occ.name;
        const familyName = family.name;
        const occasionTypeFormatted = 
          occ.type === 'birthday' ? 'Happy Birthday' : 
          occ.type === 'anniversary' ? 'Happy Anniversary' : 'Happy Occasion';
        const personalNote = occ.notes || 'Have a wonderful day filled with joy and happiness!';

        // Send WhatsApp template message
        const wishResult = await sendWhatsAppMessage({
          toPhone: occ.phone,
          templateName: 'family_greeting', // The pre-approved template name
          parameters: [recipientName, familyName, occasionTypeFormatted, personalNote]
        });

        if (wishResult.success) {
          totalSent++;

          // Record in the database to prevent duplicate notifications and alert family of successful delivery
          const notifyUserId = occ.created_by || owner.id;
          const wishBodyText = `Hey ${recipientName}! ${familyName} wishes you a very ${occasionTypeFormatted}. Personal note: ${personalNote}`;

          const { error: insertErr } = await adminSupabase
            .from('notifications')
            .insert({
              family_id: family.id,
              user_id: notifyUserId,
              type: 'whatsapp_wish',
              title: `Occasion Wish Sent 🎁`,
              body: `Sent WhatsApp wish to ${recipientName} (${occ.phone}): "${wishBodyText}"`,
              data: {
                occasion_id: occ.id,
                year: String(currentYear),
                type: occ.type,
                whatsapp_message_id: wishResult.messageId
              }
            });

          if (insertErr) {
            console.error(`Error inserting wish notification log for user ${notifyUserId}:`, insertErr);
          }
        } else {
          console.error(`Failed to send wish to ${recipientName} (${occ.phone}):`, wishResult.error);
        }
      }
    }

    return NextResponse.json({ success: true, totalSent });
  } catch (err: any) {
    console.error('Wishing bot cron error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
