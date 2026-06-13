'use client';

import { useState, useEffect } from 'react';
import { useUser } from '@/hooks/useUser';
import { useNotifications } from '@/hooks/useNotifications';
import NexusSidebar from '@/components/nexus/NexusSidebar';
import NexusNavbar from '@/components/nexus/NexusNavbar';
import MobileDock from '@/components/nexus/MobileDock';
import GlobalSearch from '@/components/nexus/GlobalSearch';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useUser();
  const { unreadCount } = useNotifications(user?.id);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  // Keyboard shortcut listener for Cmd+K / Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (loading) {
    return (
      <div
        className="h-screen flex items-center justify-center"
        style={{ backgroundColor: '#090f0e' }}
      >
        <div className="flex flex-col items-center gap-4">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center pulse-teal"
            style={{ background: 'linear-gradient(135deg, #14b8a6, #0566d9)' }}
          >
            <span
              className="material-symbols-outlined text-white text-3xl"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              hub
            </span>
          </div>
          <div className="flex items-center gap-2" style={{ color: '#4fdbc8' }}>
            <span className="material-symbols-outlined animate-spin" style={{ fontSize: '18px' }}>
              progress_activity
            </span>
            <span className="text-label-sm uppercase tracking-widest">Loading Nexus...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: '#090f0e' }}>
      {/* Desktop Sidebar */}
      <div className="hidden md:flex flex-shrink-0">
        <NexusSidebar user={user} />
      </div>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <>
          <div
            className="fixed inset-0 z-50 md:hidden"
            style={{ backgroundColor: 'rgba(9,15,14,0.8)', backdropFilter: 'blur(4px)' }}
            onClick={() => setSidebarOpen(false)}
          />
          <div
            className="fixed left-0 top-0 bottom-0 z-50 md:hidden"
            style={{ width: '280px' }}
          >
            <NexusSidebar user={user} onClose={() => setSidebarOpen(false)} />
          </div>
        </>
      )}

      {/* Main Content Area */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Navbar */}
        <NexusNavbar
          user={user}
          unreadCount={unreadCount}
          onMenuClick={() => setSidebarOpen(true)}
          onSearchClick={() => setSearchOpen(true)}
        />

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto pb-24 md:pb-8">
          {children}
        </main>

        {/* Mobile Bottom Dock */}
        <MobileDock />
      </div>

      {/* Global Command Search Overlay */}
      <GlobalSearch isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}

