'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('saran.neralla@gmail.com');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rememberDevice, setRememberDevice] = useState(false);
  const redirectTo = searchParams.get('redirectTo') || '/dashboard';
  const [stage, setStage] = useState<'splash' | 'video' | 'login'>('splash');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error('Please enter your email and password');
      return;
    }
    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        toast.error(error.message || 'Invalid credentials');
        return;
      }
      toast.success('Welcome back!');
      router.push(redirectTo);
      router.refresh();
    } catch {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (stage === 'splash') {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#090f0e] relative overflow-hidden">
        {/* Glowing background shapes */}
        <div className="absolute w-[500px] h-[500px] rounded-full bg-[#14b8a6]/10 blur-[100px] animate-pulse" />
        <div className="absolute w-[300px] h-[300px] rounded-full bg-[#0566d9]/10 blur-[80px] bottom-10 right-10" />

        <div className="relative z-10 flex flex-col items-center gap-8 text-center max-w-md px-6 fade-in">
          {/* Animated logo */}
          <div className="w-32 h-32 rounded-3xl bg-gradient-to-br from-[#14b8a6] to-[#0566d9] p-[1px] shadow-[0_0_50px_rgba(79,219,200,0.15)]">
            <div className="w-full h-full bg-[#0e1513] rounded-3xl flex items-center justify-center">
              <span className="material-symbols-outlined text-[64px] text-[#4fdbc8] select-none animate-pulse" style={{ fontVariationSettings: "'FILL' 1" }}>
                hub
              </span>
            </div>
          </div>

          <div>
            <h1 className="text-display-lg text-gradient leading-tight tracking-tight select-none" style={{ fontFamily: 'Geist, sans-serif', fontSize: '56px', fontWeight: '800' }}>NEXUS</h1>
            <p className="text-[#859490] text-label-sm mt-2 tracking-widest uppercase text-xs">Family Operating System</p>
          </div>

          <button
            onClick={() => setStage('video')}
            className="mt-6 px-8 py-4 rounded-2xl bg-gradient-to-br from-[#14b8a6] to-[#0566d9] text-white font-bold tracking-wide shadow-[0_0_30px_rgba(20,184,166,0.3)] hover:shadow-[0_0_50px_rgba(20,184,166,0.5)] active:scale-95 transition-all flex items-center gap-3 border border-white/10 group cursor-pointer"
          >
            <span>Initialize Console</span>
            <span className="material-symbols-outlined text-lg transition-transform group-hover:translate-x-1">play_arrow</span>
          </button>
        </div>
      </div>
    );
  }

  if (stage === 'video') {
    return (
      <div className="h-screen w-screen bg-[#090f0e] flex items-center justify-center relative overflow-hidden">
        <video
          src="/welcome.mp4"
          autoPlay
          playsInline
          onEnded={() => setStage('login')}
          className="w-full h-full object-contain md:max-w-4xl"
        />

        <button
          onClick={() => setStage('login')}
          className="absolute bottom-8 right-8 px-6 py-3 bg-white/5 border border-white/10 text-[#4fdbc8] font-semibold rounded-xl text-xs hover:bg-white/10 active:scale-[0.98] transition-all flex items-center gap-1 cursor-pointer shadow-lg"
        >
          Skip Intro
          <span className="material-symbols-outlined text-[14px]">skip_next</span>
        </button>
      </div>
    );
  }

  return (
    <div
      className="h-screen flex items-center justify-center overflow-hidden relative"
      style={{ backgroundColor: '#090f0e' }}
    >
      {/* Ambient WebGL Background */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse at 30% 50%, rgba(20, 184, 166, 0.08) 0%, transparent 60%), radial-gradient(ellipse at 70% 80%, rgba(5, 102, 217, 0.06) 0%, transparent 50%)',
        }}
      />

      <main className="relative z-10 w-full h-full flex flex-col md:flex-row">
        {/* Left Section — Hero (Desktop) */}
        <section className="hidden md:flex relative w-1/2 h-full items-center justify-center overflow-hidden" style={{ padding: '64px' }}>
          <div
            className="absolute inset-0"
            style={{
              background:
                'linear-gradient(135deg, rgba(20,184,166,0.12) 0%, rgba(5,102,217,0.08) 50%, transparent 100%)',
            }}
          />
          {/* Decorative orbs */}
          <div
            className="absolute w-96 h-96 rounded-full"
            style={{
              background: 'radial-gradient(circle, rgba(79,219,200,0.15) 0%, transparent 70%)',
              top: '10%',
              left: '-10%',
              filter: 'blur(40px)',
            }}
          />
          <div
            className="absolute w-64 h-64 rounded-full"
            style={{
              background: 'radial-gradient(circle, rgba(173,198,255,0.1) 0%, transparent 70%)',
              bottom: '20%',
              right: '5%',
              filter: 'blur(30px)',
            }}
          />

          <div className="relative z-10 max-w-lg fade-in" style={{ animationDelay: '0.2s' }}>
            {/* Logo */}
            <div className="mb-8 flex justify-start">
              <img
                src="/logo.png"
                alt="Neralla Nexus Logo"
                className="w-48 h-auto object-contain"
              />
            </div>

            <h1
              className="mb-6 leading-tight"
              style={{
                fontFamily: 'Geist, sans-serif',
                fontSize: '48px',
                fontWeight: '700',
                letterSpacing: '-0.03em',
                color: '#dde4e1',
              }}
            >
              Secure Your{' '}
              <span style={{ color: '#4fdbc8' }}>Legacy.</span>
            </h1>
            <p className="text-body-lg mb-12" style={{ color: '#859490', maxWidth: '360px' }}>
              Access your family&apos;s centralized operating system. Encrypted, private, and unified.
            </p>

            {/* Feature Badges */}
            <div className="flex flex-wrap gap-3">
              {[
                { icon: 'lock', label: 'AES-256 Encrypted' },
                { icon: 'family_restroom', label: 'Family Private' },
                { icon: 'shield', label: 'Enterprise Security' },
              ].map((badge) => (
                <div
                  key={badge.label}
                  className="flex items-center gap-2 px-4 py-2 rounded-full"
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                  }}
                >
                  <span className="material-symbols-outlined text-sm" style={{ color: '#4fdbc8', fontSize: '16px' }}>
                    {badge.icon}
                  </span>
                  <span className="text-label-sm" style={{ color: '#bbcac6' }}>{badge.label}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Right Section — Login Card */}
        <section className="w-full md:w-1/2 h-full flex items-center justify-center px-6 md:px-16">
          <div
            className="w-full max-w-[440px] p-8 md:p-10 rounded-[32px] flex flex-col fade-in glass-modal inner-glow"
          >
            {/* Mobile Logo */}
            <div className="md:hidden flex items-center justify-center mb-8">
              <img
                src="/logo.png"
                alt="Neralla Nexus Logo"
                className="w-40 h-auto object-contain"
              />
            </div>

            {/* Header */}
            <div className="mb-8">
              <h2
                style={{
                  fontFamily: 'Geist, sans-serif',
                  fontSize: '28px',
                  fontWeight: '600',
                  color: '#dde4e1',
                  letterSpacing: '-0.02em',
                }}
              >
                Welcome Home
              </h2>
              <p className="text-body-sm mt-1" style={{ color: '#859490' }}>
                The Digital Home of Neralla Family
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleLogin} className="space-y-5">
              {/* Email */}
              <div className="space-y-2">
                <label
                  htmlFor="email"
                  className="text-label-sm uppercase"
                  style={{ color: '#859490' }}
                >
                  Identity
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email address"
                  className="input-glass w-full px-5 py-4 rounded-2xl text-body-md"
                  style={{ color: '#dde4e1' }}
                  required
                  autoComplete="email"
                />
              </div>

              {/* Password */}
              <div className="space-y-2">
                <label
                  htmlFor="password"
                  className="text-label-sm uppercase"
                  style={{ color: '#859490' }}
                >
                  Key
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Your password"
                    className="input-glass w-full px-5 py-4 pr-14 rounded-2xl text-body-md"
                    style={{ color: '#dde4e1' }}
                    required
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 transition-colors"
                    style={{ color: '#859490' }}
                    aria-label="Toggle password visibility"
                  >
                    <span className="material-symbols-outlined">
                      {showPassword ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>
              </div>

              {/* Remember + Forgot */}
              <div className="flex items-center justify-between py-1">
                <label className="flex items-center gap-3 cursor-pointer group">
                  <div className="relative">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={rememberDevice}
                      onChange={(e) => setRememberDevice(e.target.checked)}
                    />
                    <div
                      className="w-10 h-5 rounded-full transition-colors"
                      style={{
                        backgroundColor: rememberDevice ? '#14b8a6' : 'rgba(255,255,255,0.08)',
                      }}
                    />
                    <div
                      className="absolute left-1 top-1 w-3 h-3 bg-white rounded-full transition-transform"
                      style={{
                        transform: rememberDevice ? 'translateX(20px)' : 'translateX(0)',
                      }}
                    />
                  </div>
                  <span className="text-label-sm" style={{ color: '#bbcac6' }}>Remember device</span>
                </label>
                <button
                  type="button"
                  className="text-label-sm transition-colors hover:underline"
                  style={{ color: '#4fdbc8' }}
                >
                  Forgot Key?
                </button>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 rounded-2xl flex items-center justify-center gap-2 font-semibold transition-all active:scale-[0.98] disabled:opacity-60"
                style={{
                  background: loading ? 'rgba(20,184,166,0.5)' : 'linear-gradient(135deg, #14b8a6, #0566d9)',
                  color: 'white',
                  fontSize: '16px',
                  boxShadow: '0 8px 32px rgba(20,184,166,0.3)',
                }}
              >
                {loading ? (
                  <>
                    <span className="material-symbols-outlined animate-spin" style={{ fontSize: '20px' }}>progress_activity</span>
                    Authenticating...
                  </>
                ) : (
                  <>
                    Enter Vault
                    <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>login</span>
                  </>
                )}
              </button>

              {/* Divider */}
              <div className="flex items-center gap-4 py-1">
                <div className="h-px flex-grow" style={{ background: 'rgba(255,255,255,0.06)' }} />
                <span className="text-label-sm" style={{ color: '#859490' }}>SECURE BIOMETRICS</span>
                <div className="h-px flex-grow" style={{ background: 'rgba(255,255,255,0.06)' }} />
              </div>

              {/* Biometric */}
              <button
                type="button"
                className="w-full py-4 rounded-2xl flex items-center justify-center gap-3 font-medium transition-all active:scale-[0.98]"
                style={{
                  background: 'rgba(79,219,200,0.08)',
                  border: '1px solid rgba(79,219,200,0.2)',
                  color: '#4fdbc8',
                }}
                onClick={() => toast.info('Biometric login coming soon')}
              >
                <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>fingerprint</span>
                <span>Biometric Login</span>
              </button>
            </form>

            {/* Footer */}
            <div className="mt-8 text-center">
              <p className="text-label-sm" style={{ color: 'rgba(133,148,144,0.6)' }}>
                Protected by Neralla Nexus Quantum Shield™
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="h-screen flex items-center justify-center" style={{ backgroundColor: '#090f0e' }}>
        <span className="material-symbols-outlined animate-spin" style={{ fontSize: '32px', color: '#4fdbc8' }}>progress_activity</span>
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
