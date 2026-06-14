import webPush from 'web-push';
import { createAdminClient } from '@/lib/supabase/admin';

const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';
const privateKey = process.env.VAPID_PRIVATE_KEY || '';

if (publicKey && privateKey) {
  webPush.setVapidDetails(
    'mailto:saran.neralla@gmail.com',
    publicKey,
    privateKey
  );
}

export async function sendPushNotification(
  userId: string,
  title: string,
  body: string,
  url?: string,
  extra?: Record<string, any>
) {
  if (!publicKey || !privateKey) {
    console.warn('VAPID keys not configured. Skipping push notification.');
    return { success: false, reason: 'VAPID keys not configured' };
  }

  try {
    const supabase = createAdminClient();
    
    // Fetch user subscriptions
    const { data: subs, error } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', userId);

    if (error) throw error;
    if (!subs || subs.length === 0) {
      return { success: true, sent: 0 };
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://neralla-nexus.vercel.app';
    const cleanExtra = { ...extra };

    if (cleanExtra.icon && cleanExtra.icon.startsWith('/')) {
      cleanExtra.icon = `${appUrl.replace(/\/$/, '')}${cleanExtra.icon}`;
    }
    if (cleanExtra.badge && cleanExtra.badge.startsWith('/')) {
      cleanExtra.badge = `${appUrl.replace(/\/$/, '')}${cleanExtra.badge}`;
    }

    const payload = JSON.stringify({ title, body, url, ...cleanExtra });
    let sentCount = 0;

    const promises = subs.map(async (subRecord) => {
      try {
        await webPush.sendNotification(subRecord.subscription, payload);
        sentCount++;
      } catch (err: any) {
        // Remove expired/invalid subscriptions (404 or 410)
        if (err.statusCode === 404 || err.statusCode === 410) {
          console.log(`Push subscription expired (status ${err.statusCode}). Cleaning up...`);
          await supabase
            .from('push_subscriptions')
            .delete()
            .eq('id', subRecord.id);
        } else {
          console.error('Push notification send failed for subscription:', err);
        }
      }
    });

    await Promise.all(promises);
    return { success: true, sent: sentCount };
  } catch (err) {
    console.error('Failed to send push notifications:', err);
    return { success: false, error: err };
  }
}
