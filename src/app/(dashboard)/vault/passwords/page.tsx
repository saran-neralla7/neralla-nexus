'use client';

import { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useUser } from '@/hooks/useUser';
import { toast } from 'sonner';
import { getInitials, getAvatarStyle } from '@/lib/utils';
import NexusModal from '@/components/nexus/NexusModal';
import NexusConfirm from '@/components/nexus/NexusConfirm';
import type { FamilyMember } from '@/types';
import {
  checkPinSet,
  setupPin,
  verifyVaultPin,
  checkVaultSession,
  clearVaultSession,
  fetchPasswords,
  revealPassword,
  createPassword,
  updatePassword,
  deletePassword,
} from './actions';

interface PasswordDisplayEntry {
  id: string;
  category: string;
  title: string;
  url?: string;
  member_id?: string;
  created_at: string;
  updated_at: string;
  has_username: boolean;
  has_notes: boolean;
}

const CATEGORIES = [
  { id: 'all', label: 'All Passwords', icon: 'key' },
  { id: 'ott', label: 'Streaming & OTT', icon: 'play_circle' },
  { id: 'email', label: 'Email Accounts', icon: 'mail' },
  { id: 'social_media', label: 'Social Media', icon: 'share' },
  { id: 'banking', label: 'Banking & Finance', icon: 'account_balance' },
  { id: 'utilities', label: 'Utilities & Subscriptions', icon: 'receipt_long' },
  { id: 'wifi', label: 'WiFi & Network', icon: 'wifi' },
  { id: 'other', label: 'Others', icon: 'more_horiz' },
];

