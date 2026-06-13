'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import type { User } from '@/types';

interface NexusNavbarProps {
  user: User | null;
  unreadCount?: number;
  onMenuClick?: () => void;
  onSearchClick?: () => void;
}

export default function NexusNavbar({
  user,
  unreadCount = 0,
  onMenuClick,
  onSearchClick,
}: NexusNavbarProps) {
  const router = useRouter();
  const [showUserMenu, setShowUserMenu] = useState(false);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    toast.success('Signed out successfully');
    router.push('/login');
    router.refresh();
  };

  return (
    <header
      className="sticky top-0 z-40 flex items-center justify-between px-4 md:px-8"
      style={{
        height: '64px',
        background: 'rgba(14,21,19,0.85)',
        backdropFilter: 'blur(40px)',
        WebkitBackdropFilter: 'blur(40px)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      {/* Left — Mobile menu + Logo */}
      <div className="flex items-center gap-4">
        <button
          className="md:hidden p-2 rounded-xl transition-colors"
          style={{ color: '#4fdbc8' }}
          onClick={onMenuClick}
          aria-label="Open menu"
        >
          <span className="material-symbols-outlined">menu</span>
        </button>
        <Link
          href="/dashboard"
          className="flex items-center"
        >
          <img
            src="/logo.png"
            alt="Neralla Nexus Logo"
            className="h-10 w-auto object-contain"
          />
        </Link>
      </div>

      {/* Center — Search */}
      <div className="hidden md:flex flex-1 max-w-md mx-8">
        <button
          onClick={onSearchClick}
          className="w-full flex items-center gap-3 px-4 py-2.5 rounded-full transition-all text-left"
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            color: '#859490',
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>search</span>
          <span className="flex-1 text-body-sm">Ask Nexus...</span>
          <span
            className="text-label-sm px-2 py-0.5 rounded"
            style={{
              border: '1px solid rgba(255,255,255,0.1)',
              color: '#859490',
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: '11px',
            }}
          >
            ⌘K
          </span>
        </button>
      </div>

      {/* Right — Notifications + User */}
      <div className="flex items-center gap-2">
        {/* Search on mobile */}
        <button
          className="md:hidden p-2 rounded-xl transition-colors"
          style={{ color: '#bbcac6' }}
          onClick={onSearchClick}
          aria-label="Search"
        >
          <span className="material-symbols-outlined">search</span>
        </button>

        {/* Notifications */}
        <Link
          href="/notifications"
          className="relative p-2 rounded-xl transition-colors"
          style={{ color: '#bbcac6' }}
        >
          <span className="material-symbols-outlined">notifications</span>
          {unreadCount > 0 && (
            <span
              className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full text-white flex items-center justify-center"
              style={{
                background: '#14b8a6',
                fontSize: '9px',
                fontWeight: '700',
              }}
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Link>

        {/* User Avatar */}
        <div className="relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm transition-all hover:ring-2"
            style={{
              background: 'linear-gradient(135deg, #14b8a6, #0566d9)',
              color: 'white',
            }}
            aria-label="User menu"
          >
            {user?.full_name?.slice(0, 1) || 'U'}
          </button>

          {showUserMenu && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowUserMenu(false)}
              />
              <div
                className="absolute right-0 top-12 w-56 rounded-2xl z-20 py-2 overflow-hidden"
                style={{
                  background: 'rgba(37,43,42,0.95)',
                  backdropFilter: 'blur(40px)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
                }}
              >
                <div className="px-4 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <p className="text-body-sm font-semibold" style={{ color: '#dde4e1' }}>{user?.full_name}</p>
                  <p className="text-label-sm" style={{ color: '#859490' }}>{user?.email}</p>
                  <span
                    className="inline-block mt-1 px-2 py-0.5 rounded-full text-label-sm capitalize"
                    style={{
                      background: 'rgba(79,219,200,0.1)',
                      color: '#4fdbc8',
                      fontSize: '10px',
                    }}
                  >
                    {user?.role}
                  </span>
                </div>
                <div className="py-2">
                  <Link
                    href="/settings"
                    onClick={() => setShowUserMenu(false)}
                    className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-white/5"
                    style={{ color: '#bbcac6' }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>settings</span>
                    <span className="text-body-sm">Settings</span>
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-white/5"
                    style={{ color: '#ffb4ab' }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>logout</span>
                    <span className="text-body-sm">Sign out</span>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
