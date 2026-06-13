'use client';

import { useState } from 'react';
import { useUser } from '@/hooks/useUser';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

export default function SettingsPage() {
  const { user, refetch } = useUser();
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [saving, setSaving] = useState(false);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('users')
        .update({ full_name: fullName })
        .eq('id', user.id);
      if (error) throw error;
      toast.success('Profile updated successfully');
      refetch();
    } catch {
      toast.error('Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="px-4 md:px-8 py-6 max-w-2xl space-y-8">
      <div>
        <h1
          style={{
            fontFamily: 'Geist, sans-serif',
            fontSize: '32px',
            fontWeight: '700',
            color: '#dde4e1',
            letterSpacing: '-0.02em',
          }}
        >
          Settings
        </h1>
        <p className="text-body-md mt-1" style={{ color: '#859490' }}>Manage your account and preferences</p>
      </div>

      {/* Profile */}
      <div className="glass-card rounded-2xl p-6">
        <h2
          className="mb-5"
          style={{ fontFamily: 'Geist, sans-serif', fontSize: '20px', fontWeight: '600', color: '#dde4e1' }}
        >
          Profile
        </h2>

        {/* Avatar */}
        <div className="flex items-center gap-4 mb-6">
          <div
            className="w-20 h-20 rounded-2xl flex items-center justify-center text-2xl font-bold"
            style={{ background: 'linear-gradient(135deg, #14b8a6, #0566d9)', color: 'white' }}
          >
            {user?.full_name?.slice(0, 1) || 'U'}
          </div>
          <div>
            <p className="text-body-md font-semibold" style={{ color: '#dde4e1' }}>{user?.full_name}</p>
            <p className="text-body-sm" style={{ color: '#859490' }}>{user?.email}</p>
            <span
              className="inline-block mt-1 px-3 py-1 rounded-full text-label-sm capitalize"
              style={{ background: 'rgba(79,219,200,0.1)', color: '#4fdbc8' }}
            >
              {user?.role} {user?.is_owner && '· Owner'}
            </span>
          </div>
        </div>

        <form onSubmit={handleSaveProfile} className="space-y-4">
          <div className="space-y-2">
            <label className="text-label-sm uppercase" style={{ color: '#859490' }}>Full Name</label>
            <input
              type="text"
              value={fullName || user?.full_name || ''}
              onChange={(e) => setFullName(e.target.value)}
              className="input-glass w-full px-4 py-3 rounded-xl text-body-md"
              style={{ color: '#dde4e1' }}
              placeholder="Your full name"
            />
          </div>
          <div className="space-y-2">
            <label className="text-label-sm uppercase" style={{ color: '#859490' }}>Email</label>
            <input
              type="email"
              value={user?.email || ''}
              disabled
              className="w-full px-4 py-3 rounded-xl text-body-md cursor-not-allowed"
              style={{
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.05)',
                color: '#859490',
              }}
            />
            <p className="text-label-sm" style={{ color: '#859490' }}>Email cannot be changed</p>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-3 rounded-xl font-semibold transition-all active:scale-95 disabled:opacity-60"
            style={{
              background: 'linear-gradient(135deg, #14b8a6, #0566d9)',
              color: 'white',
            }}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </form>
      </div>

      {/* Security */}
      <div className="glass-card rounded-2xl p-6">
        <h2
          className="mb-5"
          style={{ fontFamily: 'Geist, sans-serif', fontSize: '20px', fontWeight: '600', color: '#dde4e1' }}
        >
          Security
        </h2>
        <div className="space-y-3">
          {[
            { icon: 'lock', label: 'AES-256 Encryption', value: 'Active', color: '#4fdbc8' },
            { icon: 'verified_user', label: 'Row-Level Security', value: 'Enabled', color: '#4fdbc8' },
            { icon: 'fingerprint', label: 'Biometric Login', value: 'Coming Soon', color: '#859490' },
            { icon: 'pin', label: 'PIN Verification', value: 'Coming Soon', color: '#859490' },
          ].map((item) => (
            <div
              key={item.label}
              className="flex items-center justify-between p-4 rounded-xl"
              style={{ background: 'rgba(255,255,255,0.03)' }}
            >
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined" style={{ fontSize: '20px', color: item.color }}>{item.icon}</span>
                <span className="text-body-sm" style={{ color: '#dde4e1' }}>{item.label}</span>
              </div>
              <span className="text-label-sm" style={{ color: item.color }}>{item.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