export default function PasswordsPage() {
  const { user } = useUser();
  const [passwords, setPasswords] = useState<PasswordDisplayEntry[]>([]);
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  // PIN Status
  const [pinConfigured, setPinConfigured] = useState<boolean | null>(null);
  const [sessionVerified, setSessionVerified] = useState<boolean>(false);

  // Search & Filter
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Setup PIN State
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');

  // Verify PIN Modal State
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [enteredPin, setEnteredPin] = useState('');
  const [pinActionCallback, setPinActionCallback] = useState<(() => void) | null>(null);

  // Add / Edit password State
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formCategory, setFormCategory] = useState('ott');
  const [formUsername, setFormUsername] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formUrl, setFormUrl] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formMemberId, setFormMemberId] = useState('');

  // Reveal Details Modal State
  const [revealedEntry, setRevealedEntry] = useState<{
    id: string;
    title: string;
    category: string;
    username?: string;
    password?: string;
    url?: string;
    notes?: string;
  } | null>(null);
  const [showPasswordText, setShowPasswordText] = useState(false);

  // Delete Confirm State
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Fetch passwords and members
  const loadVaultData = async () => {
    try {
      setLoading(true);
      const isSet = await checkPinSet();
      setPinConfigured(isSet);

      if (isSet) {
        const isVerified = await checkVaultSession();
        setSessionVerified(isVerified);
        
        // Load items list (encrypted fields are omitted on server payload)
        const items = await fetchPasswords();
        setPasswords(items);
      }

      // Load members for drop down assignees
      if (user?.family_id) {
        const supabase = createClient();
        const { data } = await supabase
          .from('family_members')
          .select('*')
          .eq('family_id', user.family_id)
          .order('full_name');
        setMembers(data || []);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to load password vault');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVaultData();
  }, [user]);

  // Handle PIN Setup
  const handleSetupPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPin !== confirmPin) {
      toast.error('PINs do not match');
      return;
    }
    if (!/^\d{4,6}$/.test(newPin)) {
      toast.error('PIN must be 4 to 6 digits');
      return;
    }

    try {
      setLoading(true);
      await setupPin(newPin);
      toast.success('Security PIN set successfully!');
      setPinConfigured(true);
      setSessionVerified(true);
      await loadVaultData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to configure PIN');
    } finally {
      setLoading(false);
    }
  };

  // Perform action with PIN protection
  const runWithPinProtection = async (action: () => void) => {
    const isVerified = await checkVaultSession();
    if (isVerified) {
      setSessionVerified(true);
      action();
    } else {
      setSessionVerified(false);
      setEnteredPin('');
      setPinActionCallback(() => action);
      setShowVerifyModal(true);
    }
  };

  // Verify PIN submission
  const handleVerifyPinSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!enteredPin) return;

    try {
      setLoading(true);
      await verifyVaultPin(enteredPin);
      setSessionVerified(true);
      setShowVerifyModal(false);
      toast.success('Vault unlocked');
      
      // Load passwords list if first unlock
      const items = await fetchPasswords();
      setPasswords(items);

      if (pinActionCallback) {
        pinActionCallback();
        setPinActionCallback(null);
      }
    } catch (err: any) {
      toast.error(err.message || 'Incorrect PIN entered');
      setEnteredPin('');
    } finally {
      setLoading(false);
    }
  };

  // Auto-submit PIN when correct length
  useEffect(() => {
    if (enteredPin.length >= 4 && enteredPin.length <= 6 && showVerifyModal) {
      const timer = setTimeout(() => {
        handleVerifyPinSubmit();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [enteredPin]);

  // Lock Vault
  const handleLockVault = async () => {
    try {
      await clearVaultSession();
      setSessionVerified(false);
      setRevealedEntry(null);
      toast.info('Vault locked securely');
    } catch (err) {
      toast.error('Failed to lock vault');
    }
  };

  // Create or Update Password submit
  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle || !formPassword) {
      toast.error('Title and Password are required');
      return;
    }

    startTransition(async () => {
      try {
        const payload = {
          category: formCategory,
          title: formTitle,
          username: formUsername || undefined,
          password: formPassword,
          url: formUrl || undefined,
          notes: formNotes || undefined,
          member_id: formMemberId || undefined,
        };

        if (editingEntryId) {
          await updatePassword(editingEntryId, payload);
          toast.success('Password updated successfully!');
        } else {
          await createPassword(payload);
          toast.success('Password stored securely!');
        }

        setShowFormModal(false);
        resetForm();
        
        // Reload passwords
        const items = await fetchPasswords();
        setPasswords(items);
      } catch (err: any) {
        toast.error(err.message || 'Failed to save password entry');
      }
    });
  };

  const resetForm = () => {
    setEditingEntryId(null);
    setFormTitle('');
    setFormCategory('ott');
    setFormUsername('');
    setFormPassword('');
    setFormUrl('');
    setFormNotes('');
    setFormMemberId('');
  };

  // Open Edit Form (with decryption)
  const handleOpenEdit = async (entry: PasswordDisplayEntry) => {
    runWithPinProtection(async () => {
      try {
        setLoading(true);
        const decrypted = await revealPassword(entry.id);
        
        setEditingEntryId(entry.id);
        setFormTitle(entry.title);
        setFormCategory(entry.category);
        setFormUsername(decrypted.username || '');
        setFormPassword(decrypted.password || '');
        setFormUrl(entry.url || '');
        setFormNotes(decrypted.notes || '');
        setFormMemberId(entry.member_id || '');
        
        setShowFormModal(true);
      } catch (err: any) {
        toast.error(err.message || 'Failed to retrieve password details');
      } finally {
        setLoading(false);
      }
    });
  };

  // View/Reveal Details
  const handleRevealEntry = async (entry: PasswordDisplayEntry) => {
    runWithPinProtection(async () => {
      try {
        setLoading(true);
        const decrypted = await revealPassword(entry.id);
        setRevealedEntry({
          id: entry.id,
          title: entry.title,
          category: entry.category,
          username: decrypted.username,
          password: decrypted.password,
          url: entry.url,
          notes: decrypted.notes,
        });
        setShowPasswordText(false);
      } catch (err: any) {
        toast.error(err.message || 'Failed to decrypt credentials');
      } finally {
        setLoading(false);
      }
    });
  };

  // Delete entry
  const handleDeleteConfirm = async () => {
    if (!deleteId) return;
    try {
      await deletePassword(deleteId);
      toast.success('Password entry deleted successfully');
      setDeleteId(null);
      
      // Reload
      const items = await fetchPasswords();
      setPasswords(items);
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete entry');
    }
  };

  // Copy Clipboard Helper
  const copyToClipboard = (text?: string, label = 'Copied') => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    toast.success(`${label} to clipboard`);
  };

  // Filters
  const filteredPasswords = passwords.filter((entry) => {
    const matchesCategory = selectedCategory === 'all' || entry.category === selectedCategory;
    const matchesSearch =
      entry.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (entry.url && entry.url.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  if (loading && passwords.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
        <span className="material-symbols-outlined animate-spin text-[36px]" style={{ color: '#4fdbc8' }}>
          progress_activity
        </span>
        <p className="text-body-md" style={{ color: '#859490' }}>Unlocking secure vault...</p>
      </div>
    );
  }

  // 1. PIN Setup screen if not configured
  if (pinConfigured === false) {
    return (
      <div className="max-w-md mx-auto my-12 px-4">
        <div className="glass-card rounded-[28px] p-8 border border-white/8 flex flex-col items-center text-center space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-[#4fdbc8]/10 border border-[#4fdbc8]/20 flex items-center justify-center">
            <span className="material-symbols-outlined text-[32px] text-[#4fdbc8]" style={{ fontVariationSettings: "'FILL' 1" }}>
              security
            </span>
          </div>

          <div>
            <h1 className="text-headline-md font-bold text-[#dde4e1]">Setup Security PIN</h1>
            <p className="text-body-sm mt-2" style={{ color: '#859490' }}>
              Your passwords will be encrypted locally with AES-256. Set a 4 to 6 digit security PIN to access the vault.
            </p>
          </div>

          <form onSubmit={handleSetupPin} className="w-full space-y-4 text-left">
            <div className="space-y-2">
              <label className="text-label-md text-[#bbcac6]">Enter Security PIN</label>
              <input
                type="password"
                required
                maxLength={6}
                pattern="\d*"
                inputMode="numeric"
                placeholder="••••"
                value={newPin}
                onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                className="w-full text-center tracking-widest text-lg font-bold px-4 py-3 rounded-xl border border-white/8 bg-[#0e1513] text-white focus:outline-none focus:border-[#4fdbc8]"
              />
            </div>

            <div className="space-y-2">
              <label className="text-label-md text-[#bbcac6]">Confirm Security PIN</label>
              <input
                type="password"
                required
                maxLength={6}
                pattern="\d*"
                inputMode="numeric"
                placeholder="••••"
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                className="w-full text-center tracking-widest text-lg font-bold px-4 py-3 rounded-xl border border-white/8 bg-[#0e1513] text-white focus:outline-none focus:border-[#4fdbc8]"
              />
            </div>

            <button
              type="submit"
              className="w-full py-3.5 mt-4 rounded-xl font-semibold bg-[#4fdbc8] text-[#003731] hover:bg-[#4fdbc8]/90 transition-all flex items-center justify-center gap-2"
            >
              Configure PIN & Unlock
            </button>
          </form>
        </div>
      </div>
    );
  }

  // 2. Vault is locked screen
  if (!sessionVerified) {
    return (
      <div className="max-w-md mx-auto my-16 px-4">
        <div className="glass-card rounded-[28px] p-8 border border-white/8 flex flex-col items-center text-center space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-[#ffb59e]/10 border border-[#ffb59e]/20 flex items-center justify-center">
            <span className="material-symbols-outlined text-[32px] text-[#ffb59e]" style={{ fontVariationSettings: "'FILL' 1" }}>
              lock
            </span>
          </div>

          <div>
            <h1 className="text-headline-md font-bold text-[#dde4e1]">Vault Locked</h1>
            <p className="text-body-sm mt-2" style={{ color: '#859490' }}>
              Verify your security PIN to decrypt and manage your family credentials.
            </p>
          </div>

          <form onSubmit={handleVerifyPinSubmit} className="w-full space-y-4">
            <input
              type="password"
              required
              autoFocus
              maxLength={6}
              pattern="\d*"
              inputMode="numeric"
              placeholder="••••"
              value={enteredPin}
              onChange={(e) => setEnteredPin(e.target.value.replace(/\D/g, ''))}
              className="w-full text-center tracking-[1em] text-2xl font-bold px-4 py-4 rounded-xl border border-white/8 bg-[#0e1513] text-white focus:outline-none focus:border-[#4fdbc8]"
            />

            <button
              type="submit"
              disabled={enteredPin.length < 4}
              className="w-full py-3.5 rounded-xl font-semibold bg-[#4fdbc8] text-[#003731] hover:bg-[#4fdbc8]/90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              Unlock Vault
            </button>
          </form>
        </div>
      </div>
    );
  }

  // 3. Authenticated vault dashboard
  return (
    <div className="px-4 md:px-8 py-6 space-y-6">
      
      {/* Top Banner Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span className="material-symbols-outlined text-[#4fdbc8] text-[28px]" style={{ fontVariationSettings: "'FILL' 1" }}>
              password
            </span>
            <h1 className="text-headline-md font-bold text-[#dde4e1] tracking-tight">Password Vault</h1>
          </div>
          <p className="text-body-sm text-[#859490]">AES-256 military-grade encrypted credentials</p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={handleLockVault}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-label-sm font-medium transition-all bg-white/5 border border-white/8 text-[#bbcac6] hover:bg-[#ffb4ab]/10 hover:text-[#ffb4ab] hover:border-[#ffb4ab]/20"
          >
            <span className="material-symbols-outlined text-[18px]">lock</span>
            <span>Lock Vault</span>
          </button>
          <button
            onClick={() => {
              resetForm();
              setShowFormModal(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-label-sm font-semibold transition-all bg-[#4fdbc8] text-[#003731] hover:bg-[#4fdbc8]/90 shadow-[0_4px_12px_rgba(79,219,200,0.2)]"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            <span>Add Password</span>
          </button>
        </div>
      </div>

      {/* Main vault content */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        
        {/* Category filters */}
        <div className="lg:col-span-1 space-y-1.5">
          <div className="hidden lg:block pb-2 px-2 text-label-sm text-[#859490] font-semibold uppercase tracking-wider text-[10px]">
            Categories
          </div>
          
          {/* Horizontal scroll on mobile, vertical list on desktop */}
          <div className="flex lg:flex-col overflow-x-auto lg:overflow-x-visible pb-3 lg:pb-0 gap-1.5 scrollbar-none">
            {CATEGORIES.map((cat) => {
              const isSelected = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-label-sm font-medium transition-all shrink-0 lg:shrink ${
                    isSelected
                      ? 'bg-[#4fdbc8]/10 text-[#4fdbc8] border border-[#4fdbc8]/20'
                      : 'bg-white/3 lg:bg-transparent text-[#bbcac6] hover:bg-white/5 border border-transparent'
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px]">{cat.icon}</span>
                  <span>{cat.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Passwords grid */}
        <div className="lg:col-span-3 space-y-4">
          
          {/* Search bar */}
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-[#859490] text-[20px]">
              search
            </span>
            <input
              type="text"
              placeholder="Search passwords by service or URL..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 rounded-xl border border-white/8 bg-white/3 text-body-sm text-white focus:outline-none focus:border-[#4fdbc8] transition-all"
            />
          </div>

          {/* Cards */}
          {filteredPasswords.length === 0 ? (
            <div className="glass-card rounded-2xl p-12 text-center border border-white/5">
              <span className="material-symbols-outlined text-[48px] text-[#859490] mb-3">vpn_key</span>
              <h3 className="text-body-lg font-semibold text-[#dde4e1]">No Credentials Found</h3>
              <p className="text-body-sm text-[#859490] mt-1 max-w-sm mx-auto">
                No password entries match your selection. Add a new password to secure it.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredPasswords.map((entry) => {
                const member = members.find((m) => m.id === entry.member_id);
                const categoryInfo = CATEGORIES.find((c) => c.id === entry.category);
                
                return (
                  <div
                    key={entry.id}
                    className="glass-card rounded-2xl p-4 border border-white/5 flex flex-col justify-between hover:border-white/12 transition-all relative overflow-hidden group"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Icon */}
                        <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/8 flex items-center justify-center text-[#bbcac6] shrink-0">
                          <span className="material-symbols-outlined text-[20px]">
                            {categoryInfo?.icon || 'key'}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-body-sm font-semibold text-[#dde4e1] truncate">
                            {entry.title}
                          </h3>
                          {entry.url ? (
                            <a
                              href={entry.url.startsWith('http') ? entry.url : `https://${entry.url}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[11px] text-[#4fdbc8] hover:underline truncate block max-w-[180px]"
                            >
                              {entry.url.replace(/^https?:\/\/(www\.)?/, '')}
                            </a>
                          ) : (
                            <span className="text-[10px] text-[#859490] font-mono">Secure Entry</span>
                          )}
                        </div>
                      </div>

                      {/* Associated member avatar */}
                      {member ? (
                        <div
                          className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[9px] font-bold border border-white/10 shrink-0"
                          style={{ background: getAvatarStyle(member.full_name) }}
                          title={`Belongs to ${member.full_name}`}
                        >
                          {getInitials(member.full_name)}
                        </div>
                      ) : (
                        <span className="px-2 py-0.5 rounded bg-white/5 border border-white/8 text-[9px] text-[#859490] font-mono">
                          Shared
                        </span>
                      )}
                    </div>

                    <div className="mt-5 pt-3 border-t border-white/5 flex items-center justify-between">
                      {/* Concealed username indicator */}
                      <span className="text-xs font-mono text-[#859490]">
                        {entry.has_username ? '••••••••' : 'No username'}
                      </span>

                      {/* Actions */}
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleRevealEntry(entry)}
                          className="p-1.5 rounded-lg text-[#bbcac6] hover:bg-white/5 hover:text-[#4fdbc8] transition-colors"
                          title="View Decrypted Details"
                        >
                          <span className="material-symbols-outlined text-[18px]">visibility</span>
                        </button>
                        <button
                          onClick={() => handleOpenEdit(entry)}
                          className="p-1.5 rounded-lg text-[#bbcac6] hover:bg-white/5 hover:text-white transition-colors"
                          title="Edit"
                        >
                          <span className="material-symbols-outlined text-[18px]">edit</span>
                        </button>
                        <button
                          onClick={() => setDeleteId(entry.id)}
                          className="p-1.5 rounded-lg text-[#859490] hover:bg-red-950/20 hover:text-[#ffb4ab] transition-colors"
                          title="Delete"
                        >
                          <span className="material-symbols-outlined text-[18px]">delete</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

        </div>
      </div>

      {/* 4. NexusModal - Setup/Edit Password Form */}
      <NexusModal
        isOpen={showFormModal}
        onClose={() => setShowFormModal(false)}
        title={editingEntryId ? 'Edit Secured Password' : 'Store Secure Password'}
        description="Fields will be encrypted with military-grade AES-256-GCM before writing to the database."
        size="md"
      >
        <form onSubmit={handleSavePassword} className="space-y-4 py-1">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-label-sm text-[#bbcac6]">Service Title</label>
              <input
                type="text"
                required
                placeholder="e.g. Netflix"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-white/8 bg-[#0e1513] text-body-sm text-white focus:outline-none focus:border-[#4fdbc8]"
              />
            </div>
            
            <div className="space-y-1.5">
              <label className="text-label-sm text-[#bbcac6]">Category</label>
              <select
                value={formCategory}
                onChange={(e) => setFormCategory(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-white/8 bg-[#0e1513] text-body-sm text-white focus:outline-none focus:border-[#4fdbc8]"
              >
                {CATEGORIES.filter(c => c.id !== 'all').map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-label-sm text-[#bbcac6]">Username / Email (Optional)</label>
            <input
              type="text"
              placeholder="e.g. saran@neralla.family"
              value={formUsername}
              onChange={(e) => setFormUsername(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-white/8 bg-[#0e1513] text-body-sm text-white focus:outline-none focus:border-[#4fdbc8]"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-label-sm text-[#bbcac6]">Password</label>
            <input
              type="text"
              required
              placeholder="Enter password"
              value={formPassword}
              onChange={(e) => setFormPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-white/8 bg-[#0e1513] text-body-sm text-white focus:outline-none focus:border-[#4fdbc8] font-mono"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-label-sm text-[#bbcac6]">Website URL (Optional)</label>
              <input
                type="text"
                placeholder="e.g. netflix.com"
                value={formUrl}
                onChange={(e) => setFormUrl(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-white/8 bg-[#0e1513] text-body-sm text-white focus:outline-none focus:border-[#4fdbc8]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-label-sm text-[#bbcac6]">Assignee Member (Optional)</label>
              <select
                value={formMemberId}
                onChange={(e) => setFormMemberId(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-white/8 bg-[#0e1513] text-body-sm text-white focus:outline-none focus:border-[#4fdbc8]"
              >
                <option value="">Shared / Family Wide</option>
                {members.map((mem) => (
                  <option key={mem.id} value={mem.id}>
                    {mem.full_name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-label-sm text-[#bbcac6]">Secure Notes (Optional)</label>
            <textarea
              rows={3}
              placeholder="e.g. Security questions, PINs, recovery codes..."
              value={formNotes}
              onChange={(e) => setFormNotes(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-white/8 bg-[#0e1513] text-body-sm text-white focus:outline-none focus:border-[#4fdbc8] resize-none"
            />
          </div>

          <div className="flex gap-3 pt-4 border-t border-white/5">
            <button
              type="button"
              onClick={() => setShowFormModal(false)}
              className="flex-1 py-3 rounded-xl font-semibold border border-white/8 text-[#bbcac6] bg-white/3 hover:bg-white/5 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex-1 py-3 rounded-xl font-semibold bg-[#4fdbc8] text-[#003731] hover:bg-[#4fdbc8]/90 transition-all flex items-center justify-center gap-2"
            >
              {isPending ? (
                <>
                  <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
                  Encrypting...
                </>
              ) : (
                'Encrypt & Save'
              )}
            </button>
          </div>
        </form>
      </NexusModal>

      {/* 5. NexusModal - Reveal Decrypted Password Details */}
      <NexusModal
        isOpen={revealedEntry !== null}
        onClose={() => setRevealedEntry(null)}
        title={revealedEntry?.title || 'Secured Credentials'}
        description="Decrypted details shown below. Copy actions are supported."
        size="md"
      >
        {revealedEntry && (
          <div className="space-y-4 py-1">
            
            {/* Username block */}
            {revealedEntry.username ? (
              <div className="p-3.5 rounded-xl bg-white/3 border border-white/5 flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <span className="text-[10px] uppercase font-semibold text-[#859490] block mb-1">Username / Email</span>
                  <span className="text-body-sm font-semibold text-white truncate block">{revealedEntry.username}</span>
                </div>
                <button
                  onClick={() => copyToClipboard(revealedEntry.username, 'Username')}
                  className="p-2 rounded-lg bg-white/5 text-[#bbcac6] hover:text-[#4fdbc8] hover:bg-white/10"
                >
                  <span className="material-symbols-outlined text-[18px]">content_copy</span>
                </button>
              </div>
            ) : (
              <p className="text-[11px] text-[#859490] italic">No username stored.</p>
            )}

            {/* Password block */}
            <div className="p-3.5 rounded-xl bg-white/3 border border-white/5 flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <span className="text-[10px] uppercase font-semibold text-[#859490] block mb-1">Decrypted Password</span>
                <span className="text-body-md font-mono font-bold text-[#4fdbc8] tracking-wide block truncate">
                  {showPasswordText ? revealedEntry.password : '••••••••••••'}
                </span>
              </div>
              <div className="flex gap-1.5 shrink-0">
                <button
                  onClick={() => setShowPasswordText(!showPasswordText)}
                  className="p-2 rounded-lg bg-white/5 text-[#bbcac6] hover:text-white hover:bg-white/10"
                >
                  <span className="material-symbols-outlined text-[18px]">
                    {showPasswordText ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
                <button
                  onClick={() => copyToClipboard(revealedEntry.password, 'Password')}
                  className="p-2 rounded-lg bg-white/5 text-[#bbcac6] hover:text-[#4fdbc8] hover:bg-white/10"
                >
                  <span className="material-symbols-outlined text-[18px]">content_copy</span>
                </button>
              </div>
            </div>

            {/* Website URL block */}
            {revealedEntry.url && (
              <div className="p-3.5 rounded-xl bg-white/3 border border-white/5 flex items-center justify-between gap-3 text-body-sm">
                <div className="min-w-0 flex-1">
                  <span className="text-[10px] uppercase font-semibold text-[#859490] block mb-1">Website URL</span>
                  <a
                    href={revealedEntry.url.startsWith('http') ? revealedEntry.url : `https://${revealedEntry.url}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#4fdbc8] hover:underline truncate block"
                  >
                    {revealedEntry.url}
                  </a>
                </div>
                <a
                  href={revealedEntry.url.startsWith('http') ? revealedEntry.url : `https://${revealedEntry.url}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-lg bg-white/5 text-[#bbcac6] hover:text-white hover:bg-white/10"
                >
                  <span className="material-symbols-outlined text-[18px]">open_in_new</span>
                </a>
              </div>
            )}

            {/* Notes block */}
            {revealedEntry.notes && (
              <div className="p-3.5 rounded-xl bg-white/3 border border-white/5 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-semibold text-[#859490]">Secure Notes</span>
                  <button
                    onClick={() => copyToClipboard(revealedEntry.notes, 'Notes')}
                    className="p-1 text-[#bbcac6] hover:text-[#4fdbc8]"
                  >
                    <span className="material-symbols-outlined text-[16px]">content_copy</span>
                  </button>
                </div>
                <p className="text-body-sm text-[#bbcac6] whitespace-pre-line bg-black/20 p-3 rounded-lg font-mono text-[11px] leading-relaxed border border-white/3">
                  {revealedEntry.notes}
                </p>
              </div>
            )}

            {/* Footer */}
            <div className="pt-4 border-t border-white/5 flex justify-end">
              <button
                onClick={() => setRevealedEntry(null)}
                className="px-6 py-2.5 rounded-xl font-semibold bg-white/5 border border-white/8 text-[#bbcac6] hover:bg-white/10 hover:text-white transition-all"
              >
                Close Details
              </button>
            </div>
          </div>
        )}
      </NexusModal>

      {/* 6. NexusModal - PIN Protection verification modal (triggered when session expires) */}
      <NexusModal
        isOpen={showVerifyModal}
        onClose={() => {
          setShowVerifyModal(false);
          setPinActionCallback(null);
        }}
        title="Verify Security PIN"
        description="Enter your 4 to 6 digit security PIN to proceed."
        size="sm"
      >
        <form onSubmit={handleVerifyPinSubmit} className="space-y-6 py-4 flex flex-col items-center">
          <div className="w-14 h-14 rounded-2xl bg-[#4fdbc8]/15 border border-[#4fdbc8]/20 flex items-center justify-center">
            <span className="material-symbols-outlined text-[28px] text-[#4fdbc8]" style={{ fontVariationSettings: "'FILL' 1" }}>
              shield_person
            </span>
          </div>

          <div className="w-full space-y-4">
            <input
              type="password"
              required
              autoFocus
              maxLength={6}
              pattern="\d*"
              inputMode="numeric"
              placeholder="••••"
              value={enteredPin}
              onChange={(e) => setEnteredPin(e.target.value.replace(/\D/g, ''))}
              className="w-full text-center tracking-[1em] text-2xl font-bold px-4 py-4 rounded-xl border border-white/8 bg-[#0e1513] text-white focus:outline-none focus:border-[#4fdbc8]"
            />

            <button
              type="submit"
              disabled={enteredPin.length < 4}
              className="w-full py-3.5 rounded-xl font-semibold bg-[#4fdbc8] text-[#003731] hover:bg-[#4fdbc8]/90 transition-all disabled:opacity-50 flex items-center justify-center"
            >
              Verify PIN
            </button>
          </div>
        </form>
      </NexusModal>

      {/* 7. NexusConfirm - Delete Password Entry */}
      <NexusConfirm
        isOpen={deleteId !== null}
        title="Delete Password Entry?"
        description="This will permanently delete this password entry from your family vault. This action cannot be undone."
        confirmText="Yes, Delete"
        cancelText="Cancel"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteId(null)}
        variant="danger"
      />

    </div>
  );
}
