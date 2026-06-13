'use client';

import { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useUser } from '@/hooks/useUser';
import { toast } from 'sonner';
import { formatDate, getInitials, getAvatarStyle, daysUntil } from '@/lib/utils';
import NexusModal from '@/components/nexus/NexusModal';
import NexusConfirm from '@/components/nexus/NexusConfirm';
import type { FamilyMember, Policy, Document } from '@/types';
import {
  fetchPolicies,
  revealPolicyNumber,
  createPolicy,
  updatePolicy,
  deletePolicy,
} from './actions';
import { checkVaultSession, verifyVaultPin } from '../vault/passwords/actions';

const POLICY_TYPES = [
  { id: 'all', label: 'All Policies', icon: 'shield', color: '#4fdbc8' },
  { id: 'lic', label: 'Life (LIC / Term)', icon: 'person', color: '#ffb59e' },
  { id: 'health', label: 'Health Insurance', icon: 'medical_services', color: '#f43f5e' },
  { id: 'vehicle', label: 'Vehicle Insurance', icon: 'directions_car', color: '#adc6ff' },
  { id: 'property', label: 'Property Insurance', icon: 'home', color: '#22c55e' },
  { id: 'other', label: 'Others', icon: 'more_horiz', color: '#859490' },
];

export default function PoliciesPage() {
  const { user } = useUser();
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [policyDocs, setPolicyDocs] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  // Security Session
  const [sessionVerified, setSessionVerified] = useState(false);

  // Filters & Search
  const [selectedType, setSelectedType] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Add / Edit Modal Form State
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingPolicyId, setEditingPolicyId] = useState<string | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formType, setFormType] = useState('lic');
  const [formProvider, setFormProvider] = useState('');
  const [formPolicyNumber, setFormPolicyNumber] = useState('');
  const [formPremiumAmount, setFormPremiumAmount] = useState('');
  const [formPremiumDate, setFormPremiumDate] = useState('');
  const [formExpiryDate, setFormExpiryDate] = useState('');
  const [formCoverage, setFormCoverage] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formMemberId, setFormMemberId] = useState('');
  const [formDocUrl, setFormDocUrl] = useState('');

  // PIN Verification Modal State
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [enteredPin, setEnteredPin] = useState('');
  const [pinCallback, setPinCallback] = useState<(() => void) | null>(null);

  // Detail Modal State
  const [viewedPolicy, setViewedPolicy] = useState<Policy | null>(null);
  const [decryptedNumber, setDecryptedNumber] = useState<string>('');

  // Delete Confirm State
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const loadData = async () => {
    if (!user?.family_id) return;
    try {
      setLoading(true);
      const supabase = createClient();

      // Fetch family members
      const { data: membersData } = await supabase
        .from('family_members')
        .select('*')
        .eq('family_id', user.family_id)
        .order('full_name');
      setMembers(membersData || []);

      // Fetch policies
      const items = await fetchPolicies();
      setPolicies(items);

      // Verify vault session
      const isVerified = await checkVaultSession();
      setSessionVerified(isVerified);

      // Fetch Vault documents of category 'insurance' or 'other'
      const { data: docs } = await supabase
        .from('documents')
        .select('*')
        .eq('family_id', user.family_id)
        .in('category', ['insurance', 'other'])
        .is('deleted_at', null)
        .order('name');
      setPolicyDocs(docs || []);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load policy data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user]);

  // Run action with PIN protection
  const runWithPin = async (action: () => void) => {
    const isVerified = await checkVaultSession();
    if (isVerified) {
      setSessionVerified(true);
      action();
    } else {
      setSessionVerified(false);
      setEnteredPin('');
      setPinCallback(() => action);
      setShowVerifyModal(true);
    }
  };

  // Verify PIN
  const handleVerifyPinSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!enteredPin) return;

    try {
      setLoading(true);
      await verifyVaultPin(enteredPin);
      setSessionVerified(true);
      setShowVerifyModal(false);
      toast.success('Security vault unlocked');

      if (pinCallback) {
        pinCallback();
        setPinCallback(null);
      }
    } catch (err: any) {
      toast.error(err.message || 'Incorrect security PIN');
      setEnteredPin('');
    } finally {
      setLoading(false);
    }
  };

  // Auto-submit PIN
  useEffect(() => {
    if (enteredPin.length >= 4 && enteredPin.length <= 6 && showVerifyModal) {
      const timer = setTimeout(() => {
        handleVerifyPinSubmit();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [enteredPin]);

  const handleSavePolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle || !formProvider) {
      toast.error('Title and Provider are required');
      return;
    }

    startTransition(async () => {
      try {
        const payload = {
          member_id: formMemberId || undefined,
          type: formType,
          name: formTitle,
          provider: formProvider,
          policy_number: formPolicyNumber || undefined,
          premium_amount: formPremiumAmount ? Number(formPremiumAmount) : undefined,
          premium_date: formPremiumDate || undefined,
          expiry_date: formExpiryDate || undefined,
          coverage: formCoverage || undefined,
          document_url: formDocUrl || undefined,
          notes: formNotes || undefined,
        };

        if (editingPolicyId) {
          await updatePolicy(editingPolicyId, payload);
          toast.success('Insurance policy updated successfully');
        } else {
          await createPolicy(payload);
          toast.success('Insurance policy stored securely');
        }

        setShowFormModal(false);
        resetForm();
        const items = await fetchPolicies();
        setPolicies(items);
      } catch (err: any) {
        toast.error(err.message || 'Failed to save policy');
      }
    });
  };

  const resetForm = () => {
    setEditingPolicyId(null);
    setFormTitle('');
    setFormType('lic');
    setFormProvider('');
    setFormPolicyNumber('');
    setFormPremiumAmount('');
    setFormPremiumDate('');
    setFormExpiryDate('');
    setFormCoverage('');
    setFormNotes('');
    setFormMemberId('');
    setFormDocUrl('');
  };

  const handleOpenEdit = async (policy: Policy) => {
    runWithPin(async () => {
      try {
        setLoading(true);
        const number = await revealPolicyNumber(policy.id);
        
        setEditingPolicyId(policy.id);
        setFormTitle(policy.name);
        setFormType(policy.type);
        setFormProvider(policy.provider);
        setFormPolicyNumber(number || '');
        setFormPremiumAmount(policy.premium_amount ? String(policy.premium_amount) : '');
        setFormPremiumDate(policy.premium_date || '');
        setFormExpiryDate(policy.expiry_date || '');
        setFormCoverage(policy.coverage || '');
        setFormNotes(policy.notes || '');
        setFormMemberId(policy.member_id || '');
        setFormDocUrl(policy.document_url || '');
        
        setShowFormModal(true);
      } catch (err: any) {
        toast.error(err.message || 'Failed to load policy credentials');
      } finally {
        setLoading(false);
      }
    });
  };

  const handleRevealNumber = async (policy: Policy) => {
    runWithPin(async () => {
      try {
        setLoading(true);
        const number = await revealPolicyNumber(policy.id);
        setDecryptedNumber(number || '');
        setViewedPolicy(policy);
      } catch (err: any) {
        toast.error(err.message || 'Failed to decrypt policy number');
      } finally {
        setLoading(false);
      }
    });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteId) return;
    try {
      await deletePolicy(deleteId);
      toast.success('Insurance policy deleted successfully');
      setDeleteId(null);
      setViewedPolicy(null);
      const items = await fetchPolicies();
      setPolicies(items);
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete policy');
    }
  };

  const copyNumber = (num: string) => {
    navigator.clipboard.writeText(num);
    toast.success('Policy number copied');
  };

  // Filters logic
  const filteredPolicies = policies.filter((pol) => {
    const matchesType = selectedType === 'all' || pol.type === selectedType;
    const matchesSearch =
      pol.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      pol.provider.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (pol.coverage && pol.coverage.toLowerCase().includes(searchQuery.toLowerCase()));
    
    return matchesType && matchesSearch;
  });

  return (
    <div className="px-4 md:px-8 py-6 space-y-6">
      
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span className="material-symbols-outlined text-[#4fdbc8] text-[28px]" style={{ fontVariationSettings: "'FILL' 1" }}>
              policy
            </span>
            <h1 className="text-headline-md font-bold text-[#dde4e1] tracking-tight">Policies &amp; Insurance</h1>
          </div>
          <p className="text-body-sm text-[#859490]">Track all life, health, vehicle, and property insurance renewals</p>
        </div>

        <button
          onClick={() => {
            resetForm();
            setShowFormModal(true);
          }}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-label-sm font-semibold transition-all bg-[#4fdbc8] text-[#003731] hover:bg-[#4fdbc8]/90 shadow-[0_4px_12px_rgba(79,219,200,0.2)]"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
          <span>Add Policy</span>
        </button>
      </div>

      {/* Grid: Categories and Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        
        {/* Categories filters */}
        <div className="lg:col-span-1 space-y-1.5">
          <div className="hidden lg:block pb-2 px-2 text-label-sm text-[#859490] font-semibold uppercase tracking-wider text-[10px]">
            Policy Category
          </div>
          
          <div className="flex lg:flex-col overflow-x-auto lg:overflow-x-visible pb-3 lg:pb-0 gap-1.5 scrollbar-none">
            {POLICY_TYPES.map((type) => {
              const isSelected = selectedType === type.id;
              return (
                <button
                  key={type.id}
                  onClick={() => setSelectedType(type.id)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-label-sm font-medium transition-all shrink-0 lg:shrink ${
                    isSelected
                      ? 'bg-[#4fdbc8]/10 text-[#4fdbc8] border border-[#4fdbc8]/20'
                      : 'bg-white/3 lg:bg-transparent text-[#bbcac6] hover:bg-white/5 border border-transparent'
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px]" style={{ color: type.color }}>
                    {type.icon}
                  </span>
                  <span>{type.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Content list */}
        <div className="lg:col-span-3 space-y-4">
          
          {/* Search bar */}
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-[#859490] text-[20px]">
              search
            </span>
            <input
              type="text"
              placeholder="Search by policy name, provider, or coverage..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 rounded-xl border border-white/8 bg-white/3 text-body-sm text-white focus:outline-none focus:border-[#4fdbc8] transition-all"
            />
          </div>

          {/* Cards Grid */}
          {filteredPolicies.length === 0 ? (
            <div className="glass-card rounded-2xl p-12 text-center border border-white/5">
              <span className="material-symbols-outlined text-[48px] text-[#859490] mb-3">gavel</span>
              <h3 className="text-body-lg font-semibold text-[#dde4e1]">No Policies Tracked</h3>
              <p className="text-body-sm text-[#859490] mt-1 max-w-sm mx-auto">
                No policy records fit your criteria. Add insurance policies to receive premium renewal reminders.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredPolicies.map((policy) => {
                const member = members.find((m) => m.id === policy.member_id);
                const typeInfo = POLICY_TYPES.find((t) => t.id === policy.type);

                // Renewal warning thresholds
                const daysLeft = policy.expiry_date ? daysUntil(policy.expiry_date) : 999;
                const isUrgent = daysLeft >= 0 && daysLeft <= 30;
                const isOverdue = daysLeft < 0;

                return (
                  <div
                    key={policy.id}
                    className="glass-card rounded-2xl p-5 border border-white/5 flex flex-col justify-between hover:border-white/12 transition-all"
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          {/* Type icon */}
                          <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/8 flex items-center justify-center shrink-0">
                            <span className="material-symbols-outlined text-[20px]" style={{ color: typeInfo?.color }}>
                              {typeInfo?.icon || 'shield'}
                            </span>
                          </div>
                          <div className="min-w-0">
                            <h3 className="text-body-sm font-semibold text-white truncate">{policy.name}</h3>
                            <p className="text-[10px] text-[#859490] font-mono capitalize">{policy.provider}</p>
                          </div>
                        </div>

                        {/* Member avatar */}
                        {member ? (
                          <div
                            className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[9px] font-bold border border-white/10 shrink-0"
                            style={{ background: getAvatarStyle(member.full_name) }}
                            title={`Insured: ${member.full_name}`}
                          >
                            {getInitials(member.full_name)}
                          </div>
                        ) : (
                          <span className="px-2 py-0.5 rounded bg-white/5 border border-white/8 text-[9px] text-[#859490] font-mono">
                            Family
                          </span>
                        )}
                      </div>

                      {/* Premium Details */}
                      <div className="p-3.5 rounded-xl bg-black/20 border border-white/3 text-body-sm space-y-2">
                        {policy.premium_amount && (
                          <div className="flex justify-between">
                            <span className="text-[#859490]">Premium Amount:</span>
                            <span className="font-semibold text-white">
                              ₹{policy.premium_amount.toLocaleString('en-IN')}
                            </span>
                          </div>
                        )}

                        {policy.expiry_date && (
                          <div className="flex justify-between items-center">
                            <span className="text-[#859490]">Renewal Due:</span>
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-white">{formatDate(policy.expiry_date)}</span>
                              {isOverdue ? (
                                <span className="text-[9px] text-[#ffb4ab] bg-red-950/40 border border-red-900/40 px-1.5 py-0.5 rounded font-mono uppercase font-bold">
                                  Overdue
                                </span>
                              ) : isUrgent ? (
                                <span className="text-[9px] text-[#ffb59e] bg-[#f38764]/10 border border-[#f38764]/30 px-1.5 py-0.5 rounded font-mono uppercase font-bold animate-pulse">
                                  {daysLeft}d left
                                </span>
                              ) : null}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="mt-5 pt-3 border-t border-white/5 flex items-center justify-between">
                      {/* Concealed policy number indicator */}
                      <span className="text-xs font-mono text-[#859490]">
                        {policy.has_policy_number ? '••••••••' : 'No number'}
                      </span>

                      {/* Actions */}
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleRevealNumber(policy)}
                          className="p-1.5 rounded-lg text-[#bbcac6] hover:bg-white/5 hover:text-[#4fdbc8] transition-colors"
                          title="View Policy Number"
                        >
                          <span className="material-symbols-outlined text-[18px]">visibility</span>
                        </button>
                        <button
                          onClick={() => handleOpenEdit(policy)}
                          className="p-1.5 rounded-lg text-[#bbcac6] hover:bg-white/5 hover:text-white transition-colors"
                          title="Edit"
                        >
                          <span className="material-symbols-outlined text-[18px]">edit</span>
                        </button>
                        <button
                          onClick={() => setDeleteId(policy.id)}
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

      {/* 4. NexusModal - Setup/Edit Form */}
      <NexusModal
        isOpen={showFormModal}
        onClose={() => setShowFormModal(false)}
        title={editingPolicyId ? 'Edit Secured Policy' : 'Add Policy Details'}
        description="Policy numbers are cryptographically encrypted. Vault unlock PIN is integrated."
        size="md"
      >
        <form onSubmit={handleSavePolicy} className="space-y-4 py-1">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-label-sm text-[#bbcac6]">Policy / Plan Name</label>
              <input
                type="text"
                required
                placeholder="e.g. Health Optima Plan"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-white/8 bg-[#0e1513] text-body-sm text-white focus:outline-none focus:border-[#4fdbc8]"
              />
            </div>
            
            <div className="space-y-1.5">
              <label className="text-label-sm text-[#bbcac6]">Category</label>
              <select
                value={formType}
                onChange={(e) => setFormType(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-white/8 bg-[#0e1513] text-body-sm text-white focus:outline-none focus:border-[#4fdbc8]"
              >
                {POLICY_TYPES.filter(c => c.id !== 'all').map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-label-sm text-[#bbcac6]">Provider Name</label>
              <input
                type="text"
                required
                placeholder="e.g. LIC or HDFC ERGO"
                value={formProvider}
                onChange={(e) => setFormProvider(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-white/8 bg-[#0e1513] text-body-sm text-white focus:outline-none focus:border-[#4fdbc8]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-label-sm text-[#bbcac6]">Policy Number</label>
              <input
                type="text"
                required
                placeholder="Enter policy number"
                value={formPolicyNumber}
                onChange={(e) => setFormPolicyNumber(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-white/8 bg-[#0e1513] text-body-sm text-white focus:outline-none focus:border-[#4fdbc8] font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-label-sm text-[#bbcac6]">Premium Amount (INR)</label>
              <input
                type="number"
                placeholder="e.g. 15000"
                value={formPremiumAmount}
                onChange={(e) => setFormPremiumAmount(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-white/8 bg-[#0e1513] text-body-sm text-white focus:outline-none focus:border-[#4fdbc8]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-label-sm text-[#bbcac6]">Insured Family Member</label>
              <select
                value={formMemberId}
                onChange={(e) => setFormMemberId(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-white/8 bg-[#0e1513] text-body-sm text-white focus:outline-none focus:border-[#4fdbc8]"
              >
                <option value="">Family Wide / Shared</option>
                {members.map((mem) => (
                  <option key={mem.id} value={mem.id}>
                    {mem.full_name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-label-sm text-[#bbcac6]">Premium Due Date</label>
              <input
                type="date"
                value={formPremiumDate}
                onChange={(e) => setFormPremiumDate(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-white/8 bg-[#0e1513] text-body-sm text-white focus:outline-none focus:border-[#4fdbc8]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-label-sm text-[#bbcac6]">Policy Expiry Date</label>
              <input
                type="date"
                value={formExpiryDate}
                onChange={(e) => setFormExpiryDate(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-white/8 bg-[#0e1513] text-body-sm text-white focus:outline-none focus:border-[#4fdbc8]"
              />
            </div>
          </div>

          {/* Document Attachment Selection */}
          <div className="space-y-1.5">
            <label className="text-label-sm text-[#bbcac6]">Linked Policy Document (Optional)</label>
            <select
              value={formDocUrl}
              onChange={(e) => setFormDocUrl(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-white/8 bg-[#0e1513] text-body-sm text-white focus:outline-none focus:border-[#4fdbc8]"
            >
              <option value="">No document attached</option>
              {policyDocs.map((doc) => (
                <option key={doc.id} value={doc.file_url}>
                  {doc.name} (Vault)
                </option>
              ))}
            </select>
            <p className="text-[10px] text-[#859490]">
              Attaches a copy of policy documentation pre-uploaded under &ldquo;Insurance&rdquo; in Vault.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-label-sm text-[#bbcac6]">Coverage Description / Notes</label>
            <textarea
              rows={3}
              placeholder="e.g. Cashless network clinics, Rs. 5 Lakh family floater coverage details..."
              value={formCoverage}
              onChange={(e) => setFormCoverage(e.target.value)}
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
                'Save Policy'
              )}
            </button>
          </div>
        </form>
      </NexusModal>

      {/* 5. NexusModal - Reveal Decrypted Policy Number */}
      <NexusModal
        isOpen={viewedPolicy !== null}
        onClose={() => setViewedPolicy(null)}
        title={viewedPolicy?.name || 'Insurance Policy'}
        description="Decrypted policy credentials decrypted on-demand from database."
        size="md"
      >
        {viewedPolicy && (
          <div className="space-y-4 py-1">
            
            {/* Decrypted Policy Number */}
            <div className="p-3.5 rounded-xl bg-white/3 border border-white/5 flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <span className="text-[10px] uppercase font-semibold text-[#859490] block mb-1">Policy Number</span>
                <span className="text-body-md font-mono font-bold text-[#4fdbc8] tracking-wide block truncate">
                  {decryptedNumber}
                </span>
              </div>
              <div className="flex gap-1.5 shrink-0">
                <button
                  onClick={() => copyNumber(decryptedNumber)}
                  className="p-2 rounded-lg bg-white/5 text-[#bbcac6] hover:text-[#4fdbc8] hover:bg-white/10"
                >
                  <span className="material-symbols-outlined text-[18px]">content_copy</span>
                </button>
              </div>
            </div>

            {/* General Policy Info */}
            <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-white/3 border border-white/5 text-body-sm text-[#bbcac6]">
              <div>
                <span className="text-[10px] text-[#859490] block">Provider</span>
                <span className="font-semibold text-white">{viewedPolicy.provider}</span>
              </div>
              {viewedPolicy.premium_amount && (
                <div>
                  <span className="text-[10px] text-[#859490] block">Premium</span>
                  <span className="font-semibold text-white">₹{viewedPolicy.premium_amount.toLocaleString('en-IN')}</span>
                </div>
              )}
              {viewedPolicy.premium_date && (
                <div>
                  <span className="text-[10px] text-[#859490] block">Premium Date</span>
                  <span className="font-semibold text-white">{formatDate(viewedPolicy.premium_date)}</span>
                </div>
              )}
              {viewedPolicy.expiry_date && (
                <div>
                  <span className="text-[10px] text-[#859490] block">Expiry / Renewal</span>
                  <span className="font-semibold text-white">{formatDate(viewedPolicy.expiry_date)}</span>
                </div>
              )}
            </div>

            {/* Document link */}
            {viewedPolicy.document_url && (
              <div className="p-3.5 rounded-xl bg-[#4fdbc8]/5 border border-[#4fdbc8]/15 flex items-center justify-between text-body-sm">
                <div>
                  <span className="text-[10px] text-[#859490] block">Attachment</span>
                  <span className="font-semibold text-white">Policy Documentation Copy</span>
                </div>
                <a
                  href={viewedPolicy.document_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 rounded-xl text-label-sm font-semibold bg-[#4fdbc8] text-[#003731] hover:bg-[#4fdbc8]/90 transition-all flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-[16px]">visibility</span>
                  View PDF
                </a>
              </div>
            )}

            {/* Coverage details */}
            {viewedPolicy.coverage && (
              <div className="space-y-1.5">
                <span className="text-[10px] uppercase font-semibold text-[#859490] tracking-wider block">Coverage Details &amp; Notes</span>
                <p className="text-body-sm text-[#bbcac6] whitespace-pre-line bg-black/20 p-4 rounded-xl leading-relaxed border border-white/3">
                  {viewedPolicy.coverage}
                </p>
              </div>
            )}

            {/* Footer buttons */}
            <div className="pt-4 border-t border-white/5 flex gap-2 justify-end">
              <button
                onClick={() => setDeleteId(viewedPolicy.id)}
                className="px-4 py-2.5 rounded-xl font-medium transition-all text-label-sm bg-red-950/20 border border-red-900/30 text-red-400 hover:bg-red-950/40"
              >
                Delete Policy
              </button>
              <button
                onClick={() => {
                  setViewedPolicy(null);
                  handleOpenEdit(viewedPolicy);
                }}
                className="px-4 py-2.5 rounded-xl font-semibold bg-white/5 border border-white/8 text-[#bbcac6] hover:bg-white/10 hover:text-white transition-all text-label-sm"
              >
                Edit Details
              </button>
              <button
                onClick={() => setViewedPolicy(null)}
                className="px-6 py-2.5 rounded-xl font-semibold bg-white/5 border border-white/8 text-white hover:bg-white/10 transition-all text-label-sm"
              >
                Close
              </button>
            </div>

          </div>
        )}
      </NexusModal>

      {/* 6. NexusModal - PIN Input modal */}
      <NexusModal
        isOpen={showVerifyModal}
        onClose={() => {
          setShowVerifyModal(false);
          setPinCallback(null);
        }}
        title="Verify Security PIN"
        description="Enter your 4 to 6 digit security PIN to reveal policy credentials."
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

      {/* 7. NexusConfirm - Delete policy */}
      <NexusConfirm
        isOpen={deleteId !== null}
        title="Delete Insurance Policy?"
        description="This will permanently delete this insurance policy from your family tracking list. This action cannot be undone."
        confirmText="Yes, Delete"
        cancelText="Cancel"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteId(null)}
        variant="danger"
      />

    </div>
  );
}
