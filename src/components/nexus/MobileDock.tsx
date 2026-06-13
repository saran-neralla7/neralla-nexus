'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const DOCK_ITEMS = [
  { label: 'Home', href: '/dashboard', icon: 'home' },
  { label: 'Family', href: '/family', icon: 'group' },
  { label: 'Vault', href: '/vault/passwords', icon: 'lock' },
  { label: 'Docs', href: '/vault/documents', icon: 'description' },
  { label: 'More', href: '/menu', icon: 'grid_view' },
];

export default function MobileDock() {
  const pathname = usePathname();

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + '/');

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 md:hidden"
      style={{
        background: 'rgba(14,21,19,0.92)',
        backdropFilter: 'blur(40px)',
        WebkitBackdropFilter: 'blur(40px)',
        borderTop: '1px solid rgba(255,255,255,0.08)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      <div className="flex items-center justify-around px-4 py-3">
        {DOCK_ITEMS.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-col items-center justify-center gap-1 min-w-[56px] py-1 rounded-2xl transition-all active:scale-95"
              style={{
                background: active ? 'rgba(79,219,200,0.12)' : 'transparent',
                padding: '6px 12px',
              }}
            >
              <span
                className="material-symbols-outlined"
                style={{
                  fontSize: '24px',
                  color: active ? '#4fdbc8' : '#859490',
                  fontVariationSettings: active ? "'FILL' 1" : "'FILL' 0",
                }}
              >
                {item.icon}
              </span>
              <span
                className="text-label-sm"
                style={{
                  fontSize: '10px',
                  color: active ? '#4fdbc8' : '#859490',
                  fontWeight: active ? '600' : '400',
                }}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
