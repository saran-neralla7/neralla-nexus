'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useUser } from '@/hooks/useUser';
import { formatDate, daysUntil, formatRelativeTime } from '@/lib/utils';

interface DashboardStats {
  memberCount: number;
  documentCount: number;
  passwordCount: number;
  policyCount: number;
  upcomingRenewals: any[];
  recentActivity: any[];
}

export default function DashboardPage() {
  const { user } = useUser();
  const [stats, setStats] = useState<DashboardStats>({
    memberCount: 0,
    documentCount: 0,
    passwordCount: 0,
    policyCount: 0,
    upcomingRenewals: [],
    recentActivity: [],
  });
  const [loading, setLoading] = useState(true);
  const [time, setTime] = useState(new Date());
  
  const [showMorningWish, setShowMorningWish] = useState(false);
  const wishVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    // Read search params inside useEffect to avoid Next.js Suspense compilation requirement
    const searchParams = new URLSearchParams(window.location.search);
    const testWish = searchParams.get('testWish') === 'true';

    const checkMorningWish = () => {
      const justLoggedIn = typeof window !== 'undefined' && sessionStorage.getItem('nexus_just_logged_in') === 'true';

      if (testWish || justLoggedIn) {
        if (typeof window !== 'undefined') {
          sessionStorage.removeItem('nexus_just_logged_in');
        }
        setShowMorningWish(true);
        // Autoplay the video once the element is rendered in the DOM
        setTimeout(() => {
          if (wishVideoRef.current) {
            wishVideoRef.current.muted = false;
            const playPromise = wishVideoRef.current.play();
            if (playPromise !== undefined) {
              playPromise.catch((error) => {
                console.warn("Autoplay prevented, retrying muted:", error);
                if (wishVideoRef.current) {
                  wishVideoRef.current.muted = true;
                  wishVideoRef.current.play().catch(err => console.error("Muted play failed:", err));
                }
              });
            }
          }
        }, 300);
      }
    };

    const timeout = setTimeout(checkMorningWish, 1000);
    return () => clearTimeout(timeout);
  }, []);

  useEffect(() => {
    if (!user?.family_id) return;
    fetchStats();
  }, [user?.family_id]);

  const fetchStats = async () => {
    try {
      const supabase = createClient();
      const familyId = user?.family_id;

      const [membersRes, docsRes, pwRes, policiesRes] = await Promise.all([
        supabase.from('family_members').select('id', { count: 'exact' }).eq('family_id', familyId!),
        supabase.from('documents').select('id', { count: 'exact' }).eq('family_id', familyId!).is('deleted_at', null),
        supabase.from('passwords').select('id', { count: 'exact' }).eq('family_id', familyId!).is('deleted_at', null),
        supabase.from('policies').select('*').eq('family_id', familyId!).not('expiry_date', 'is', null).order('expiry_date', { ascending: true }).limit(5),
      ]);

      setStats({
        memberCount: membersRes.count || 0,
        documentCount: docsRes.count || 0,
        passwordCount: pwRes.count || 0,
        policyCount: 0,
        upcomingRenewals: policiesRes.data || [],
        recentActivity: [],
      });
    } catch (err) {
      console.error('Dashboard stats error:', err);
    } finally {
      setLoading(false);
    }
  };

  const getGreeting = () => {
    const h = time.getHours();
    if (h < 12) return 'Good Morning';
    if (h < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  const firstName = user?.full_name?.split(' ')[0] || 'there';

  const quickActions = [
    { label: 'Add Document', icon: 'upload_file', href: '/vault/documents', color: '#4fdbc8' },
    { label: 'New Password', icon: 'password', href: '/vault/passwords', color: '#adc6ff' },
    { label: 'Add Member', icon: 'person_add', href: '/family', color: '#ffb59e' },
    { label: 'New Policy', icon: 'policy', href: '/policies', color: '#4fdbc8' },
    { label: 'Medical Record', icon: 'medical_services', href: '/medical', color: '#adc6ff' },
    { label: 'Add Memory', icon: 'photo_library', href: '/memories', color: '#ffb59e' },
  ];

  const statCards = [
    { label: 'Family Members', value: stats.memberCount, icon: 'group', color: '#4fdbc8', href: '/family' },
    { label: 'Documents', value: stats.documentCount, icon: 'description', color: '#adc6ff', href: '/vault/documents' },
    { label: 'Passwords', value: stats.passwordCount, icon: 'lock', color: '#ffb59e', href: '/vault/passwords' },
    { label: 'Vault Health', value: '100%', icon: 'shield', color: '#4fdbc8', href: '/settings' },
  ];

  return (
    <div className="px-4 md:px-8 py-6 space-y-8">
      {/* ============ HERO BANNER ============ */}
      <section
        className="relative rounded-3xl overflow-hidden"
        style={{ minHeight: '220px' }}
      >
        {/* Background gradient */}
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(135deg, rgba(20,184,166,0.15) 0%, rgba(5,102,217,0.1) 50%, rgba(9,15,14,1) 100%)',
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background: 'radial-gradient(ellipse at top left, rgba(79,219,200,0.2) 0%, transparent 60%)',
          }}
        />
        {/* Glass border */}
        <div
          className="absolute inset-0 rounded-3xl"
          style={{ border: '1px solid rgba(255,255,255,0.08)' }}
        />

        <div className="relative z-10 p-6 sm:p-8 md:p-10">
          <p
            className="text-label-sm uppercase tracking-widest mb-3"
            style={{ color: '#4fdbc8' }}
          >
            Command Center
          </p>
          <h1
            className="mb-4"
            style={{
              fontFamily: 'Geist, sans-serif',
              fontSize: 'clamp(28px, 4vw, 40px)',
              fontWeight: '600',
              color: '#dde4e1',
              letterSpacing: '-0.02em',
            }}
          >
            {getGreeting()}, {firstName} 🏠
          </h1>
          <p className="text-body-md mb-6" style={{ color: '#859490', maxWidth: '480px' }}>
            Welcome to your family&apos;s private operating system. Everything your family needs, secured and organized.
          </p>

          {/* Live Clock */}
          <div className="flex items-center gap-6 flex-wrap">
            <div
              className="flex items-center gap-2 px-4 py-2 rounded-xl"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.06)' }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '16px', color: '#4fdbc8' }}>schedule</span>
              <span
                className="text-label-sm"
                style={{ color: '#dde4e1', fontFamily: 'JetBrains Mono, monospace' }}
              >
                {time.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
              </span>
              <span className="text-label-sm" style={{ color: '#859490' }}>
                {time.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
              </span>
            </div>

            <Link
              href="/emergency"
              className="flex items-center gap-2 px-4 py-2 rounded-xl transition-all hover:opacity-80"
              style={{
                background: 'rgba(255,180,171,0.1)',
                border: '1px solid rgba(255,180,171,0.2)',
                color: '#ffb4ab',
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '16px', fontVariationSettings: "'FILL' 1" }}>sos</span>
              <span className="text-label-sm">Emergency Hub</span>
            </Link>
          </div>
        </div>
      </section>

      {/* ============ STAT CARDS ============ */}
      <section>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {statCards.map((stat) => (
            <Link
              key={stat.label}
              href={stat.href}
              className="glass-card rounded-2xl p-5 flex flex-col gap-3 group"
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: `${stat.color}15` }}
              >
                <span
                  className="material-symbols-outlined"
                  style={{ fontSize: '20px', color: stat.color }}
                >
                  {stat.icon}
                </span>
              </div>
              <div>
                <p
                  className="font-bold"
                  style={{
                    fontFamily: 'Geist, sans-serif',
                    fontSize: '28px',
                    color: '#dde4e1',
                    letterSpacing: '-0.02em',
                  }}
                >
                  {loading ? (
                    <span className="inline-block w-8 h-7 rounded animate-pulse" style={{ background: 'rgba(255,255,255,0.06)' }} />
                  ) : stat.value}
                </p>
                <p className="text-body-sm" style={{ color: '#859490' }}>{stat.label}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ============ MAIN GRID ============ */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Upcoming Renewals */}
        <div className="glass-card rounded-2xl p-6">
          <div className="flex items-center justify-between mb-5">
            <h2
              className="flex items-center gap-2"
              style={{ fontFamily: 'Geist, sans-serif', fontSize: '18px', fontWeight: '600', color: '#dde4e1' }}
            >
              <span className="material-symbols-outlined" style={{ color: '#4fdbc8', fontSize: '20px' }}>event_repeat</span>
              Renewals
            </h2>
            <span className="text-label-sm" style={{ color: '#859490' }}>Next 30 Days</span>
          </div>

          {stats.upcomingRenewals.length === 0 ? (
            <div className="text-center py-8">
              <span className="material-symbols-outlined" style={{ fontSize: '40px', color: '#3c4947' }}>check_circle</span>
              <p className="text-body-sm mt-2" style={{ color: '#859490' }}>No renewals due soon</p>
              <Link href="/policies" className="text-label-sm mt-3 block" style={{ color: '#4fdbc8' }}>Add policies →</Link>
            </div>
          ) : (
            <div className="space-y-3">
              {stats.upcomingRenewals.map((policy: any) => {
                const days = daysUntil(policy.expiry_date);
                const urgent = days <= 7;
                return (
                  <div
                    key={policy.id}
                    className="flex items-center justify-between p-3 rounded-xl"
                    style={{ background: 'rgba(255,255,255,0.04)' }}
                  >
                    <div className="flex gap-3 items-center">
                      <div
                        className="w-9 h-9 rounded-lg flex items-center justify-center"
                        style={{ background: urgent ? 'rgba(255,180,171,0.15)' : 'rgba(79,219,200,0.12)' }}
                      >
                        <span
                          className="material-symbols-outlined"
                          style={{ fontSize: '18px', color: urgent ? '#ffb4ab' : '#4fdbc8' }}
                        >
                          policy
                        </span>
                      </div>
                      <div>
                        <p className="text-body-sm font-medium" style={{ color: '#dde4e1' }}>{policy.name}</p>
                        <p className="text-label-sm" style={{ color: '#859490' }}>{policy.provider}</p>
                      </div>
                    </div>
                    <span
                      className="text-label-sm"
                      style={{ color: urgent ? '#ffb4ab' : '#4fdbc8' }}
                    >
                      {days === 0 ? 'Today!' : days === 1 ? 'Tomorrow' : `In ${days} days`}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="glass-card rounded-2xl p-6">
          <h2
            className="flex items-center gap-2 mb-5"
            style={{ fontFamily: 'Geist, sans-serif', fontSize: '18px', fontWeight: '600', color: '#dde4e1' }}
          >
            <span className="material-symbols-outlined" style={{ color: '#4fdbc8', fontSize: '20px' }}>bolt</span>
            Quick Actions
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {quickActions.map((action) => (
              <Link
                key={action.label}
                href={action.href}
                className="flex flex-col items-center gap-2 p-4 rounded-xl transition-all active:scale-95"
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.06)',
                }}
              >
                <span
                  className="material-symbols-outlined"
                  style={{ fontSize: '24px', color: action.color }}
                >
                  {action.icon}
                </span>
                <span className="text-body-sm text-center" style={{ color: '#bbcac6', fontSize: '12px' }}>
                  {action.label}
                </span>
              </Link>
            ))}
          </div>
        </div>

        {/* Vault Health */}
        <div
          className="glass-card rounded-2xl p-6 flex flex-col justify-between"
          style={{ background: 'linear-gradient(135deg, rgba(79,219,200,0.05) 0%, rgba(5,102,217,0.05) 100%)' }}
        >
          <div>
            <p className="text-label-sm uppercase tracking-widest" style={{ color: '#859490' }}>Vault Health</p>
            <p
              className="mt-2"
              style={{ fontFamily: 'Geist, sans-serif', fontSize: '36px', fontWeight: '700', color: '#4fdbc8', letterSpacing: '-0.03em' }}
            >
              Excellent
            </p>
            <p className="text-body-sm mt-1" style={{ color: '#859490' }}>All systems protected</p>
          </div>
          <div className="mt-6">
            <div className="flex justify-between text-label-sm mb-2">
              <span style={{ color: '#bbcac6' }}>Protection Score</span>
              <span style={{ color: '#4fdbc8' }}>94%</span>
            </div>
            <div className="h-2 w-full rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }}>
              <div
                className="h-full rounded-full"
                style={{
                  width: '94%',
                  background: 'linear-gradient(90deg, #14b8a6, #4fdbc8)',
                  boxShadow: '0 0 12px rgba(79,219,200,0.5)',
                }}
              />
            </div>
          </div>

          {/* Security Badges */}
          <div className="mt-4 space-y-2">
            {[
              { icon: 'lock', label: 'AES-256 Encryption Active' },
              { icon: 'verified_user', label: 'Row-Level Security Enabled' },
              { icon: 'history', label: 'Audit Logging Active' },
            ].map((badge) => (
              <div key={badge.label} className="flex items-center gap-2">
                <span
                  className="material-symbols-outlined"
                  style={{ fontSize: '14px', color: '#4fdbc8', fontVariationSettings: "'FILL' 1" }}
                >
                  {badge.icon}
                </span>
                <span className="text-label-sm" style={{ color: '#bbcac6' }}>{badge.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ BOTTOM SECTION ============ */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <div className="glass-card rounded-2xl p-6">
          <h2
            className="flex items-center gap-2 mb-5"
            style={{ fontFamily: 'Geist, sans-serif', fontSize: '18px', fontWeight: '600', color: '#dde4e1' }}
          >
            <span className="material-symbols-outlined" style={{ color: '#adc6ff', fontSize: '20px' }}>history</span>
            Recent Activity
          </h2>
          <div className="space-y-3">
            {[
              { icon: 'person_add', label: 'Owner account created', time: 'Just now', color: '#4fdbc8' },
              { icon: 'hub', label: 'Neralla Nexus initialized', time: 'Today', color: '#adc6ff' },
              { icon: 'shield', label: 'Security policies applied', time: 'Today', color: '#4fdbc8' },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)' }}>
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: `${item.color}15` }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '18px', color: item.color }}>
                    {item.icon}
                  </span>
                </div>
                <div className="flex-1">
                  <p className="text-body-sm" style={{ color: '#dde4e1' }}>{item.label}</p>
                  <p className="text-label-sm" style={{ color: '#859490' }}>{item.time}</p>
                </div>
              </div>
            ))}
          </div>
          <Link
            href="/audit-logs"
            className="mt-4 block text-center text-label-sm transition-colors"
            style={{ color: '#4fdbc8' }}
          >
            View All Activity →
          </Link>
        </div>

        {/* Module Navigation Grid */}
        <div className="glass-card rounded-2xl p-6">
          <h2
            className="flex items-center gap-2 mb-5"
            style={{ fontFamily: 'Geist, sans-serif', fontSize: '18px', fontWeight: '600', color: '#dde4e1' }}
          >
            <span className="material-symbols-outlined" style={{ color: '#ffb59e', fontSize: '20px' }}>apps</span>
            Family Modules
          </h2>
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            {[
              { label: 'Family', icon: 'group', href: '/family', color: '#4fdbc8' },
              { label: 'Tree', icon: 'account_tree', href: '/tree', color: '#adc6ff' },
              { label: 'Medical', icon: 'medical_services', href: '/medical', color: '#ffb59e' },
              { label: 'Calendar', icon: 'calendar_today', href: '/calendar', color: '#4fdbc8' },
              { label: 'Emergency', icon: 'sos', href: '/emergency', color: '#ffb4ab' },
              { label: 'Ask Nexus', icon: 'smart_toy', href: '/ask-nexus', color: '#adc6ff' },
              { label: 'Assets', icon: 'inventory_2', href: '/assets', color: '#4fdbc8' },
              { label: 'Knowledge', icon: 'menu_book', href: '/knowledge', color: '#adc6ff' },
              { label: 'Contacts', icon: 'contacts', href: '/contacts', color: '#ffb59e' },
            ].map((module) => (
              <Link
                key={module.label}
                href={module.href}
                className="flex flex-col items-center gap-1.5 p-2 sm:p-3 rounded-xl transition-all active:scale-95 group"
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.05)',
                }}
              >
                <span
                  className="material-symbols-outlined"
                  style={{ fontSize: '22px', color: module.color }}
                >
                  {module.icon}
                </span>
                <span className="text-label-sm" style={{ color: '#bbcac6', fontSize: '11px' }}>{module.label}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Morning Wish Video Overlay */}
      {showMorningWish && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#090f0e]"
        >
          <video
            ref={wishVideoRef}
            src="/after-login-welcome.mp4"
            playsInline
            onEnded={() => {
              setShowMorningWish(false);
            }}
            onError={(e) => {
              console.error("Morning wish video error, skipping:", e);
              setShowMorningWish(false);
            }}
            className="w-full h-full object-contain md:max-w-4xl"
          />

          <button
            onClick={() => {
              if (wishVideoRef.current) {
                wishVideoRef.current.pause();
              }
              setShowMorningWish(false);
            }}
            className="absolute bottom-8 right-8 px-6 py-3 bg-white/5 border border-white/10 text-[#4fdbc8] font-semibold rounded-xl text-xs hover:bg-white/10 active:scale-[0.98] transition-all flex items-center gap-1 cursor-pointer shadow-lg z-50"
          >
            Skip Intro
            <span className="material-symbols-outlined text-[14px]">skip_next</span>
          </button>
        </div>
      )}
    </div>
  );
}
