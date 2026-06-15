import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendPushNotification } from '@/lib/notifications/webPush';
import { sendWhatsAppMessage } from '@/lib/notifications/whatsapp';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    // 1. Authenticate user
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Parse request payload
    const body = await request.json();
    const { latitude, longitude } = body;

    if (!latitude || !longitude) {
      return NextResponse.json({ error: 'Coordinates (latitude, longitude) are required' }, { status: 400 });
    }

    // 3. Fetch sender details & family ID
    const { data: userData, error: userErr } = await adminSupabase
      .from('users')
      .select('family_id, full_name')
      .eq('id', user.id)
      .single();

    if (userErr || !userData) {
      return NextResponse.json({ error: 'Sender user record not found' }, { status: 404 });
    }

    // 4. Fetch sender's extended profile (for blood group)
    const { data: memberData } = await adminSupabase
      .from('family_members')
      .select('id, blood_group')
      .eq('user_id', user.id)
      .maybeSingle();

    let bloodGroup = 'Not specified';
    let medsSummary = 'None recorded';

    if (memberData) {
      bloodGroup = memberData.blood_group || 'Not specified';

      // Fetch active medication reminders
      const { data: medications } = await adminSupabase
        .from('medication_reminders')
        .select('name, dosage')
        .eq('member_id', memberData.id)
        .eq('is_active', true);

      if (medications && medications.length > 0) {
        medsSummary = medications.map(m => `${m.name}${m.dosage ? ` (${m.dosage})` : ''}`).join(', ');
      }
    }

    const mapUrl = `https://www.google.com/maps?q=${latitude},${longitude}`;

    // 5. Fetch all other registered family members to alert them
    const { data: familyMembers, error: membersErr } = await adminSupabase
      .from('family_members')
      .select('full_name, phone, user_id')
      .eq('family_id', userData.family_id)
      .neq('user_id', user.id); // Exclude the sender

    if (membersErr || !familyMembers) {
      return NextResponse.json({ error: 'Failed to retrieve family members to alert' }, { status: 500 });
    }

    const alertTitle = `🚨 EMERGENCY PANIC ALERT!`;
    const alertBody = `${userData.full_name} has triggered a Panic Broadcast! Check location immediately.`;

    let pushCount = 0;
    let whatsappCount = 0;

    // 6. Broadcast alerts via push notifications and WhatsApp
    for (const member of familyMembers) {
      // Send in-app & Push notification if registered as a user
      if (member.user_id) {
        const pushResult = await sendPushNotification(
          member.user_id,
          alertTitle,
          alertBody,
          '/emergency',
          {
            tag: 'emergency-panic',
            requireInteraction: true,
            icon: '/icons/panic-alert.png',
          }
        );

        if (pushResult.success) {
          pushCount++;
        }

        // Insert in-app notification record
        await adminSupabase.from('notifications').insert({
          family_id: userData.family_id,
          user_id: member.user_id,
          type: 'emergency',
          title: alertTitle,
          body: alertBody,
          data: {
            sender_name: userData.full_name,
            latitude,
            longitude,
            map_url: mapUrl,
            blood_group: bloodGroup,
            medications: medsSummary
          }
        });
      }

      // Send WhatsApp message if phone number is available
      if (member.phone) {
        const waResult = await sendWhatsAppMessage({
          toPhone: member.phone,
          templateName: 'emergency_broadcast', // Template name setup in developer console
          parameters: [
            member.full_name.split(' ')[0], // Recipient name {{1}}
            userData.full_name,            // Sender name {{2}}
            mapUrl,                        // Location {{3}}
            `Blood: ${bloodGroup}. Medications: ${medsSummary}.` // Medical info {{4}}
          ]
        });

        if (waResult.success) {
          whatsappCount++;
        }
      }
    }

    return NextResponse.json({
      success: true,
      alertedCount: familyMembers.length,
      pushSent: pushCount,
      whatsappSent: whatsappCount
    });
  } catch (err: any) {
    console.error('Panic broadcast route error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
