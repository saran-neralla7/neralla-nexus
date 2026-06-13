'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { User } from '@/types';
import { usePWA } from '@/hooks/usePWA';

const NAV_ITEMS = [
  { label: 'Dashboard', href: '/dashboard', icon: 'home' },
  { label: 'Family', href: '/family', icon: 'family_restroom' },
  { label: 'Family Tree', href: '/tree', icon: 'account_tree' },
  { label: 'Passwords', href: '/vault/passwords', icon: 'password' },
  { label: 'Documents', href: '/vault/documents', icon: 'description' },
  { label: 'Medical', href: '/medical', icon: 'medical_services' },
  { label: 'Policies', href: '/policies', icon: 'policy' },
  { label: 'Assets', href: '/assets', icon: 'inventory_2' },
  { label: 'Memories', href: '/memories', icon: 'photo_library' },
  { label: 'Knowledge', href: '/knowledge', icon: 'menu_book' },
  { label: 'Calendar', href: '/calendar', icon: 'calendar_today' },
  { label: 'Contacts', href: '/contacts', icon: 'contacts' },
  { label: 'Emergency', href: '/emergency', icon: 'sos' },
];

const BOTTOM_ITEMS = [
  { label: 'Ask Nexus', href: '/ask-nexus', icon: 'smart_toy' },
  { label: 'Notifications', href: '/notifications', icon: 'notifications' },
  { label: 'Settings', href: '/settings', icon: 'settings' },
];

interface NexusSidebarProps {
  user: User | null;
  onClose?: () => void;
}

export default function NexusSidebar({ user, onClose }: NexusSidebarProps) {
  const pathname = usePathname();
  const { isInstallable, installApp } = usePWA();

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + '/');

  return (
    <aside
      className="flex flex-col h-full glass-sidebar"
      style={{ width: '260px' }}
    >
      {/* Logo */}
      <div
        className="flex items-center justify-center px-4 py-6"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
      >
        <img
          src="/logo.png"
          alt="Neralla Nexus Logo"
          className="w-40 h-auto object-contain"
        />
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5">
        {NAV_ITEMS.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all group"
              style={{
                background: active ? 'rgba(79,219,200,0.1)' : 'transparent',
                color: active ? '#4fdbc8' : '#bbcac6',
              }}
            >
              <span
                className="material-symbols-outlined"
                style={{
                  fontSize: '20px',
                  fontVariationSettings: active ? "'FILL' 1" : "'FILL' 0",
                }}
              >
                {item.icon}
              </span>
              <span
                className="text-body-sm"
                style={{ fontWeight: active ? '600' : '400' }}
              >
                {item.label}
              </span>
              {active && (
                <div
                  className="ml-auto w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: '#4fdbc8' }}
                />
              )}
            </Link>
          );
        })}

        {/* Divider */}
        <div
          className="my-3 mx-3"
          style={{ height: '1px', background: 'rgba(255,255,255,0.05)' }}
        />

        {BOTTOM_ITEMS.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all"
              style={{
                background: active ? 'rgba(79,219,200,0.1)' : 'transparent',
                color: active ? '#4fdbc8' : '#bbcac6',
              }}
            >
              <span
                className="material-symbols-outlined"
                style={{
                  fontSize: '20px',
                  fontVariationSettings: active ? "'FILL' 1" : "'FILL' 0",
                }}
              >
                {item.icon}
              </span>
              <span className="text-body-sm">{item.label}</span>
            </Link>
          );
        })}

        {/* System Progress (Owner only) */}
        {user?.is_owner && (
          <Link
            href="/system-progress"
            onClick={onClose}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all"
            style={{
              color: isActive('/system-progress') ? '#ffb59e' : '#859490',
              background: isActive('/system-progress') ? 'rgba(255,181,158,0.08)' : 'transparent',
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
              monitoring
            </span>
            <span className="text-body-sm">System Progress</span>
          </Link>
        )}
      </nav>

      {/* PWA Install Action */}
      {isInstallable && (
        <div className="px-4 py-2 flex flex-col gap-1">
          <button
            onClick={installApp}
            className="flex items-center gap-2.5 w-full px-4 py-3 rounded-xl border border-[#4fdbc8]/20 bg-[#4fdbc8]/5 hover:bg-[#4fdbc8]/15 text-[#4fdbc8] hover:text-[#71f8e4] transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer shadow-[0_0_15px_rgba(79,219,200,0.04)] group"
          >
            <span className="material-symbols-outlined text-[20px] animate-pulse">download_for_offline</span>
            <span className="text-body-sm font-semibold select-none">Install App</span>
          </button>
        </div>
      )}

      {/* User Profile */}
      <div
        className="p-4"
        style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}
      >
        <div className="flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all hover:bg-white/5">
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold"
            style={{
              background: 'linear-gradient(135deg, #14b8a6, #0566d9)',
              color: 'white',
            }}
          >
            {user?.full_name?.slice(0, 1) || 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <p
              className="text-body-sm font-medium truncate"
              style={{ color: '#dde4e1' }}
            >
              {user?.full_name || 'Loading...'}
            </p>
            <p className="text-label-sm truncate" style={{ color: '#859490' }}>
              {user?.role || 'member'}
            </p>
          </div>
          <span
            className="material-symbols-outlined flex-shrink-0"
            style={{ fontSize: '18px', color: '#859490' }}
          >
            more_vert
          </span>
        </div>
      </div>
    </aside>
  );
}
