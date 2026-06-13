'use client';

import { useEffect, useState } from 'react';

// Extend window interface for TypeScript
declare global {
  interface Window {
    deferredPrompt?: any;
    onBeforeInstallPrompt?: ((e: any) => void) | null;
  }
}

export function usePWA() {
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // 1. Register Service Worker
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => {
          console.log('Nexus SW registered with scope:', reg.scope);
        })
        .catch((err) => {
          console.error('Nexus SW registration failed:', err);
        });
    }

    // 2. Check if app is already running in standalone/installed mode
    if (typeof window !== 'undefined') {
      const isStandalone =
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as any).standalone === true;

      setIsInstalled(isStandalone);

      // Check if prompt was already captured by the head script
      if (window.deferredPrompt) {
        setInstallPrompt(window.deferredPrompt);
        setIsInstallable(true);
      }

      // Bind global handler for late events
      window.onBeforeInstallPrompt = (e: any) => {
        setInstallPrompt(e);
        setIsInstallable(true);
      };
    }

    // 3. Keep fallback listeners for safety
    const handleBeforePrompt = (e: any) => {
      e.preventDefault();
      window.deferredPrompt = e;
      setInstallPrompt(e);
      setIsInstallable(true);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setIsInstallable(false);
      setInstallPrompt(null);
      window.deferredPrompt = null;
    };

    window.addEventListener('beforeinstallprompt', handleBeforePrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      if (typeof window !== 'undefined') {
        window.onBeforeInstallPrompt = null;
      }
      window.removeEventListener('beforeinstallprompt', handleBeforePrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const installApp = async () => {
    if (!installPrompt) {
      console.warn('Install prompt event is not available yet.');
      return false;
    }

    try {
      installPrompt.prompt();
      const { outcome } = await installPrompt.userChoice;
      if (outcome === 'accepted') {
        setIsInstallable(false);
        setInstallPrompt(null);
        window.deferredPrompt = null;
        return true;
      }
    } catch (err) {
      console.error('PWA installation trigger failed:', err);
    }
    return false;
  };

  return { isInstallable, isInstalled, installApp };
}
