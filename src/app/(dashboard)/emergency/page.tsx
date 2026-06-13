'use client';

import { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useUser } from '@/hooks/useUser';
import { toast } from 'sonner';
import { formatDate } from '@/lib/utils';
import NexusModal from '@/components/nexus/NexusModal';
import NexusConfirm from '@/components/nexus/NexusConfirm';
import type { FamilyMember, Document, TrustedContact } from '@/types';
import { fetchEmergencyData, triggerSOSEmailAlert } from './actions';

export default function EmergencyHubPage() {
  const { user } = useUser();
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  // Data State
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [contacts, setContacts] = useState<TrustedContact[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);

  // Modal States
  const [showSOSModal, setShowSOSModal] = useState(false);
  const [showMedicalIdModal, setShowMedicalIdModal] = useState(false);
  const [showInstructionModal, setShowInstructionModal] = useState<string | null>(null);
  const [showPINModal, setShowPINModal] = useState<Document | null>(null);
  const [showFreezeModal, setShowFreezeModal] = useState(false);

  // Form PIN State
  const [pinInput, setPinInput] = useState('');
  const [sosTriggered, setSosTriggered] = useState(false);
  const [frozenCards, setFrozenCards] = useState(false);

  const loadData = async () => {
    if (!user?.family_id) return;
    try {
      setLoading(true);
      const data = await fetchEmergencyData();
      setMembers(data.members || []);
      setContacts(data.contacts || []);
      setDocuments(data.documents || []);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load emergency operational data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user]);

  // SOS Trigger Action
  const handleTriggerSOS = () => {
    startTransition(async () => {
      try {
        const res = await triggerSOSEmailAlert();
        setSosTriggered(true);
        toast.success(`🚨 SOS Alert broadcasted to ${res.notifiedCount} family members!`);
      } catch (err: any) {
        toast.error(err.message || 'Failed to trigger SOS');
      }
    });
  };

  // PIN check for sensitive document view
  const handleDocClick = (doc: Document) => {
    if (doc.is_sensitive) {
      setPinInput('');
      setShowPINModal(doc);
    } else {
      window.open(doc.file_url, '_blank');
    }
  };

  const handleVerifyPIN = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showPINModal) return;

    try {
      const supabase = createClient();
      const { data: verified, error } = await supabase.rpc('verify_user_pin', {
        input_pin: pinInput,
      });

      if (error) throw error;

      if (verified) {
        toast.success('Access granted');
        window.open(showPINModal.file_url, '_blank');
        setShowPINModal(null);
      } else {
        toast.error('Invalid PIN code');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to verify PIN');
    }
  };

  // Card Freeze Trigger
  const handleFreezeConfirm = async () => {
    startTransition(async () => {
      try {
        const supabase = createClient();
        await supabase.from('audit_logs').insert({
          family_id: user?.family_id,
          user_id: user?.id,
          action: 'freeze_credit_cards',
          resource_type: 'emergency',
          metadata: { status: 'requested_freeze_all' },
        });

        setFrozenCards(true);
        setShowFreezeModal(false);
        toast.success('🔒 Credit cards freeze request logged and dispatched to family managers!');
      } catch (err: any) {
        toast.error(err.message || 'Failed to process freeze');
      }
    });
  };

  const getAge = (dobString?: string) => {
    if (!dobString) return 'N/A';
    const today = new Date();
    const dob = new Date(dobString);
    let age = today.getFullYear() - dob.getFullYear();
    const m = today.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
      age--;
    }
    return `${age} yrs`;
  };

  // Print function
  const handlePrintMedicalID = () => {
    window.print();
  };

  return (
    <div className="px-4 md:px-8 py-6 space-y-8 print:p-0 print:bg-white print:text-black">
      {/* Header (Hidden on print) */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 print:hidden">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span
              className="material-symbols-outlined text-[30px]"
              style={{ color: '#ffb4ab', fontVariationSettings: "'FILL' 1" }}
            >
              sos
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
              Emergency Operations
            </h1>
          </div>
          <p className="text-body-md" style={{ color: '#859490' }}>
            High-priority command dashboard containing critical medical records and SOS access.
          </p>
        </div>
      </div>

      {/* SOS Operation Console (Hidden on print) */}
      <section className="relative overflow-hidden rounded-3xl p-8 glass-card border border-red-500/20 urgent-glow print:hidden">
        <div className="absolute top-0 right-0 p-8 opacity-5">
          <span className="material-symbols-outlined text-[120px] text-red-500">emergency</span>
        </div>

        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="text-center md:text-left space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-[#ffb4ab]">
              <span className="material-symbols-outlined text-[16px]">emergency_home</span>
              <span className="text-label-sm font-bold">EMERGENCY OPERATIONS CENTER</span>
            </div>
            <h2 className="text-display-lg-mobile md:text-headline-lg font-bold text-[#dde4e1]">
              SOS Emergency Triggers
            </h2>
            <p className="text-body-md max-w-xl" style={{ color: '#bbcac6' }}>
              Press the SOS Call button to immediately launch emergency hotlines and alert the household. Open Medical ID for medical first responders.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
            <button
              onClick={() => setShowSOSModal(true)}
              className="flex-1 md:flex-initial py-4 px-8 rounded-xl font-bold bg-[#93000a] text-white flex items-center justify-center gap-3 hover:brightness-110 active:scale-95 transition-all shadow-[0_0_30px_rgba(239,68,68,0.4)]"
            >
              <span className="material-symbols-outlined text-[28px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                sos
              </span>
              <span className="text-headline-sm">SOS CALL</span>
            </button>

            <button
              onClick={() => setShowMedicalIdModal(true)}
              className="flex-1 md:flex-initial py-4 px-8 rounded-xl font-bold bg-white/10 hover:bg-white/15 border border-white/20 text-[#dde4e1] flex items-center justify-center gap-3 active:scale-95 transition-all"
            >
              <span className="material-symbols-outlined text-[26px]">contact_emergency</span>
              <span className="text-headline-sm">MEDICAL ID</span>
            </button>
          </div>
        </div>
      </section>

      {/* Printable Area (Visible only on print or inside modal) */}
      <div className="hidden print:block space-y-6">
        <div className="text-center border-b pb-4">
          <h1 className="text-3xl font-bold">NERALLA NEXUS — FAMILY MEDICAL ID CARDS</h1>
          <p className="text-sm text-gray-600">Generated on {new Date().toLocaleDateString('en-IN')}</p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {members.map((m) => (
            <div key={m.id} className="border p-4 rounded-xl space-y-3">
              <h2 className="text-xl font-bold">{m.full_name} ({m.relationship || 'Member'})</h2>
              <div className="grid grid-cols-2 text-sm gap-2">
                <div><strong>DOB:</strong> {m.date_of_birth ? new Date(m.date_of_birth).toLocaleDateString() : 'N/A'}</div>
                <div><strong>Age:</strong> {getAge(m.date_of_birth)}</div>
                <div><strong>Blood Group:</strong> <span className="text-red-600 font-bold text-lg">{m.blood_group || 'Unknown'}</span></div>
                <div><strong>Phone:</strong> {m.phone || 'N/A'}</div>
              </div>
              <div className="text-sm">
                <strong>Allergies / Chronic Conditions:</strong>
                <p className="text-gray-700">{m.bio || 'None reported'}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main Grid content (Hidden on print) */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 print:hidden">
        {/* Left Column: Family Vital Records */}
        <div className="xl:col-span-2 space-y-8">
          {/* Section: Family Vital Records */}
          <section className="space-y-4">
            <h3
              className="text-headline-sm font-semibold flex items-center gap-3 text-[#dde4e1]"
              style={{ fontFamily: 'Geist, sans-serif' }}
            >
              <span className="material-symbols-outlined text-[#4fdbc8] text-[28px]">family_restroom</span>
              Family Vital Records
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {loading ? (
                <div className="col-span-full py-8 text-center text-[#859490]">
                  Loading family profiles...
                </div>
              ) : members.length === 0 ? (
                <div className="col-span-full py-8 text-center text-[#859490] border border-white/5 rounded-2xl bg-white/[0.01]">
                  No family members defined. Go to Family Tree or onboarding to add them.
                </div>
              ) : (
                members.map((m) => (
                  <div
                    key={m.id}
                    className="glass-card rounded-2xl p-5 flex flex-col justify-between gap-4 border-l-4"
                    style={{
                      borderLeftColor:
                        m.relationship === 'spouse'
                          ? '#ffb59e'
                          : m.relationship === 'child'
                          ? '#adc6ff'
                          : '#4fdbc8',
                    }}
                  >
                    <div className="flex items-center gap-4">
                      {m.avatar_url ? (
                        <img
                          src={m.avatar_url}
                          alt={m.full_name}
                          className="w-14 h-14 rounded-full border-2 border-white/10 object-cover"
                        />
                      ) : (
                        <div className="w-14 h-14 rounded-full bg-white/5 border border-white/10 flex items-center justify-center font-bold text-headline-sm text-[#4fdbc8]">
                          {m.full_name[0]}
                        </div>
                      )}
                      <div>
                        <h4
                          className="text-headline-sm font-semibold text-[#dde4e1]"
                          style={{ fontFamily: 'Geist, sans-serif', fontSize: '18px' }}
                        >
                          {m.full_name}
                        </h4>
                        <p className="text-label-sm uppercase text-[#859490] mt-0.5">
                          {m.relationship || 'Family Member'}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 py-3 border-y border-white/5">
                      <div>
                        <p className="text-[10px] uppercase text-[#859490] tracking-wider">Blood Group</p>
                        <p className="font-bold text-[#ffb4ab] text-xl mt-0.5">{m.blood_group || 'Unknown'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase text-[#859490] tracking-wider">Chronic & Allergies</p>
                        <p className="font-medium text-[#dde4e1] text-xs mt-0.5 line-clamp-2" title={m.bio || 'None'}>
                          {m.bio || 'None reported'}
                        </p>
                      </div>
                    </div>

                    {m.phone ? (
                      <a
                        href={`tel:${m.phone}`}
                        className="w-full py-2.5 bg-[#1a211f] hover:bg-white/5 border border-white/10 rounded-xl font-bold flex items-center justify-center gap-2 text-[#bbcac6] hover:text-[#4fdbc8] transition-all"
                      >
                        <span className="material-symbols-outlined text-[16px]">call</span>
                        Call {m.full_name.split(' ')[0]}
                      </a>
                    ) : (
                      <button
                        disabled
                        className="w-full py-2.5 bg-white/[0.01] border border-white/5 rounded-xl font-medium flex items-center justify-center gap-2 text-[#859490] cursor-not-allowed"
                      >
                        No Phone Configured
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </section>

          {/* Section: Emergency Contacts */}
          <section className="space-y-4">
            <h3
              className="text-headline-sm font-semibold flex items-center gap-3 text-[#dde4e1]"
              style={{ fontFamily: 'Geist, sans-serif' }}
            >
              <span className="material-symbols-outlined text-[#adc6ff] text-[28px]">perm_contact_calendar</span>
              Priority Emergency Contacts
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {loading ? (
                <div className="col-span-full py-8 text-center text-[#859490]">
                  Loading contacts...
                </div>
              ) : contacts.length === 0 ? (
                <div className="col-span-full py-8 text-center text-[#859490] border border-white/5 rounded-2xl bg-white/[0.01]">
                  No emergency contacts defined. Go to Trusted Contacts and toggle "is emergency".
                </div>
              ) : (
                contacts.map((c) => (
                  <div key={c.id} className="glass-card rounded-2xl p-4 flex flex-col justify-between gap-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <span
                          className="material-symbols-outlined text-[28px] mb-1.5 block"
                          style={{
                            color:
                              c.category === 'doctor'
                                ? '#4fdbc8'
                                : c.category === 'insurance_agent'
                                ? '#ffb59e'
                                : '#ffb4ab',
                          }}
                        >
                          {c.category === 'doctor'
                            ? 'medical_services'
                            : c.category === 'insurance_agent'
                            ? 'verified_user'
                            : 'emergency'}
                        </span>
                        <h4 className="font-bold text-md text-[#dde4e1]">{c.name}</h4>
                        <p className="text-xs text-[#859490] mt-0.5">{c.company || c.category}</p>
                      </div>
                      <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-red-500/10 text-[#ffb4ab] border border-red-500/20">
                        EMERGENCY
                      </span>
                    </div>

                    <div className="flex gap-2 pt-2">
                      {c.phone && (
                        <a
                          href={`tel:${c.phone}`}
                          className="flex-1 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl flex items-center justify-center gap-1.5 text-xs text-[#bbcac6] font-bold transition-all"
                        >
                          <span className="material-symbols-outlined text-[14px]">call</span>
                          Call
                        </a>
                      )}
                      {c.email && (
                        <a
                          href={`mailto:${c.email}`}
                          className="flex-1 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl flex items-center justify-center gap-1.5 text-xs text-[#bbcac6] font-bold transition-all"
                        >
                          <span className="material-symbols-outlined text-[14px]">mail</span>
                          Email
                        </a>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

        {/* Right Column: Emergency Vault & Financial Security */}
        <div className="space-y-8">
          {/* Emergency Vault */}
          <section className="space-y-4">
            <h3
              className="text-headline-sm font-semibold flex items-center gap-3 text-[#dde4e1]"
              style={{ fontFamily: 'Geist, sans-serif' }}
            >
              <span className="material-symbols-outlined text-[#ffb59e] text-[28px]">lock</span>
              Emergency Vault
            </h3>

            <div className="vault-texture glass-card rounded-2xl p-5 border border-white/10 space-y-3.5">
              <p className="text-xs text-[#859490] leading-relaxed">
                Quick-access vault copies of vital documents. Sensitive records require PIN unlock code.
              </p>

              {loading ? (
                <div className="py-6 text-center text-[#859490]">Loading documents...</div>
              ) : documents.length === 0 ? (
                <div className="py-6 text-center text-[#859490] text-xs">
                  No emergency documents found. Tag documents with "emergency" or add medical/insurance documents in the Vault.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {documents.slice(0, 5).map((doc) => (
                    <div
                      key={doc.id}
                      onClick={() => handleDocClick(doc)}
                      className="p-3 bg-white/5 hover:bg-white/[0.08] border border-white/5 rounded-xl flex items-center justify-between cursor-pointer transition-all gap-3"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="material-symbols-outlined text-[#4fdbc8] text-[22px]">
                          {doc.is_sensitive ? 'encrypted' : 'description'}
                        </span>
                        <div className="min-w-0">
                          <p className="font-semibold text-xs text-[#dde4e1] truncate">{doc.name}</p>
                          <p className="text-[10px] text-[#859490] mt-0.5 capitalize">{doc.category}</p>
                        </div>
                      </div>
                      <span className="material-symbols-outlined text-[#859490] text-[18px]">download</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* Financial Security */}
          <section className="space-y-4">
            <h3
              className="text-headline-sm font-semibold flex items-center gap-3 text-[#dde4e1]"
              style={{ fontFamily: 'Geist, sans-serif' }}
            >
              <span className="material-symbols-outlined text-[#ffb4ab] text-[28px]">account_balance_wallet</span>
              Financial Security
            </h3>

            <div className="space-y-3">
              <div className="glass-card rounded-2xl p-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center text-[#ffb4ab] flex-shrink-0">
                    <span className="material-symbols-outlined text-[20px]">credit_card_off</span>
                  </div>
                  <div className="min-w-0">
                    <h5 className="font-bold text-xs text-[#dde4e1]">Freeze Accounts</h5>
                    <p className="text-[10px] text-[#859490] mt-0.5 truncate">Emergency freeze action trigger</p>
                  </div>
                </div>

                <button
                  onClick={() => setShowFreezeModal(true)}
                  disabled={frozenCards}
                  className={`px-3 py-2 text-xs font-bold rounded-lg transition-all ${
                    frozenCards ? 'bg-[#1a211f] text-[#859490] border border-white/5' : 'bg-[#93000a] text-white hover:bg-red-700'
                  }`}
                >
                  {frozenCards ? 'FROZEN' : 'FREEZE'}
                </button>
              </div>

              <div className="glass-card rounded-2xl p-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-[#14b8a6]/10 flex items-center justify-center text-[#4fdbc8] flex-shrink-0">
                    <span className="material-symbols-outlined text-[20px]">contact_support</span>
                  </div>
                  <div className="min-w-0">
                    <h5 className="font-bold text-xs text-[#dde4e1]">VIP Banking Hotline</h5>
                    <p className="text-[10px] text-[#859490] mt-0.5 truncate">Relationship Support Team</p>
                  </div>
                </div>

                <a
                  href="tel:18005550199"
                  className="p-2.5 bg-white/5 hover:bg-white/10 rounded-full text-[#bbcac6] hover:text-[#4fdbc8] border border-white/5 transition-all"
                >
                  <span className="material-symbols-outlined text-[16px]">call</span>
                </a>
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* Section: Rapid Instructions (Hidden on print) */}
      <section className="space-y-4 print:hidden">
        <h3
          className="text-headline-sm font-semibold flex items-center gap-3 text-[#dde4e1]"
          style={{ fontFamily: 'Geist, sans-serif' }}
        >
          <span className="material-symbols-outlined text-[#ffb4ab] text-[28px]">quick_reference_all</span>
          Rapid Action Protocols
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div
            onClick={() => setShowInstructionModal('first-aid')}
            className="glass-card rounded-2xl p-6 flex flex-col gap-3 cursor-pointer hover:border-red-500/30 group transition-all"
          >
            <div className="w-14 h-14 rounded-2xl bg-red-500/10 flex items-center justify-center text-[#ffb4ab] mb-1 group-hover:scale-105 transition-transform">
              <span className="material-symbols-outlined text-[36px]">medical_services</span>
            </div>
            <h4 className="font-semibold text-headline-sm text-[#dde4e1]">First Aid Instructions</h4>
            <p className="text-body-sm text-[#859490] leading-relaxed">
              Step-by-step guidelines for CPR, Choking, Severe Bleeding, and Shock.
            </p>
            <span className="text-[#4fdbc8] font-bold text-xs flex items-center gap-1.5 mt-2">
              Launch Protocol
              <span className="material-symbols-outlined text-[14px] group-hover:translate-x-1 transition-transform">
                arrow_forward
              </span>
            </span>
          </div>

          <div
            onClick={() => setShowInstructionModal('fire')}
            className="glass-card rounded-2xl p-6 flex flex-col gap-3 cursor-pointer hover:border-orange-500/30 group transition-all"
          >
            <div className="w-14 h-14 rounded-2xl bg-orange-500/10 flex items-center justify-center text-[#ffb59e] mb-1 group-hover:scale-105 transition-transform">
              <span className="material-symbols-outlined text-[36px]">local_fire_department</span>
            </div>
            <h4 className="font-semibold text-headline-sm text-[#dde4e1]">Fire & Safety Exit Plan</h4>
            <p className="text-body-sm text-[#859490] leading-relaxed">
              Escape route guidelines, Assembly point locations, and security checklist.
            </p>
            <span className="text-[#4fdbc8] font-bold text-xs flex items-center gap-1.5 mt-2">
              View Exit Plans
              <span className="material-symbols-outlined text-[14px] group-hover:translate-x-1 transition-transform">
                arrow_forward
              </span>
            </span>
          </div>

          <div
            onClick={() => setShowInstructionModal('shutdown')}
            className="glass-card rounded-2xl p-6 flex flex-col gap-3 cursor-pointer hover:border-blue-500/30 group transition-all"
          >
            <div className="w-14 h-14 rounded-2xl bg-blue-500/10 flex items-center justify-center text-[#adc6ff] mb-1 group-hover:scale-105 transition-transform">
              <span className="material-symbols-outlined text-[36px]">power_off</span>
            </div>
            <h4 className="font-semibold text-headline-sm text-[#dde4e1]">Home Emergency Shutdown</h4>
            <p className="text-body-sm text-[#859490] leading-relaxed">
              Locations of water main, gas shut-off valves, and electrical breakers.
            </p>
            <span className="text-[#4fdbc8] font-bold text-xs flex items-center gap-1.5 mt-2">
              Shutdown Console
              <span className="material-symbols-outlined text-[14px] group-hover:translate-x-1 transition-transform">
                arrow_forward
              </span>
            </span>
          </div>
        </div>
      </section>

      {/* SOS DIAL MODAL */}
      <NexusModal isOpen={showSOSModal} onClose={() => setShowSOSModal(false)} title="🚨 SOS Operations Control">
        <div className="space-y-6">
          <div className="text-center p-5 rounded-2xl bg-red-500/5 border border-red-500/20 space-y-3">
            <span
              className="material-symbols-outlined text-[48px] text-red-500 animate-pulse"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              sos
            </span>
            <h4 className="text-headline-sm font-bold text-white">Trigger Emergency Broadcast</h4>
            <p className="text-xs text-[#bbcac6] max-w-sm mx-auto leading-relaxed">
              Clicking trigger will send immediate system and email alerts to all registered family members.
            </p>

            <button
              onClick={handleTriggerSOS}
              disabled={sosTriggered || isPending}
              className={`py-3 px-6 rounded-xl font-bold w-full max-w-xs mx-auto flex items-center justify-center gap-2 transition-all shadow-lg ${
                sosTriggered
                  ? 'bg-[#1a211f] text-[#ffb4ab] border border-red-500/20'
                  : 'bg-red-600 hover:bg-red-700 text-white animate-bounce'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">notifications</span>
              {sosTriggered ? 'SOS BROADCAST SENT' : 'TRIGGER EMERGENCY SOS'}
            </button>
          </div>

          <div className="space-y-3">
            <h5 className="text-xs font-bold uppercase tracking-wider text-[#859490]">Critical Public Services</h5>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'National SOS', num: '112', icon: 'emergency' },
                { label: 'Ambulance', num: '102', icon: 'medical_services' },
                { label: 'Fire Dept', num: '101', icon: 'local_fire_department' },
                { label: 'Police', num: '100', icon: 'shield' },
              ].map((serv) => (
                <a
                  key={serv.num}
                  href={`tel:${serv.num}`}
                  className="p-3 bg-white/5 hover:bg-white/10 rounded-xl border border-white/5 flex items-center gap-3 transition-colors"
                >
                  <span className="material-symbols-outlined text-[#ffb4ab]">{serv.icon}</span>
                  <div>
                    <p className="text-xs font-bold text-white">{serv.label}</p>
                    <p className="text-[10px] text-[#859490] mt-0.5">Dial {serv.num}</p>
                  </div>
                </a>
              ))}
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <h5 className="text-xs font-bold uppercase tracking-wider text-[#859490]">Family Contacts</h5>
            <div className="space-y-2">
              {members.map((m) => (
                <div key={m.id} className="p-3 bg-white/5 rounded-xl border border-white/5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-2 h-2 rounded-full bg-[#4fdbc8]" />
                    <span className="text-xs font-semibold text-white">{m.full_name}</span>
                  </div>
                  {m.phone ? (
                    <a
                      href={`tel:${m.phone}`}
                      className="px-3.5 py-1.5 rounded-lg bg-[#14b8a6]/10 text-[#4fdbc8] border border-[#14b8a6]/20 text-xs font-bold hover:bg-[#14b8a6]/20 transition-all flex items-center gap-1.5"
                    >
                      <span className="material-symbols-outlined text-[14px]">call</span>
                      Call
                    </a>
                  ) : (
                    <span className="text-[10px] text-[#859490]">No Phone</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </NexusModal>

      {/* MEDICAL ID MODAL */}
      <NexusModal
        isOpen={showMedicalIdModal}
        onClose={() => setShowMedicalIdModal(false)}
        title="Family Medical ID Cards"
        size="lg"
      >
        <div className="space-y-6">
          <div className="flex justify-between items-center pb-3 border-b border-white/5">
            <p className="text-xs text-[#859490]">Verify and print medical credentials for healthcare professionals</p>
            <button
              onClick={handlePrintMedicalID}
              className="py-1.5 px-3 bg-[#14b8a6]/10 hover:bg-[#14b8a6]/20 border border-[#14b8a6]/20 rounded-lg text-xs font-bold text-[#4fdbc8] flex items-center gap-1.5 transition-colors"
            >
              <span className="material-symbols-outlined text-[14px]">print</span>
              Print All IDs
            </button>
          </div>

          <div className="space-y-5 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
            {members.map((m) => (
              <div
                key={m.id}
                className="p-5 rounded-2xl bg-white/[0.03] border border-white/10 space-y-3.5"
              >
                <div className="flex justify-between items-center">
                  <h4 className="font-bold text-md text-white">
                    {m.full_name} <span className="text-[#859490] text-xs font-normal">({m.relationship})</span>
                  </h4>
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-red-500/10 text-[#ffb4ab] border border-red-500/20">
                    Blood Group: {m.blood_group || 'Unknown'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-[#859490] block">Date of Birth</span>
                    <span className="font-semibold text-white">
                      {m.date_of_birth ? new Date(m.date_of_birth).toLocaleDateString('en-IN') : 'N/A'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#859490] block">Age</span>
                    <span className="font-semibold text-white">{getAge(m.date_of_birth)}</span>
                  </div>
                </div>

                <div className="space-y-1.5 pt-1.5 border-t border-white/5 text-xs">
                  <span className="text-[#859490] block uppercase tracking-wider font-bold">Chronic Conditions & Allergies</span>
                  <p className="text-[#bbcac6] leading-relaxed bg-[#090f0e]/50 p-3 rounded-xl border border-white/5">
                    {m.bio || 'None reported'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </NexusModal>

      {/* RAPID PROTOCOL INSTRUCTION MODALS */}
      <NexusModal
        isOpen={showInstructionModal !== null}
        onClose={() => setShowInstructionModal(null)}
        title={
          showInstructionModal === 'first-aid'
            ? 'First Aid Reference Protocols'
            : showInstructionModal === 'fire'
            ? 'Fire Escape & Safety Protocols'
            : 'Home Shutdown Protocol'
        }
        size="md"
      >
        <div className="space-y-5">
          {showInstructionModal === 'first-aid' && (
            <div className="space-y-4 text-body-sm text-[#bbcac6]">
              <div className="space-y-2">
                <h5 className="font-bold text-[#ffb4ab] border-b border-white/5 pb-1">1. CPR Procedure (Cardiopulmonary Resuscitation)</h5>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Ensure the area is safe for you and the victim.</li>
                  <li>Check for responsiveness. Tap shoulder and shout "Are you okay?".</li>
                  <li>Call emergency services (102 / 112) immediately.</li>
                  <li>Deliver 30 chest compressions (2 inches deep, rate of 100-120 per minute) in the center of the chest.</li>
                  <li>Give 2 rescue breaths (tilt head back, pinch nose, blow into mouth).</li>
                  <li>Repeat cycles of 30 compressions and 2 breaths until help arrives.</li>
                </ul>
              </div>

              <div className="space-y-2">
                <h5 className="font-bold text-[#ffb4ab] border-b border-white/5 pb-1">2. Heimlich Maneuver (Choking Relief)</h5>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Ask the person: "Are you choking? Can you speak?".</li>
                  <li>Stand behind them, wrap your arms around their waist.</li>
                  <li>Make a fist with one hand and place it just above the navel.</li>
                  <li>Grasp fist with the other hand and press into the abdomen with a quick upward thrust.</li>
                  <li>Repeat thrusts until the object is expelled.</li>
                </ul>
              </div>

              <div className="space-y-2">
                <h5 className="font-bold text-[#ffb4ab] border-b border-white/5 pb-1">3. Severe Bleeding Control</h5>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Apply direct pressure to the wound using a clean cloth or bandage.</li>
                  <li>Maintain firm pressure. If blood leaks through, add another cloth, do not remove the first.</li>
                  <li>Elevate the injured limb above heart level if possible.</li>
                  <li>If bleeding doesn't stop, apply a tourniquet above the wound if trained.</li>
                </ul>
              </div>
            </div>
          )}

          {showInstructionModal === 'fire' && (
            <div className="space-y-4 text-body-sm text-[#bbcac6]">
              <div className="space-y-2">
                <h5 className="font-bold text-[#ffb59e] border-b border-white/5 pb-1">Exit Routes & Assembly Point</h5>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Primary Exit Route: Main entrance door, proceeding down to front gate lawn.</li>
                  <li>Secondary Exit Route: Back kitchen door, proceeding to backyard patio area.</li>
                  <li><strong>Family Assembly Point:</strong> Main street electrical post (60 meters clear of the building boundary).</li>
                </ul>
              </div>

              <div className="space-y-2">
                <h5 className="font-bold text-[#ffb59e] border-b border-white/5 pb-1">Fire Response Checklist</h5>
                <ol className="list-decimal pl-5 space-y-1">
                  <li>Alert all occupants. Scream "FIRE!" repeatedly.</li>
                  <li>Evacuate immediately. Do not stop to pick up personal belongings.</li>
                  <li>Crawl low under smoke to stay below toxic gases.</li>
                  <li>Test doors with back of hand before opening. If hot, do not open.</li>
                  <li>Once out, call Fire Dept (101) and stay at the assembly point.</li>
                </ol>
              </div>

              <div className="space-y-2">
                <h5 className="font-bold text-[#ffb59e] border-b border-white/5 pb-1">Extinguisher Locations</h5>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Kitchen: Under-sink cabinet shelf (Type B/C Co2 extinguisher).</li>
                  <li>Main Staircase Hall: First-floor landing column (Type A/B/C Dry Powder).</li>
                </ul>
              </div>
            </div>
          )}

          {showInstructionModal === 'shutdown' && (
            <div className="space-y-4 text-body-sm text-[#bbcac6]">
              <div className="space-y-2">
                <h5 className="font-bold text-[#adc6ff] border-b border-white/5 pb-1">1. Water Mains Shut-Off</h5>
                <p>
                  <strong>Location:</strong> Behind the utility storage cabinet on the ground floor wash-area porch.
                </p>
                <p className="mt-1">
                  <em>Action:</em> Turn the blue wheel valve clockwise until tightly shut to stop all inbound municipal supply.
                </p>
              </div>

              <div className="space-y-2">
                <h5 className="font-bold text-[#adc6ff] border-b border-white/5 pb-1">2. Gas Pipeline Control</h5>
                <p>
                  <strong>Location:</strong> Directly under the kitchen stove counter slab, near the red regulator node.
                </p>
                <p className="mt-1">
                  <em>Action:</em> Rotate the red dial toggle perpendicular to the pipe direction to isolate gas supply.
                </p>
              </div>

              <div className="space-y-2">
                <h5 className="font-bold text-[#adc6ff] border-b border-white/5 pb-1">3. Main Electrical Breakers</h5>
                <p>
                  <strong>Location:</strong> Main distribution board located in the ground floor garage corridor.
                </p>
                <p className="mt-1">
                  <em>Action:</em> Pull the main black 63A double-pole switch down to immediately disconnect all power grids in the residence.
                </p>
              </div>
            </div>
          )}

          <button
            onClick={() => setShowInstructionModal(null)}
            className="w-full py-3 bg-[#1a211f] border border-white/10 text-[#bbcac6] rounded-xl font-medium"
          >
            Close Protocol Window
          </button>
        </div>
      </NexusModal>

      {/* SENSITIVE VAULT DOCUMENT DECRYPTION PIN MODAL */}
      <NexusModal
        isOpen={showPINModal !== null}
        onClose={() => setShowPINModal(null)}
        title="Verification Required"
        description="Enter your security PIN to view this sensitive emergency document"
      >
        <form onSubmit={handleVerifyPIN} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-label-sm text-[#bbcac6]">Vault Security PIN</label>
            <input
              type="password"
              required
              maxLength={6}
              placeholder="••••••"
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ''))}
              className="w-full px-4 py-3 rounded-xl border border-white/10 bg-transparent text-[#dde4e1] text-center text-xl placeholder:text-[#859490]/50 focus:border-[#4fdbc8] focus:outline-none tracking-widest"
            />
          </div>

          <div className="flex items-center gap-3 pt-3">
            <button
              type="button"
              onClick={() => setShowPINModal(null)}
              className="flex-1 py-3 rounded-xl font-medium border border-white/10 text-[#bbcac6] hover:bg-white/5 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-3 bg-gradient-to-br from-[#14b8a6] to-[#0566d9] text-white font-semibold rounded-xl hover:brightness-110 transition-all shadow-lg"
            >
              Unlock Document
            </button>
          </div>
        </form>
      </NexusModal>

      {/* CARD FREEZE CONFIRMATION */}
      <NexusConfirm
        isOpen={showFreezeModal}
        title="Confirm Emergency Account Freeze"
        description="This will instantly flag all credit cards in the Nexus records as locked and log the freeze request. Proceed with freeze operation?"
        confirmText="Yes, Freeze Cards"
        cancelText="Cancel"
        onConfirm={handleFreezeConfirm}
        onCancel={() => setShowFreezeModal(false)}
        variant="danger"
        loading={isPending}
      />
    </div>
  );
}
