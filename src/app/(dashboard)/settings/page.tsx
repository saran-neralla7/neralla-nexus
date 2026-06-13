'use client';

import { useEffect, useState, useTransition } from 'react';
import { useUser } from '@/hooks/useUser';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import type { FamilyMember } from '@/types';
import {
  fetchLegacyPlan,
  saveLegacyPlan,
  saveBackupSettings,
  exportFamilyData,
  updateSettingsPin,
} from './actions';

export default function SettingsPage() {
  const { user, refetch } = useUser();
  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'backup' | 'legacy'>('profile');
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  // Profile Form State
  const [fullName, setFullName] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  // Security PIN State
  const [hasPin, setHasPin] = useState(false);
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');

  // Backup State
  const [backupFreq, setBackupFreq] = useState('weekly');
  const [exporting, setExporting] = useState(false);

  // Digital Legacy State
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [trustedContactId, setTrustedContactId] = useState('');
  const [instructions, setInstructions] = useState('');
  const [accessType, setAccessType] = useState('emergency');
  const [legacyActive, setLegacyActive] = useState(false);

  const loadData = async () => {
    if (!user) return;
    try {
      setLoading(true);
      const supabase = createClient();
      setFullName(user.full_name || '');

      // Check if user has PIN
      const { data: userRecord } = await supabase
        .from('users')
        .select('pin_hash, family_id')
        .eq('id', user.id)
        .single();
      setHasPin(!!userRecord?.pin_hash);

      if (userRecord?.family_id) {
        // Fetch family members
        const { data: membersData } = await supabase
          .from('family_members')
          .select('*')
          .eq('family_id', userRecord.family_id)
          .order('full_name');
        setMembers(membersData || []);

        // Fetch backup settings
        const { data: family } = await supabase
          .from('families')
          .select('settings')
          .eq('id', userRecord.family_id)
          .single();
        if (family?.settings?.backup_frequency) {
          setBackupFreq(family.settings.backup_frequency);
        }

        // Fetch Legacy Plan
        const plan = await fetchLegacyPlan();
        if (plan) {
          setTrustedContactId(plan.trusted_contact || '');
          setInstructions(plan.instructions || '');
          setAccessType(plan.access_type || 'emergency');
          setLegacyActive(plan.is_active || false);
        }
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to load settings data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user]);

  // Profile Save
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSavingProfile(true);
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
      setSavingProfile(false);
    }
  };

  // Security PIN Save
  const handleSavePin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPin !== confirmPin) {
      toast.error('PINs do not match');
      return;
    }
    if (!/^\d{4,6}$/.test(newPin)) {
      toast.error('PIN must be 4 to 6 numeric digits');
      return;
    }

    startTransition(async () => {
      try {
        await updateSettingsPin(hasPin ? currentPin : null, newPin);
        toast.success(hasPin ? 'PIN changed successfully' : 'PIN configured successfully');
        setCurrentPin('');
        setNewPin('');
        setConfirmPin('');
        setHasPin(true);
      } catch (err: any) {
        toast.error(err.message || 'Failed to update PIN code');
      }
    });
  };

  // Backup frequency save
  const handleSaveBackupFreq = async () => {
    startTransition(async () => {
      try {
        await saveBackupSettings(backupFreq);
        toast.success('Backup frequency settings updated');
      } catch (err: any) {
        toast.error(err.message || 'Failed to save backup settings');
      }
    });
  };

  // Export package handler
  const handleExportData = async () => {
    setExporting(true);
    try {
      const backupObj = await exportFamilyData();
      const jsonStr = JSON.stringify(backupObj, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `neralla-nexus-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      toast.success('Family data backup package downloaded successfully');
    } catch (err: any) {
      toast.error(err.message || 'Failed to export backup package');
    } finally {
      setExporting(false);
    }
  };

  // Legacy Plan save
  const handleSaveLegacyPlan = async (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      try {
        await saveLegacyPlan({
          trusted_contact: trustedContactId,
          instructions,
          access_type: accessType,
          is_active: legacyActive,
        });
        toast.success('Digital legacy plan directives saved successfully');
      } catch (err: any) {
        toast.error(err.message || 'Failed to save digital legacy plan');
      }
    });
  };

  const tabs = [
    { id: 'profile', label: 'My Profile', icon: 'person' },
    { id: 'security', label: 'Security PIN', icon: 'lock' },
    { id: 'backup', label: 'Data & Backup', icon: 'backup' },
    { id: 'legacy', label: 'Digital Legacy', icon: 'gavel' },
  ];

  return (
    <div className="px-4 md:px-8 py-6 space-y-6 max-w-4xl">
      {/* Title */}
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
          Control Panel
        </h1>
        <p className="text-body-md mt-1" style={{ color: '#859490' }}>
          Configure profile details, security PIN, export family backups, and digital legacy plans.
        </p>
      </div>

      {/* Tabs list */}
      <div className="flex border-b border-white/5 gap-2 overflow-x-auto pb-1 custom-scrollbar">
        {tabs.map((t) => {
          const active = activeTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id as any)}
              className={`flex items-center gap-2 px-5 py-3 border-b-2 font-medium text-body-sm transition-all whitespace-nowrap ${
                active
                  ? 'border-[#4fdbc8] text-[#4fdbc8] bg-[#4fdbc8]/5'
                  : 'border-transparent text-[#bbcac6] hover:text-[#4fdbc8] hover:bg-white/[0.02]'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">{t.icon}</span>
              {t.label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="py-12 text-center text-[#859490]">
          <span className="material-symbols-outlined animate-spin text-[32px] text-[#4fdbc8] mb-2">
            progress_activity
          </span>
          <p className="text-body-md">Retrieving settings details...</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* PROFILE TAB */}
          {activeTab === 'profile' && (
            <div className="glass-card rounded-2xl p-6 space-y-6 max-w-2xl">
              <div>
                <h3
                  className="text-[#dde4e1] font-semibold text-lg"
                  style={{ fontFamily: 'Geist, sans-serif' }}
                >
                  Family Profile Information
                </h3>
                <p className="text-xs text-[#859490] mt-0.5">Manage your name and see account permissions.</p>
              </div>

              {/* Avatar and Info */}
              <div className="flex items-center gap-4">
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center text-xl font-bold border border-white/10"
                  style={{ background: 'linear-gradient(135deg, #14b8a6, #0566d9)', color: 'white' }}
                >
                  {user?.full_name?.slice(0, 1) || 'U'}
                </div>
                <div>
                  <h4 className="font-semibold text-body-md text-[#dde4e1]">{user?.full_name}</h4>
                  <p className="text-xs text-[#859490] mt-0.5">{user?.email}</p>
                  <span
                    className="inline-block mt-1.5 px-3 py-0.5 rounded-full text-[10px] font-bold capitalize"
                    style={{ background: 'rgba(79,219,200,0.1)', color: '#4fdbc8', border: '1px solid rgba(79,219,200,0.2)' }}
                  >
                    Role: {user?.role} {user?.is_owner && '· Owner'}
                  </span>
                </div>
              </div>

              <form onSubmit={handleSaveProfile} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-label-sm text-[#bbcac6]">Full Name</label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-white/10 bg-transparent text-[#dde4e1] focus:border-[#4fdbc8] focus:outline-none"
                    placeholder="Your full name"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-label-sm text-[#bbcac6]">Email Address</label>
                  <input
                    type="email"
                    value={user?.email || ''}
                    disabled
                    className="w-full px-4 py-3 rounded-xl border border-white/5 bg-white/[0.01] text-[#859490] cursor-not-allowed"
                  />
                  <p className="text-[10px] text-[#859490]">Email address cannot be changed in local settings.</p>
                </div>

                <button
                  type="submit"
                  disabled={savingProfile}
                  className="py-3 px-6 bg-gradient-to-br from-[#14b8a6] to-[#0566d9] text-white font-bold rounded-xl hover:brightness-110 disabled:opacity-50 transition-all active:scale-95 shadow-md"
                >
                  {savingProfile ? 'Saving...' : 'Save Changes'}
                </button>
              </form>
            </div>
          )}

          {/* SECURITY PIN TAB */}
          {activeTab === 'security' && (
            <div className="glass-card rounded-2xl p-6 space-y-6 max-w-2xl">
              <div>
                <h3
                  className="text-[#dde4e1] font-semibold text-lg"
                  style={{ fontFamily: 'Geist, sans-serif' }}
                >
                  Vault PIN Code Security
                </h3>
                <p className="text-xs text-[#859490] mt-0.5">
                  Manage the 4-6 digit passcode used to reveal sensitive documents, insurance numbers, and passwords.
                </p>
              </div>

              <form onSubmit={handleSavePin} className="space-y-4">
                {hasPin && (
                  <div className="space-y-1.5">
                    <label className="text-label-sm text-[#bbcac6]">Current Security PIN</label>
                    <input
                      type="password"
                      required
                      maxLength={6}
                      placeholder="••••••"
                      value={currentPin}
                      onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, ''))}
                      className="w-full px-4 py-3 rounded-xl border border-white/10 bg-transparent text-[#dde4e1] placeholder:text-[#859490]/50 focus:border-[#4fdbc8] focus:outline-none tracking-widest text-center text-lg"
                    />
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-label-sm text-[#bbcac6]">New Security PIN</label>
                    <input
                      type="password"
                      required
                      maxLength={6}
                      placeholder="••••••"
                      value={newPin}
                      onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                      className="w-full px-4 py-3 rounded-xl border border-white/10 bg-transparent text-[#dde4e1] placeholder:text-[#859490]/50 focus:border-[#4fdbc8] focus:outline-none tracking-widest text-center text-lg"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-label-sm text-[#bbcac6]">Confirm New PIN</label>
                    <input
                      type="password"
                      required
                      maxLength={6}
                      placeholder="••••••"
                      value={confirmPin}
                      onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                      className="w-full px-4 py-3 rounded-xl border border-white/10 bg-transparent text-[#dde4e1] placeholder:text-[#859490]/50 focus:border-[#4fdbc8] focus:outline-none tracking-widest text-center text-lg"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isPending}
                  className="py-3 px-6 bg-gradient-to-br from-[#14b8a6] to-[#0566d9] text-white font-bold rounded-xl hover:brightness-110 disabled:opacity-50 transition-all active:scale-95 shadow-md"
                >
                  {isPending ? 'Updating...' : hasPin ? 'Change PIN Code' : 'Configure PIN'}
                </button>
              </form>
            </div>
          )}

          {/* DATA & BACKUP TAB */}
          {activeTab === 'backup' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Backups schedule */}
              <div className="glass-card rounded-2xl p-6 space-y-5">
                <div>
                  <h3
                    className="text-[#dde4e1] font-semibold text-lg"
                    style={{ fontFamily: 'Geist, sans-serif' }}
                  >
                    Automated Backup Routine
                  </h3>
                  <p className="text-xs text-[#859490] mt-0.5">Set schedule intervals for background backups.</p>
                </div>

                <div className="space-y-3">
                  {['daily', 'weekly', 'monthly', 'disabled'].map((freq) => (
                    <label
                      key={freq}
                      className="flex items-center justify-between p-3 bg-white/5 border border-white/5 rounded-xl cursor-pointer hover:bg-white/[0.08] transition-colors"
                    >
                      <span className="text-body-sm text-[#bbcac6] capitalize">{freq}</span>
                      <input
                        type="radio"
                        name="backup_freq"
                        value={freq}
                        checked={backupFreq === freq}
                        onChange={(e) => setBackupFreq(e.target.value)}
                        className="text-[#4fdbc8] focus:ring-[#4fdbc8]/20 h-4 w-4 bg-transparent border-white/10"
                      />
                    </label>
                  ))}
                </div>

                <button
                  onClick={handleSaveBackupFreq}
                  disabled={isPending}
                  className="py-2.5 px-5 bg-white/5 hover:bg-white/10 border border-white/10 text-[#4fdbc8] hover:text-[#71f8e4] font-semibold rounded-xl text-xs transition-colors"
                >
                  Update Frequency
                </button>
              </div>

              {/* Data Export */}
              <div className="glass-card rounded-2xl p-6 flex flex-col justify-between gap-5">
                <div className="space-y-3">
                  <div className="w-12 h-12 rounded-xl bg-[#14b8a6]/10 flex items-center justify-center text-[#4fdbc8]">
                    <span className="material-symbols-outlined text-[28px]">download</span>
                  </div>
                  <div>
                    <h3
                      className="text-[#dde4e1] font-semibold text-lg"
                      style={{ fontFamily: 'Geist, sans-serif' }}
                    >
                      Download Full Archival Export
                    </h3>
                    <p className="text-xs text-[#859490] mt-0.5 leading-relaxed">
                      Download a single, consolidated JSON package of all family tree records, assets, policies, calendars, and medical history. Your data remains private and local.
                    </p>
                  </div>
                </div>

                <button
                  onClick={handleExportData}
                  disabled={exporting}
                  className="w-full py-3 bg-gradient-to-br from-[#14b8a6] to-[#0566d9] text-white font-bold rounded-xl hover:brightness-110 active:scale-95 transition-all shadow-md flex items-center justify-center gap-2"
                >
                  {exporting ? (
                    <>
                      <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
                      Packaging Vault Data...
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined">download</span>
                      Download Backup package (.json)
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* DIGITAL LEGACY TAB */}
          {activeTab === 'legacy' && (
            <div className="glass-card rounded-2xl p-6 space-y-6 max-w-2xl">
              <div className="flex justify-between items-start gap-4">
                <div>
                  <h3
                    className="text-[#dde4e1] font-semibold text-lg"
                    style={{ fontFamily: 'Geist, sans-serif' }}
                  >
                    Digital Legacy Plans
                  </h3>
                  <p className="text-xs text-[#859490] mt-0.5">
                    Define directives and appoint trusted representatives to inherit your digital vault records.
                  </p>
                </div>
                <label className="flex items-center gap-2 cursor-pointer bg-white/5 border border-white/10 px-3 py-1.5 rounded-xl">
                  <span className="text-xs font-semibold text-[#bbcac6]">Active status</span>
                  <input
                    type="checkbox"
                    checked={legacyActive}
                    onChange={(e) => setLegacyActive(e.target.checked)}
                    className="text-[#4fdbc8] focus:ring-[#4fdbc8]/20 h-4 w-4 bg-transparent border-white/10 rounded"
                  />
                </label>
              </div>

              <form onSubmit={handleSaveLegacyPlan} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-label-sm text-[#bbcac6]">Appoint Trusted Legacy Representative</label>
                  <select
                    value={trustedContactId}
                    onChange={(e) => setTrustedContactId(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-white/10 bg-[#161d1b] text-[#dde4e1] focus:border-[#4fdbc8] focus:outline-none"
                    required
                  >
                    <option value="">-- Choose Family Member --</option>
                    {members.map((m) => (
                      <option key={m.id} value={m.full_name}>
                        {m.full_name} ({m.relationship || 'Member'})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-label-sm text-[#bbcac6]">Release Access Condition</label>
                  <select
                    value={accessType}
                    onChange={(e) => setAccessType(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-white/10 bg-[#161d1b] text-[#dde4e1] focus:border-[#4fdbc8] focus:outline-none"
                  >
                    <option value="emergency">Verification of Emergency (medical/accident)</option>
                    <option value="death">Confirmation of Demise (Legacy verification)</option>
                    <option value="immediate">Immediate Release (direct joint share)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-label-sm text-[#bbcac6]">Directives & Security Instructions</label>
                  <textarea
                    rows={4}
                    value={instructions}
                    onChange={(e) => setInstructions(e.target.value)}
                    placeholder="Provide specific instructions regarding the distribution of accounts, passcodes, safe locker details, and estate directives..."
                    className="w-full px-4 py-3 rounded-xl border border-white/10 bg-transparent text-[#dde4e1] placeholder:text-[#859490]/50 focus:border-[#4fdbc8] focus:outline-none resize-none leading-relaxed"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isPending}
                  className="py-3 px-6 bg-gradient-to-br from-[#14b8a6] to-[#0566d9] text-white font-bold rounded-xl hover:brightness-110 disabled:opacity-50 transition-all active:scale-95 shadow-md"
                >
                  {isPending ? 'Saving Plan...' : 'Save Legacy Directives'}
                </button>
              </form>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
