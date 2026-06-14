'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function usePushNotifications() {
  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(true);

  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  useEffect(() => {
    if (
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator &&
      'PushManager' in window
    ) {
      setIsSupported(true);
      setPermission(Notification.permission);
      checkSubscription();
    } else {
      setLoading(false);
    }
  }, []);

  const checkSubscription = async () => {
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      setIsSubscribed(!!sub);
    } catch (err) {
      console.error('Error checking push subscription:', err);
    } finally {
      setLoading(false);
    }
  };

  const subscribe = async () => {
    if (!isSupported) {
      toast.error('Push notifications are not supported on this browser/device.');
      return false;
    }
    if (!vapidPublicKey) {
      console.error('VAPID public key is not configured.');
      toast.error('VAPID public key not found in env configuration.');
      return false;
    }

    setLoading(true);
    try {
      // 1. Request Permission
      const permissionResult = await Notification.requestPermission();
      setPermission(permissionResult);

      if (permissionResult !== 'granted') {
        toast.error('Notification permission denied.');
        setLoading(false);
        return false;
      }

      // 2. Register / Get subscription
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });

      // 3. Save subscription on server
      const res = await fetch('/api/notifications/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: sub }),
      });

      if (!res.ok) {
        throw new Error('Failed to store subscription on server.');
      }

      setIsSubscribed(true);
      toast.success('Alerts enabled successfully!');
      return true;
    } catch (err: any) {
      console.error('Push subscription failed:', err);
      toast.error(err.message || 'Failed to enable push notifications.');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const unsubscribe = async () => {
    if (!isSupported) return false;

    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();

      if (sub) {
        const endpoint = sub.endpoint;
        // 1. Unsubscribe from push service
        await sub.unsubscribe();

        // 2. Remove from server database
        await fetch('/api/notifications/subscribe', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint }),
        });
      }

      setIsSubscribed(false);
      toast.success('Alerts disabled successfully.');
      return true;
    } catch (err: any) {
      console.error('Failed to unsubscribe:', err);
      toast.error('Failed to disable push notifications.');
      return false;
    } finally {
      setLoading(false);
    }
  };

  return {
    isSupported,
    permission,
    isSubscribed,
    loading,
    subscribe,
    unsubscribe,
  };
}
