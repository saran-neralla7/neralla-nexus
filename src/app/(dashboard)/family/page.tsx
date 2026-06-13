'use client';

import { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useUser } from '@/hooks/useUser';
import { toast } from 'sonner';
import { getInitials, formatDate } from '@/lib/utils';
import NexusModal from '@/components/nexus/NexusModal';
import NexusConfirm from '@/components/nexus/NexusConfirm';
import type { FamilyMember, Document, Policy, MedicalRecord, PasswordEntry } from '@/types';

// Avatars palette for initial circles
const AVATAR_COLORS = [
  'linear-gradient(135deg, #14b8a6, #0566d9)',
  'linear-gradient(135deg, #adc6ff, #0566d9)',
  'linear-gradient(135deg, #ffb59e, #f38764)',
  'linear-gradient(135deg, #a78bfa, #7c3aed)',
  'linear-gradient(135deg, #f43f5e, #be123c)',
  'linear-gradient(135deg, #22c55e, #15803d)',
];

function getAvatarStyle(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % AVATAR_COLORS.length;
  return AVATAR_COLORS[index];
}

export default function FamilyPage() {
  const { user } = useUser();
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  // Selected member details
  const [selectedMember, setSelectedMember] = useState<FamilyMember | null>(null);
  const [activeTab, setActiveTab] = useState<'info' | 'docs' | 'policies' | 'medical' | 'passwords'>('info');

  // Related data states
  const [docs, setDocs] = useState<Document[]>([]);
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [medicals, setMedicals] = useState<MedicalRecord[]>([]);
  const [passwords, setPasswords] = useState<PasswordEntry[]>([]);
  const [relatedLoading, setRelatedLoading] = useState(false);

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [memberToEdit, setMemberToEdit] = useState<FamilyMember | null>(null);
  const [memberToDelete, setMemberToDelete] = useState<FamilyMember | null>(null);

  // Form states
  const [fullName, setFullName] = useState('');
  const [relationship, setRelationship] = useState('Spouse');
  const [dob, setDob] = useState('');
  const [bloodGroup, setBloodGroup] = useState('O+');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [bio, setBio] = useState('');

  const fetchMembers = async () => {
    if (!user?.family_id) return;
    try {
      setLoading(true);
      const supabase = createClient();
      const { data, error } = await supabase
        .from('family_members')
        .select('*')
        .eq('family_id', user.family_id)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMembers(data || []);
    } catch (err: any) {
      toast.error('Failed to load family members');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchRelatedData = async (memberId: string) => {
    try {
      setRelatedLoading(true);
      const supabase = createClient();
      const [docsRes, policiesRes, medicalsRes, pwRes] = await Promise.all([
        supabase.from('documents').select('*').eq('member_id', memberId).is('deleted_at', null),
        supabase.from('policies').select('*').eq('member_id', memberId),
        supabase.from('medical_records').select('*').eq('member_id', memberId),
        supabase.from('passwords').select('*').eq('member_id', memberId).is('deleted_at', null),
      ]);

      setDocs(docsRes.data || []);
      setPolicies(policiesRes.data || []);
      setMedicals(medicalsRes.data || []);
      setPasswords(pwRes.data || []);
    } catch (err) {
      console.error('Failed to load related profile vault items', err);
    } finally {
      setRelatedLoading(false);
    }
  };

  useEffect(() => {
    if (user?.family_id) {
      fetchMembers();
    }
  }, [user?.family_id]);

  useEffect(() => {
    if (selectedMember) {
      fetchRelatedData(selectedMember.id);
    }
  }, [selectedMember]);

  const resetForm = () => {
    setFullName('');
    setRelationship('Spouse');
    setDob('');
    setBloodGroup('O+');
    setPhone('');
    setEmail('');
    setAddress('');
    setBio('');
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName) {
      toast.error('Full name is required');
      return;
    }

    startTransition(async () => {
      try {
        const supabase = createClient();
        const { error } = await supabase.from('family_members').insert({
          family_id: user?.family_id,
          full_name: fullName,
          relationship,
          date_of_birth: dob || null,
          blood_group: bloodGroup || null,
          phone: phone || null,
          email: email || null,
          address: address || null,
          bio: bio || null,
        });

        if (error) throw error;
        toast.success(`${fullName} added to family!`);
        setShowAddModal(false);
        resetForm();
        fetchMembers();
      } catch (err: any) {
        toast.error(err.message || 'Failed to add member');
      }
    });
  };

  const handleEditMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!memberToEdit) return;

    startTransition(async () => {
      try {
        const supabase = createClient();
        const { error } = await supabase
          .from('family_members')
          .update({
            full_name: fullName,
            relationship,
            date_of_birth: dob || null,
            blood_group: bloodGroup || null,
            phone: phone || null,
            email: email || null,
            address: address || null,
            bio: bio || null,
          })
          .eq('id', memberToEdit.id);

        if (error) throw error;
        toast.success('Profile updated successfully');
        setShowEditModal(false);
        setMemberToEdit(null);
        resetForm();
        fetchMembers();

        // Refresh selected member if currently viewing
        if (selectedMember && selectedMember.id === memberToEdit.id) {
          const { data } = await supabase
            .from('family_members')
            .select('*')
            .eq('id', memberToEdit.id)
            .single();
          if (data) setSelectedMember(data);
        }
      } catch (err: any) {
        toast.error(err.message || 'Failed to update member');
      }
    });
  };

  const handleDeleteMember = async () => {
    if (!memberToDelete) return;

    startTransition(async () => {
      try {
        const supabase = createClient();
        const { error } = await supabase
          .from('family_members')
          .delete()
          .eq('id', memberToDelete.id);

        if (error) throw error;
        toast.success(`${memberToDelete.full_name}'s profile removed.`);
        setShowDeleteConfirm(false);
        setMemberToDelete(null);
        if (selectedMember && selectedMember.id === memberToDelete.id) {
          setSelectedMember(null);
        }
        fetchMembers();
      } catch (err: any) {
        toast.error(err.message || 'Failed to delete member');
      }
    });
  };

  const openEditModal = (member: FamilyMember) => {
    setMemberToEdit(member);
    setFullName(member.full_name);
    setRelationship(member.relationship || 'Spouse');
    setDob(member.date_of_birth || '');
    setBloodGroup(member.blood_group || 'O+');
    setPhone(member.phone || '');
    setEmail(member.email || '');
    setAddress(member.address || '');
    setBio(member.bio || '');
    setShowEditModal(true);
  };

  const openDeleteConfirm = (member: FamilyMember, e: React.MouseEvent) => {
    e.stopPropagation();
    setMemberToDelete(member);
    setShowDeleteConfirm(true);
  };

  // Calculate age from date of birth
  const calculateAge = (dobString?: string) => {
    if (!dobString) return null;
    const today = new Date();
    const birthDate = new Date(dobString);
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  return (
    <div className="px-4 md:px-8 py-6 space-y-6">
      {/* Detail Mode */}
      {selectedMember ? (
        <div className="space-y-6">
          {/* Header Action bar */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => setSelectedMember(null)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-body-sm font-semibold transition-all hover:bg-white/5 active:scale-95"
              style={{
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.06)',
                color: '#4fdbc8',
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>arrow_back</span>
              Back to Family
            </button>
            {(user?.role === 'owner' || user?.role === 'admin') && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => openEditModal(selectedMember)}
                  className="p-2.5 rounded-xl hover:bg-white/5 transition-colors"
                  style={{ color: '#adc6ff' }}
                  title="Edit Profile"
                >
                  <span className="material-symbols-outlined">edit</span>
                </button>
                <button
                  onClick={(e) => openDeleteConfirm(selectedMember, e)}
                  className="p-2.5 rounded-xl hover:bg-white/5 transition-colors"
                  style={{ color: '#ffb4ab' }}
                  title="Remove Profile"
                >
                  <span className="material-symbols-outlined">delete</span>
                </button>
              </div>
            )}
          </div>

          {/* Member Card Profile Cover */}
          <div className="glass-card rounded-[32px] overflow-hidden relative border border-white/5">
            {/* Cover Banner */}
            <div
              className="h-32 md:h-44 w-full relative"
              style={{
                background: selectedMember.cover_url || 'linear-gradient(135deg, rgba(20,184,166,0.1) 0%, rgba(5,102,217,0.1) 100%)',
              }}
            >
              <div className="absolute inset-0 bg-gradient-to-t from-[#0e1513] to-transparent opacity-90" />
            </div>

            {/* Profile Avatar and Name */}
            <div className="relative px-6 md:px-8 pb-6 flex flex-col md:flex-row md:items-end gap-5 -mt-12 md:-mt-16 z-10">
              <div
                className="w-24 h-24 md:w-32 md:h-32 rounded-3xl flex items-center justify-center text-white text-3xl md:text-4xl font-extrabold shadow-xl border-4 border-[#0e1513] relative overflow-hidden"
                style={{ background: getAvatarStyle(selectedMember.full_name) }}
              >
                {getInitials(selectedMember.full_name)}
              </div>
              <div className="flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-3">
                  <h1
                    style={{
                      fontFamily: 'Geist, sans-serif',
                      fontSize: '32px',
                      fontWeight: '700',
                      color: '#dde4e1',
                      letterSpacing: '-0.02em',
                    }}
                  >
                    {selectedMember.full_name}
                  </h1>
                  <span
                    className="px-3 py-1 rounded-full text-label-sm uppercase tracking-wider text-xs"
                    style={{
                      background: 'rgba(79, 219, 200, 0.1)',
                      color: '#4fdbc8',
                      border: '1px solid rgba(79, 219, 200, 0.2)',
                    }}
                  >
                    {selectedMember.relationship}
                  </span>
                </div>
                {selectedMember.bio && (
                  <p className="text-body-sm text-[#859490] max-w-xl">{selectedMember.bio}</p>
                )}
              </div>
            </div>

            {/* Tab Links */}
            <div className="border-t border-white/5 px-4 md:px-8 py-1 flex overflow-x-auto gap-2">
              {[
                { id: 'info', label: 'Personal Details', icon: 'badge' },
                { id: 'docs', label: 'Documents', icon: 'description', count: docs.length },
                { id: 'policies', label: 'Insurance', icon: 'policy', count: policies.length },
                { id: 'medical', label: 'Medical Records', icon: 'medical_services', count: medicals.length },
                { id: 'passwords', label: 'Passwords', icon: 'lock', count: passwords.length },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className="flex items-center gap-2 px-4 py-3 rounded-xl text-body-sm font-semibold transition-all relative border border-transparent"
                  style={{
                    color: activeTab === tab.id ? '#4fdbc8' : '#bbcac6',
                  }}
                >
                  <span className="material-symbols-outlined text-[18px]">{tab.icon}</span>
                  <span>{tab.label}</span>
                  {tab.count !== undefined && tab.count > 0 && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/5 text-[#859490]">
                      {tab.count}
                    </span>
                  )}
                  {activeTab === tab.id && (
                    <div
                      className="absolute bottom-0 left-4 right-4 h-0.5 rounded-full"
                      style={{ backgroundColor: '#4fdbc8' }}
                    />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Tab Content Panels */}
          <div className="space-y-6">
            {activeTab === 'info' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Left Side fields */}
                <div className="glass-card rounded-3xl p-6 md:col-span-2 space-y-6 border border-white/5">
                  <h3 className="text-headline-sm font-semibold text-[#dde4e1]">Bio Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-1">
                      <p className="text-label-sm uppercase text-[#859490]">Birth Date</p>
                      <p className="text-body-md text-[#dde4e1]">
                        {selectedMember.date_of_birth ? formatDate(selectedMember.date_of_birth) : 'Not specified'}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-label-sm uppercase text-[#859490]">Age</p>
                      <p className="text-body-md text-[#dde4e1]">
                        {selectedMember.date_of_birth ? `${calculateAge(selectedMember.date_of_birth)} years old` : 'Not specified'}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-label-sm uppercase text-[#859490]">Blood Group</p>
                      <p className="text-body-md text-[#dde4e1] font-semibold text-[#ffb4ab]">
                        {selectedMember.blood_group || 'Not specified'}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-label-sm uppercase text-[#859490]">Email Address</p>
                      <p className="text-body-md text-[#dde4e1]">{selectedMember.email || 'Not specified'}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-label-sm uppercase text-[#859490]">Contact Phone</p>
                      <p className="text-body-md text-[#dde4e1]">{selectedMember.phone || 'Not specified'}</p>
                    </div>
                  </div>
                  {selectedMember.address && (
                    <div className="pt-4 border-t border-white/5 space-y-1">
                      <p className="text-label-sm uppercase text-[#859490]">Address</p>
                      <p className="text-body-sm text-[#dde4e1]">{selectedMember.address}</p>
                    </div>
                  )}
                </div>

                {/* Right Side summary */}
                <div className="glass-card rounded-3xl p-6 space-y-6 border border-white/5 h-fit">
                  <h3 className="text-headline-sm font-semibold text-[#dde4e1]">Security Details</h3>
                  <ul className="space-y-4">
                    <li className="flex items-center justify-between text-body-sm">
                      <span className="text-[#859490]">System Account</span>
                      <span className={selectedMember.user_id ? 'text-[#4fdbc8]' : 'text-[#859490]'}>
                        {selectedMember.user_id ? 'Linked' : 'Local Only'}
                      </span>
                    </li>
                    <li className="flex items-center justify-between text-body-sm">
                      <span className="text-[#859490]">Passwords in Vault</span>
                      <span className="text-[#dde4e1] font-semibold">{passwords.length}</span>
                    </li>
                    <li className="flex items-center justify-between text-body-sm">
                      <span className="text-[#859490]">Documents Vaulted</span>
                      <span className="text-[#dde4e1] font-semibold">{docs.length}</span>
                    </li>
                    <li className="flex items-center justify-between text-body-sm">
                      <span className="text-[#859490]">Medical Histories</span>
                      <span className="text-[#dde4e1] font-semibold">{medicals.length}</span>
                    </li>
                  </ul>
                </div>
              </div>
            )}

            {activeTab === 'docs' && (
              <div className="glass-card rounded-3xl p-6 border border-white/5">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-headline-sm font-semibold text-[#dde4e1]">Documents Vault</h3>
                  <Link
                    href={`/vault/documents?memberId=${selectedMember.id}`}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-label-sm font-semibold transition-all hover:opacity-80"
                    style={{ background: 'rgba(79, 219, 200, 0.1)', color: '#4fdbc8' }}
                  >
                    <span className="material-symbols-outlined text-[16px]">upload_file</span>
                    Upload Document
                  </Link>
                </div>

                {relatedLoading ? (
                  <div className="text-center py-12">
                    <span className="material-symbols-outlined animate-spin text-[32px] text-[#4fdbc8]">progress_activity</span>
                  </div>
                ) : docs.length === 0 ? (
                  <div className="text-center py-12 space-y-3">
                    <span className="material-symbols-outlined text-[48px] text-[#3c4947]">description</span>
                    <p className="text-body-sm text-[#859490]">No vaulted documents found for this profile.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {docs.map((doc) => (
                      <div
                        key={doc.id}
                        className="flex items-center justify-between p-4 rounded-2xl"
                        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-[#4fdbc8]/10 flex items-center justify-center text-[#4fdbc8]">
                            <span className="material-symbols-outlined">description</span>
                          </div>
                          <div>
                            <p className="text-body-sm font-semibold text-[#dde4e1]">{doc.name}</p>
                            <p className="text-label-sm uppercase text-xs" style={{ color: '#859490' }}>
                              {doc.category}
                            </p>
                          </div>
                        </div>
                        <a
                          href={doc.file_url}
                          target="_blank"
                          rel="noreferrer"
                          className="p-2 rounded-xl hover:bg-white/5 transition-colors text-[#4fdbc8]"
                        >
                          <span className="material-symbols-outlined">download</span>
                        </a>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'policies' && (
              <div className="glass-card rounded-3xl p-6 border border-white/5">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-headline-sm font-semibold text-[#dde4e1]">Insurance & Protection Policies</h3>
                  <Link
                    href={`/policies?memberId=${selectedMember.id}`}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-label-sm font-semibold transition-all hover:opacity-80"
                    style={{ background: 'rgba(79, 219, 200, 0.1)', color: '#4fdbc8' }}
                  >
                    <span className="material-symbols-outlined text-[16px]">add_circle</span>
                    Add Policy
                  </Link>
                </div>

                {relatedLoading ? (
                  <div className="text-center py-12">
                    <span className="material-symbols-outlined animate-spin text-[32px] text-[#4fdbc8]">progress_activity</span>
                  </div>
                ) : policies.length === 0 ? (
                  <div className="text-center py-12 space-y-3">
                    <span className="material-symbols-outlined text-[48px] text-[#3c4947]">policy</span>
                    <p className="text-body-sm text-[#859490]">No active insurance policies linked to this profile.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {policies.map((policy) => (
                      <div
                        key={policy.id}
                        className="flex items-center justify-between p-4 rounded-2xl"
                        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-[#adc6ff]/10 flex items-center justify-center text-[#adc6ff]">
                            <span className="material-symbols-outlined">policy</span>
                          </div>
                          <div>
                            <p className="text-body-sm font-semibold text-[#dde4e1]">{policy.name}</p>
                            <p className="text-label-sm text-[#859490]">{policy.provider}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          {policy.expiry_date && (
                            <p className="text-label-sm text-[#ffb4ab]">Expires {formatDate(policy.expiry_date)}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'medical' && (
              <div className="glass-card rounded-3xl p-6 border border-white/5">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-headline-sm font-semibold text-[#dde4e1]">Medical & Clinical Records</h3>
                  <Link
                    href={`/medical?memberId=${selectedMember.id}`}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-label-sm font-semibold transition-all hover:opacity-80"
                    style={{ background: 'rgba(79, 219, 200, 0.1)', color: '#4fdbc8' }}
                  >
                    <span className="material-symbols-outlined text-[16px]">add_circle</span>
                    Add Medical Record
                  </Link>
                </div>

                {relatedLoading ? (
                  <div className="text-center py-12">
                    <span className="material-symbols-outlined animate-spin text-[32px] text-[#4fdbc8]">progress_activity</span>
                  </div>
                ) : medicals.length === 0 ? (
                  <div className="text-center py-12 space-y-3">
                    <span className="material-symbols-outlined text-[48px] text-[#3c4947]">medical_services</span>
                    <p className="text-body-sm text-[#859490]">No medical files or health logs found.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {medicals.map((record) => (
                      <div
                        key={record.id}
                        className="p-4 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4"
                        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}
                      >
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 rounded-xl bg-[#ffb59e]/10 flex items-center justify-center text-[#ffb59e] flex-shrink-0">
                            <span className="material-symbols-outlined">clinical_trials</span>
                          </div>
                          <div>
                            <p className="text-body-sm font-semibold text-[#dde4e1]">{record.title}</p>
                            <p className="text-label-sm text-[#859490]">{record.hospital || record.doctor}</p>
                            {record.notes && <p className="text-body-sm mt-1 text-[#859490]">{record.notes}</p>}
                          </div>
                        </div>
                        <div className="flex items-center justify-between md:justify-end gap-6 border-t md:border-t-0 pt-2 md:pt-0 border-white/5">
                          <span className="text-label-sm text-[#859490]">{record.date ? formatDate(record.date) : ''}</span>
                          {record.file_url && (
                            <a
                              href={record.file_url}
                              target="_blank"
                              rel="noreferrer"
                              className="p-2 rounded-xl bg-white/5 hover:bg-[#4fdbc8]/15 transition-all text-[#4fdbc8] flex items-center justify-center"
                            >
                              <span className="material-symbols-outlined">visibility</span>
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'passwords' && (
              <div className="glass-card rounded-3xl p-6 border border-white/5">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-headline-sm font-semibold text-[#dde4e1]">Password Vault Credentials</h3>
                  <Link
                    href={`/vault/passwords?memberId=${selectedMember.id}`}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-label-sm font-semibold transition-all hover:opacity-80"
                    style={{ background: 'rgba(79, 219, 200, 0.1)', color: '#4fdbc8' }}
                  >
                    <span className="material-symbols-outlined text-[16px]">lock_open</span>
                    Create Entry
                  </Link>
                </div>

                {relatedLoading ? (
                  <div className="text-center py-12">
                    <span className="material-symbols-outlined animate-spin text-[32px] text-[#4fdbc8]">progress_activity</span>
                  </div>
                ) : passwords.length === 0 ? (
                  <div className="text-center py-12 space-y-3">
                    <span className="material-symbols-outlined text-[48px] text-[#3c4947]">lock</span>
                    <p className="text-body-sm text-[#859490]">No accounts stored in the password vault.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {passwords.map((pw) => (
                      <div
                        key={pw.id}
                        className="p-4 rounded-2xl flex items-center justify-between"
                        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-[#4fdbc8]/10 flex items-center justify-center text-[#4fdbc8]">
                            <span className="material-symbols-outlined">vpn_key</span>
                          </div>
                          <div>
                            <p className="text-body-sm font-semibold text-[#dde4e1]">{pw.title}</p>
                            <p className="text-label-sm text-[#859490]">{pw.username || 'No username'}</p>
                          </div>
                        </div>
                        <Link
                          href="/vault/passwords"
                          className="p-2 rounded-xl hover:bg-white/5 transition-colors text-[#4fdbc8]"
                        >
                          <span className="material-symbols-outlined">chevron_right</span>
                        </Link>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Grid List Mode */
        <div className="space-y-6">
          {/* Top Headline + Actions */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span
                  className="material-symbols-outlined"
                  style={{ color: '#4fdbc8', fontSize: '28px', fontVariationSettings: "'FILL' 1" }}
                >
                  family_restroom
                </span>
                <h1
                  style={{
                    fontFamily: 'Geist, sans-serif',
                    fontSize: '32px',
                    fontWeight: '700',
                    color: '#dde4e1',
                    letterSpacing: '-0.02em',
                  }}
                >
                  Family Profiles
                </h1>
              </div>
              <p className="text-body-md" style={{ color: '#859490' }}>
                Manage personal information, directories, and vaults for your family members
              </p>
            </div>
            {(user?.role === 'owner' || user?.role === 'admin') && (
              <button
                onClick={() => {
                  resetForm();
                  setShowAddModal(true);
                }}
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl font-semibold transition-all active:scale-[0.98]"
                style={{
                  background: 'linear-gradient(135deg, #14b8a6, #0566d9)',
                  color: 'white',
                  boxShadow: '0 8px 32px rgba(20,184,166,0.25)',
                }}
              >
                <span className="material-symbols-outlined text-[20px]">person_add</span>
                Add Member
              </button>
            )}
          </div>

          {/* Members Grid */}
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((n) => (
                <div key={n} className="glass-card rounded-[28px] p-6 h-60 animate-pulse border border-white/5 space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-white/5" />
                    <div className="space-y-2 flex-1">
                      <div className="h-5 bg-white/5 rounded-full w-2/3" />
                      <div className="h-4 bg-white/5 rounded-full w-1/3" />
                    </div>
                  </div>
                  <div className="h-px bg-white/5 my-4" />
                  <div className="space-y-2">
                    <div className="h-4 bg-white/5 rounded-full w-4/5" />
                    <div className="h-4 bg-white/5 rounded-full w-3/5" />
                  </div>
                </div>
              ))}
            </div>
          ) : members.length === 0 ? (
            <div className="glass-card rounded-[32px] p-12 text-center border border-white/5 space-y-6">
              <div
                className="w-20 h-20 rounded-3xl flex items-center justify-center mx-auto"
                style={{ background: 'rgba(79, 219, 200, 0.08)', border: '1px solid rgba(79, 219, 200, 0.15)' }}
              >
                <span className="material-symbols-outlined text-[36px]" style={{ color: '#4fdbc8' }}>
                  family_restroom
                </span>
              </div>
              <div className="max-w-md mx-auto space-y-2">
                <h3 className="text-headline-sm font-semibold text-[#dde4e1]">Family Registry Empty</h3>
                <p className="text-body-sm" style={{ color: '#859490' }}>
                  Add your family members to begin consolidating documents, policies, and keys in their vaults.
                </p>
              </div>
              {(user?.role === 'owner' || user?.role === 'admin') && (
                <button
                  onClick={() => setShowAddModal(true)}
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-xl font-semibold transition-opacity"
                  style={{ background: 'rgba(79,219,200,0.1)', color: '#4fdbc8', border: '1px solid rgba(79,219,200,0.2)' }}
                >
                  <span className="material-symbols-outlined text-[20px]">person_add</span>
                  Create First Profile
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {members.map((member) => (
                <div
                  key={member.id}
                  onClick={() => {
                    setSelectedMember(member);
                    setActiveTab('info');
                  }}
                  className="glass-card rounded-[28px] p-6 border border-white/5 hover:border-[#4fdbc8]/30 hover:shadow-[0_20px_60px_rgba(20,184,166,0.06)] cursor-pointer transition-all duration-300 relative group flex flex-col justify-between h-64"
                >
                  <div className="space-y-4">
                    {/* Header: Avatar, Name, Relationship */}
                    <div className="flex items-center gap-4">
                      <div
                        className="w-16 h-16 rounded-2xl flex items-center justify-center text-white text-xl font-bold flex-shrink-0"
                        style={{ background: getAvatarStyle(member.full_name) }}
                      >
                        {getInitials(member.full_name)}
                      </div>
                      <div className="min-w-0">
                        <h3
                          className="font-semibold truncate text-[#dde4e1] group-hover:text-[#4fdbc8] transition-colors"
                          style={{ fontFamily: 'Geist, sans-serif', fontSize: '18px' }}
                        >
                          {member.full_name}
                        </h3>
                        <span
                          className="inline-block mt-0.5 px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider"
                          style={{
                            background: 'rgba(255, 255, 255, 0.05)',
                            border: '1px solid rgba(255, 255, 255, 0.05)',
                            color: '#bbcac6',
                          }}
                        >
                          {member.relationship}
                        </span>
                      </div>
                    </div>

                    <div className="h-px bg-white/5" />

                    {/* Member Details */}
                    <div className="space-y-2 text-body-sm" style={{ color: '#859490' }}>
                      {member.date_of_birth && (
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-[16px]">cake</span>
                          <span>
                            {formatDate(member.date_of_birth)} ({calculateAge(member.date_of_birth)} yrs)
                          </span>
                        </div>
                      )}
                      {member.blood_group && (
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-[16px] text-[#ffb4ab]">bloodtype</span>
                          <span>Blood Group: <strong className="text-[#ffb4ab]">{member.blood_group}</strong></span>
                        </div>
                      )}
                      {member.phone && (
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-[16px]">call</span>
                          <span className="truncate">{member.phone}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions overlay */}
                  <div className="flex items-center justify-between mt-4">
                    <span className="text-label-sm text-[#4fdbc8] opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                      View Profile
                      <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                    </span>
                    {(user?.role === 'owner' || user?.role === 'admin') && (
                      <div className="flex items-center gap-2 ml-auto">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditModal(member);
                          }}
                          className="p-2 rounded-lg hover:bg-white/5 transition-colors text-[#adc6ff]"
                          title="Edit Profile"
                        >
                          <span className="material-symbols-outlined text-[18px]">edit</span>
                        </button>
                        <button
                          onClick={(e) => openDeleteConfirm(member, e)}
                          className="p-2 rounded-lg hover:bg-white/5 transition-colors text-[#ffb4ab]"
                          title="Remove Profile"
                        >
                          <span className="material-symbols-outlined text-[18px]">delete</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ================= MODALS ================= */}

      {/* Add Member Modal */}
      <NexusModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Add Family Profile"
        description="Create a profile to consolidate directories, documents, and policies for a family member."
      >
        <form onSubmit={handleAddMember} className="space-y-4">
          <div className="space-y-2">
            <label className="text-label-sm uppercase text-[#859490]">Full Name</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Arjun Neralla"
              className="input-glass w-full px-4 py-3 rounded-xl text-body-sm text-[#dde4e1]"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-label-sm uppercase text-[#859490]">Relationship</label>
              <select
                value={relationship}
                onChange={(e) => setRelationship(e.target.value)}
                className="input-glass w-full px-4 py-3 rounded-xl text-body-sm text-[#dde4e1] bg-[#1a211f]"
              >
                {['Self', 'Spouse', 'Child', 'Parent', 'Sibling', 'Grandparent', 'Other'].map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-label-sm uppercase text-[#859490]">Blood Group</label>
              <select
                value={bloodGroup}
                onChange={(e) => setBloodGroup(e.target.value)}
                className="input-glass w-full px-4 py-3 rounded-xl text-body-sm text-[#dde4e1] bg-[#1a211f]"
              >
                {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-label-sm uppercase text-[#859490]">Date of Birth</label>
              <input
                type="date"
                value={dob}
                onChange={(e) => setDob(e.target.value)}
                className="input-glass w-full px-4 py-3 rounded-xl text-body-sm text-[#dde4e1]"
              />
            </div>
            <div className="space-y-2">
              <label className="text-label-sm uppercase text-[#859490]">Phone Number</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 XXXXX XXXXX"
                className="input-glass w-full px-4 py-3 rounded-xl text-body-sm text-[#dde4e1]"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-label-sm uppercase text-[#859490]">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. arjun@neralla.family"
              className="input-glass w-full px-4 py-3 rounded-xl text-body-sm text-[#dde4e1]"
            />
          </div>

          <div className="space-y-2">
            <label className="text-label-sm uppercase text-[#859490]">Address</label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Primary residential address"
              className="input-glass w-full px-4 py-3 rounded-xl text-body-sm text-[#dde4e1]"
            />
          </div>

          <div className="space-y-2">
            <label className="text-label-sm uppercase text-[#859490]">Bio / Notes</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Allergic detail, job, or critical info..."
              rows={3}
              className="input-glass w-full px-4 py-3 rounded-xl text-body-sm text-[#dde4e1] resize-none"
            />
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="w-full py-4 rounded-2xl flex items-center justify-center gap-2 font-semibold transition-all active:scale-[0.98] disabled:opacity-60 mt-4"
            style={{
              background: 'linear-gradient(135deg, #14b8a6, #0566d9)',
              color: 'white',
              boxShadow: '0 8px 32px rgba(20,184,166,0.3)',
            }}
          >
            {isPending ? (
              <>
                <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
                Creating Profile...
              </>
            ) : (
              'Save Profile'
            )}
          </button>
        </form>
      </NexusModal>

      {/* Edit Member Modal */}
      <NexusModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        title="Edit Family Profile"
        description="Update personal directories, profiles, and parameters for this family member."
      >
        <form onSubmit={handleEditMember} className="space-y-4">
          <div className="space-y-2">
            <label className="text-label-sm uppercase text-[#859490]">Full Name</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="input-glass w-full px-4 py-3 rounded-xl text-body-sm text-[#dde4e1]"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-label-sm uppercase text-[#859490]">Relationship</label>
              <select
                value={relationship}
                onChange={(e) => setRelationship(e.target.value)}
                className="input-glass w-full px-4 py-3 rounded-xl text-body-sm text-[#dde4e1] bg-[#1a211f]"
              >
                {['Self', 'Spouse', 'Child', 'Parent', 'Sibling', 'Grandparent', 'Other'].map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-label-sm uppercase text-[#859490]">Blood Group</label>
              <select
                value={bloodGroup}
                onChange={(e) => setBloodGroup(e.target.value)}
                className="input-glass w-full px-4 py-3 rounded-xl text-body-sm text-[#dde4e1] bg-[#1a211f]"
              >
                {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-label-sm uppercase text-[#859490]">Date of Birth</label>
              <input
                type="date"
                value={dob}
                onChange={(e) => setDob(e.target.value)}
                className="input-glass w-full px-4 py-3 rounded-xl text-body-sm text-[#dde4e1]"
              />
            </div>
            <div className="space-y-2">
              <label className="text-label-sm uppercase text-[#859490]">Phone Number</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="input-glass w-full px-4 py-3 rounded-xl text-body-sm text-[#dde4e1]"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-label-sm uppercase text-[#859490]">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input-glass w-full px-4 py-3 rounded-xl text-body-sm text-[#dde4e1]"
            />
          </div>

          <div className="space-y-2">
            <label className="text-label-sm uppercase text-[#859490]">Address</label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="input-glass w-full px-4 py-3 rounded-xl text-body-sm text-[#dde4e1]"
            />
          </div>

          <div className="space-y-2">
            <label className="text-label-sm uppercase text-[#859490]">Bio / Notes</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={3}
              className="input-glass w-full px-4 py-3 rounded-xl text-body-sm text-[#dde4e1] resize-none"
            />
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="w-full py-4 rounded-2xl flex items-center justify-center gap-2 font-semibold transition-all active:scale-[0.98] disabled:opacity-60 mt-4"
            style={{
              background: 'linear-gradient(135deg, #14b8a6, #0566d9)',
              color: 'white',
              boxShadow: '0 8px 32px rgba(20,184,166,0.3)',
            }}
          >
            {isPending ? (
              <>
                <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
                Updating Profile...
              </>
            ) : (
              'Save Changes'
            )}
          </button>
        </form>
      </NexusModal>

      {/* Delete Member Confirmation */}
      <NexusConfirm
        isOpen={showDeleteConfirm}
        title="Remove Family Member?"
        description={`Are you sure you want to remove ${memberToDelete?.full_name}'s profile? All associated vaults and histories linked to this profile will remain but won't be visible under their profile.`}
        confirmText="Remove"
        cancelText="Keep"
        onConfirm={handleDeleteMember}
        onCancel={() => {
          setShowDeleteConfirm(false);
          setMemberToDelete(null);
        }}
        variant="danger"
        loading={isPending}
      />
    </div>
  );
}
