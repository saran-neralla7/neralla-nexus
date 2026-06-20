'use client';

import { useEffect, useState, useTransition } from 'react';
import { useUser } from '@/hooks/useUser';
import { toast } from 'sonner';
import { getInitials, getAvatarStyle } from '@/lib/utils';
import NexusModal from '@/components/nexus/NexusModal';
import NexusConfirm from '@/components/nexus/NexusConfirm';
import { fetchFamilyMembersForExpenses } from '../finance/actions';
import {
  fetchReminders,
  createReminder,
  updateReminder,
  deleteReminder,
} from './actions';
import {
  fetchMedicationReminders,
  createMedicationReminder,
  updateMedicationReminder,
  deleteMedicationReminder,
} from '../medical/actions';

export default function RemindersPage() {
  const { user } = useUser();
  const [activeTab, setActiveTab] = useState<'general' | 'medication'>('general');
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  // Family Members
  const [members, setMembers] = useState<any[]>([]);

  // Filters
  const [selectedGenMemberFilter, setSelectedGenMemberFilter] = useState('all');
  const [selectedMedMemberFilter, setSelectedMedMemberFilter] = useState('all');

  // Reminders States
  const [reminders, setReminders] = useState<any[]>([]);
  const [medications, setMedications] = useState<any[]>([]);

  // Modals
  const [showGeneralModal, setShowGeneralModal] = useState(false);
  const [showMedModal, setShowMedModal] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{ id: string; type: 'general' | 'medication' } | null>(null);

  // General Reminder Form State
  const [genId, setGenId] = useState<string | null>(null);
  const [genTitle, setGenTitle] = useState('');
  const [genDesc, setGenDesc] = useState('');
  const [genTime, setGenTime] = useState('08:00');
  const [genFreq, setGenFreq] = useState('daily');
  const [genDays, setGenDays] = useState<number[]>([1, 2, 3, 4, 5, 6, 0]);
  const [genAssignedTo, setGenAssignedTo] = useState('');

  // Medication Reminder Form State
  const [medId, setMedId] = useState<string | null>(null);
  const [medName, setMedName] = useState('');
  const [medDosage, setMedDosage] = useState('');
  const [medTime, setMedTime] = useState('08:00');
  const [medMemberId, setMedMemberId] = useState('');
  const [medFreq, setMedFreq] = useState('daily');
  const [medDays, setMedDays] = useState<number[]>([1, 2, 3, 4, 5, 6, 0]);

  // Load initial members and medication reminders
  useEffect(() => {
    if (user) {
      loadMembersAndMeds();
    }
  }, [user]);

  // Load reminders when filter changes
  useEffect(() => {
    if (user) {
      loadGeneralReminders();
    }
  }, [user, selectedGenMemberFilter]);

  const loadMembersAndMeds = async () => {
    try {
      setLoading(true);
      const membersData = await fetchFamilyMembersForExpenses();
      setMembers(membersData || []);

      if (membersData && membersData.length > 0) {
        setMedMemberId(membersData[0].id);
        setGenAssignedTo(user?.id || membersData[0].id);
      }

      const medData = await fetchMedicationReminders();
      setMedications(medData);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load member/medication details');
    } finally {
      setLoading(false);
    }
  };

  const loadGeneralReminders = async () => {
    try {
      const generalData = await fetchReminders(selectedGenMemberFilter);
      setReminders(generalData);
    } catch (err: any) {
      toast.error(err.message || 'Failed to fetch reminders');
    }
  };

  const loadAllData = async () => {
    await loadMembersAndMeds();
    await loadGeneralReminders();
  };

  // General Reminders Handlers
  const handleSaveGeneral = (e: React.FormEvent) => {
    e.preventDefault();
    if (!genTitle.trim()) {
      toast.error('Title is required');
      return;
    }

    startTransition(async () => {
      try {
        const payload = {
          title: genTitle,
          description: genDesc,
          scheduled_time: genTime + ':00',
          frequency: genFreq,
          days_of_week: genFreq === 'weekly' ? genDays : undefined,
          assigned_to: genAssignedTo,
        };

        if (genId) {
          await updateReminder(genId, payload);
          toast.success('Reminder updated');
        } else {
          await createReminder(payload);
          toast.success('Reminder created');
        }

        setShowGeneralModal(false);
        resetGeneralForm();
        loadGeneralReminders();
      } catch (err: any) {
        toast.error(err.message || 'Failed to save reminder');
      }
    });
  };

  const handleEditGeneral = (rem: any) => {
    setGenId(rem.id);
    setGenTitle(rem.title);
    setGenDesc(rem.description || '');
    setGenTime(rem.scheduled_time.slice(0, 5));
    setGenFreq(rem.frequency);
    setGenDays(rem.days_of_week || [1, 2, 3, 4, 5, 6, 0]);
    setGenAssignedTo(rem.assigned_to || user?.id || '');
    setShowGeneralModal(true);
  };

  const handleToggleGeneral = async (rem: any) => {
    try {
      await updateReminder(rem.id, { is_active: !rem.is_active });
      toast.success(rem.is_active ? 'Reminder disabled' : 'Reminder enabled');
      loadGeneralReminders();
    } catch (err: any) {
      toast.error(err.message || 'Failed to toggle status');
    }
  };

  // Medication Handlers
  const handleSaveMedication = (e: React.FormEvent) => {
    e.preventDefault();
    if (!medName.trim() || !medMemberId) {
      toast.error('Medicine Name and Family Member are required');
      return;
    }

    startTransition(async () => {
      try {
        const payload = {
          member_id: medMemberId,
          name: medName,
          dosage: medDosage || undefined,
          scheduled_time: medTime + ':00',
          frequency: medFreq,
          days_of_week: medFreq === 'weekly' ? medDays : undefined,
        };

        if (medId) {
          await updateMedicationReminder(medId, payload);
          toast.success('Medication reminder updated');
        } else {
          await createMedicationReminder(payload);
          toast.success('Medication reminder scheduled');
        }

        setShowMedModal(false);
        resetMedForm();
        loadAllData();
      } catch (err: any) {
        toast.error(err.message || 'Failed to save medication reminder');
      }
    });
  };

  const handleEditMedication = (med: any) => {
    setMedId(med.id);
    setMedName(med.name);
    setMedDosage(med.dosage || '');
    setMedTime(med.scheduled_time.slice(0, 5));
    setMedMemberId(med.member_id);
    setMedFreq(med.frequency);
    setMedDays(med.days_of_week || [1, 2, 3, 4, 5, 6, 0]);
    setShowMedModal(true);
  };

  const handleToggleMedication = async (med: any) => {
    try {
      await updateMedicationReminder(med.id, {
        member_id: med.member_id,
        name: med.name,
        scheduled_time: med.scheduled_time,
        frequency: med.frequency,
        is_active: !med.is_active,
      });
      toast.success(med.is_active ? 'Reminder disabled' : 'Reminder enabled');
      loadAllData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to toggle status');
    }
  };

  // Delete Action
  const triggerDelete = (id: string, type: 'general' | 'medication') => {
    setItemToDelete({ id, type });
    setDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (!itemToDelete) return;
    startTransition(async () => {
      try {
        if (itemToDelete.type === 'general') {
          await deleteReminder(itemToDelete.id);
          toast.success('Reminder deleted');
        } else {
          await deleteMedicationReminder(itemToDelete.id);
          toast.success('Medication reminder deleted');
        }
        setDeleteConfirmOpen(false);
        setItemToDelete(null);
        loadAllData();
      } catch (err: any) {
        toast.error(err.message || 'Failed to delete reminder');
      }
    });
  };

  // Form Resets
  const resetGeneralForm = () => {
    setGenId(null);
    setGenTitle('');
    setGenDesc('');
    setGenTime('08:00');
    setGenFreq('daily');
    setGenDays([1, 2, 3, 4, 5, 6, 0]);
    setGenAssignedTo(user?.id || '');
  };

  const resetMedForm = () => {
    setMedId(null);
    setMedName('');
    setMedDosage('');
    setMedTime('08:00');
    setMedMemberId(members[0]?.id || '');
    setMedFreq('daily');
    setMedDays([1, 2, 3, 4, 5, 6, 0]);
  };

  const toggleDayOfWeek = (day: number, currentDays: number[], setter: (val: number[]) => void) => {
    if (currentDays.includes(day)) {
      if (currentDays.length > 1) {
        setter(currentDays.filter((d) => d !== day));
      } else {
        toast.error('Must select at least one day for weekly frequency');
      }
    } else {
      setter([...currentDays, day].sort());
    }
  };

  const isOwner = user?.role === 'owner' || user?.role === 'admin';

  const DAYS = [
    { label: 'S', value: 0 },
    { label: 'M', value: 1 },
    { label: 'T', value: 2 },
    { label: 'W', value: 3 },
    { label: 'T', value: 4 },
    { label: 'F', value: 5 },
    { label: 'S', value: 6 },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 md:p-8 text-[#dde4e1]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl premium-gradient flex items-center justify-center text-white">
            <span className="material-symbols-outlined text-[28px]">notifications_active</span>
          </div>
          <div>
            <h1 className="text-headline-md font-bold tracking-tight text-white">Family Reminders</h1>
            <p className="text-body-sm text-[#859490]">Configure family reminders and medicine schedules</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Owner General Reminder Assignee Filter */}
          {isOwner && members.length > 0 && activeTab === 'general' && (
            <div className="flex items-center gap-2">
              <span className="text-body-sm text-[#859490]">Assignee:</span>
              <select
                value={selectedGenMemberFilter}
                onChange={(e) => setSelectedGenMemberFilter(e.target.value)}
                className="px-3 py-2 rounded-xl border border-white/10 bg-[#090f0e] text-body-sm text-white focus:outline-none focus:border-[#4fdbc8] cursor-pointer"
              >
                <option value="all">All Members</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>{m.full_name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Owner Medication Assignee Filter */}
          {isOwner && members.length > 0 && activeTab === 'medication' && (
            <div className="flex items-center gap-2">
              <span className="text-body-sm text-[#859490]">Member:</span>
              <select
                value={selectedMedMemberFilter}
                onChange={(e) => setSelectedMedMemberFilter(e.target.value)}
                className="px-3 py-2 rounded-xl border border-white/10 bg-[#090f0e] text-body-sm text-white focus:outline-none focus:border-[#4fdbc8] cursor-pointer"
              >
                <option value="all">All Members</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>{m.full_name}</option>
                ))}
              </select>
            </div>
          )}

          <button
            onClick={() => {
              if (activeTab === 'general') {
                resetGeneralForm();
                setShowGeneralModal(true);
              } else {
                resetMedForm();
                setShowMedModal(true);
              }
            }}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-semibold bg-[#4fdbc8] text-black hover:brightness-110 shadow-lg shadow-[#4fdbc8]/15 transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">add</span>
            <span>{activeTab === 'general' ? 'Add Reminder' : 'Add Medication'}</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/5 gap-2 pb-1 overflow-x-auto custom-scrollbar">
        <button
          onClick={() => setActiveTab('general')}
          className={`flex items-center gap-2 px-5 py-2.5 border-b-2 font-semibold text-body-sm transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'general'
              ? 'border-[#4fdbc8] text-[#4fdbc8] bg-[#4fdbc8]/5'
              : 'border-transparent text-[#bbcac6] hover:text-[#4fdbc8] hover:bg-white/[0.02]'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">alarm</span>
          General Reminders
        </button>
        <button
          onClick={() => setActiveTab('medication')}
          className={`flex items-center gap-2 px-5 py-2.5 border-b-2 font-semibold text-body-sm transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'medication'
              ? 'border-[#4fdbc8] text-[#4fdbc8] bg-[#4fdbc8]/5'
              : 'border-transparent text-[#bbcac6] hover:text-[#4fdbc8] hover:bg-white/[0.02]'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">prescriptions</span>
          Medications Checklist
        </button>
      </div>

      {/* Loading state */}
      {loading ? (
        <div className="text-center py-12">
          <span className="material-symbols-outlined animate-spin text-[32px] text-[#4fdbc8]">progress_activity</span>
        </div>
      ) : activeTab === 'general' ? (
        /* General Reminders Grid */
        reminders.length === 0 ? (
          <div className="glass-card rounded-2xl p-12 text-center border border-white/5 bg-white/[0.01]">
            <span className="material-symbols-outlined text-[48px] text-[#859490] mb-3">notifications_paused</span>
            <h3 className="text-body-lg font-semibold text-[#dde4e1]">No General Reminders</h3>
            <p className="text-body-sm text-[#859490] mt-1 max-w-sm mx-auto">
              Schedule custom alerts like drinking water, billing tasks, or family alerts.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {reminders.map((rem) => (
              <div
                key={rem.id}
                className={`glass-card rounded-2xl p-5 border transition-all flex flex-col justify-between h-[210px] hover:bg-white/[0.02] ${
                  rem.is_active ? 'border-white/10' : 'border-white/5 opacity-55'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-body-md font-semibold text-white truncate">{rem.title}</h3>
                    <button
                      onClick={() => handleToggleGeneral(rem)}
                      className={`material-symbols-outlined text-[24px] cursor-pointer transition-colors ${
                        rem.is_active ? 'text-[#4fdbc8]' : 'text-[#859490]'
                      }`}
                    >
                      {rem.is_active ? 'toggle_on' : 'toggle_off'}
                    </button>
                  </div>
                  {rem.description && (
                    <p className="text-body-sm text-[#bbcac6] line-clamp-2 mt-1.5 leading-relaxed">{rem.description}</p>
                  )}
                  {rem.assigned_user && (
                    <div className="flex items-center gap-1.5 mt-2">
                      <div
                        className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[9px] font-bold"
                        style={{ background: getAvatarStyle(rem.assigned_user.full_name) }}
                      >
                        {getInitials(rem.assigned_user.full_name)}
                      </div>
                      <span className="text-[11px] text-[#859490] font-semibold">
                        Assigned to: {rem.assigned_user.full_name.split(' ')[0]}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/5">
                  <div className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-1.5 text-label-sm text-[#4fdbc8]">
                      <span className="material-symbols-outlined text-[14px]">schedule</span>
                      <span className="font-semibold">{rem.scheduled_time.slice(0, 5)}</span>
                    </div>
                    <span className="text-[10px] text-[#859490] uppercase tracking-wide">
                      {rem.frequency}
                      {rem.frequency === 'weekly' && rem.days_of_week && (
                        ` • ${rem.days_of_week.map((d: number) => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d]).join(', ')}`
                      )}
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleEditGeneral(rem)}
                      className="p-2 hover:bg-white/5 rounded-xl text-[#bbcac6] hover:text-[#4fdbc8] transition-colors cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[18px]">edit</span>
                    </button>
                    <button
                      onClick={() => triggerDelete(rem.id, 'general')}
                      className="p-2 hover:bg-white/5 rounded-xl text-[#859490] hover:text-red-400 transition-colors cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[18px]">delete</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        /* Medication Reminders Grid */
        medications.filter(med => selectedMedMemberFilter === 'all' || med.member_id === selectedMedMemberFilter).length === 0 ? (
          <div className="glass-card rounded-2xl p-12 text-center border border-white/5 bg-white/[0.01]">
            <span className="material-symbols-outlined text-[48px] text-[#859490] mb-3">vaccines</span>
            <h3 className="text-body-lg font-semibold text-[#dde4e1]">No Medication Reminders</h3>
            <p className="text-body-sm text-[#859490] mt-1 max-w-sm mx-auto">
              Add recurring medication reminders for your family members here.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {medications
              .filter(med => selectedMedMemberFilter === 'all' || med.member_id === selectedMedMemberFilter)
              .map((med) => {
                const member = members.find((m) => m.id === med.member_id);
                return (
                  <div
                    key={med.id}
                    className={`glass-card rounded-2xl p-5 border transition-all flex flex-col justify-between h-48 hover:bg-white/[0.02] ${
                      med.is_active ? 'border-white/10' : 'border-white/5 opacity-55'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-xs text-[#ffb59e]">pill</span>
                          <h3 className="text-body-md font-semibold text-white truncate">{med.name}</h3>
                        </div>
                        <button
                          onClick={() => handleToggleMedication(med)}
                          className={`material-symbols-outlined text-[24px] cursor-pointer transition-colors ${
                            med.is_active ? 'text-[#4fdbc8]' : 'text-[#859490]'
                          }`}
                        >
                          {med.is_active ? 'toggle_on' : 'toggle_off'}
                        </button>
                      </div>
                      {med.dosage && (
                        <p className="text-body-sm text-[#bbcac6] mt-1.5 leading-relaxed">Dosage: {med.dosage}</p>
                      )}
                      {member && (
                        <div className="flex items-center gap-1.5 mt-2">
                          <div
                            className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[9px] font-bold"
                            style={{ background: getAvatarStyle(member.full_name) }}
                          >
                            {getInitials(member.full_name)}
                          </div>
                          <span className="text-[11px] text-[#859490] font-semibold">For {member.full_name}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/5">
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-1.5 text-label-sm text-[#ffb59e]">
                          <span className="material-symbols-outlined text-[14px]">schedule</span>
                          <span className="font-semibold">{med.scheduled_time.slice(0, 5)}</span>
                        </div>
                        <span className="text-[10px] text-[#859490] uppercase tracking-wide">
                          {med.frequency}
                          {med.frequency === 'weekly' && med.days_of_week && (
                            ` • ${med.days_of_week.map((d: number) => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d]).join(', ')}`
                          )}
                        </span>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleEditMedication(med)}
                          className="p-2 hover:bg-white/5 rounded-xl text-[#bbcac6] hover:text-[#4fdbc8] transition-colors cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[18px]">edit</span>
                        </button>
                        <button
                          onClick={() => triggerDelete(med.id, 'medication')}
                          className="p-2 hover:bg-white/5 rounded-xl text-[#859490] hover:text-red-400 transition-colors cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[18px]">delete</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        )
      )}

      {/* General Reminder Form Modal */}
      <NexusModal
        isOpen={showGeneralModal}
        onClose={() => setShowGeneralModal(false)}
        title={genId ? 'Edit Reminder' : 'Add Family Reminder'}
      >
        <form onSubmit={handleSaveGeneral} className="space-y-4">
          <div className="space-y-1">
            <label className="text-body-sm text-[#bbcac6]">Title *</label>
            <input
              type="text"
              value={genTitle}
              onChange={(e) => setGenTitle(e.target.value)}
              placeholder="e.g. Drink water, Water plants, Check internet bill"
              className="w-full input-glass px-3 py-2.5 rounded-xl text-body-sm text-white"
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-body-sm text-[#bbcac6]">Description (Optional)</label>
            <textarea
              value={genDesc}
              onChange={(e) => setGenDesc(e.target.value)}
              placeholder="Enter optional description or details..."
              rows={2}
              className="w-full input-glass px-3 py-2.5 rounded-xl text-body-sm text-white resize-none"
            />
          </div>

          {/* User Assignment (Only visible to Owner/Admin) */}
          {isOwner && members.length > 0 && (
            <div className="space-y-1">
              <label className="text-body-sm text-[#bbcac6]">Assign Reminder To</label>
              <select
                value={genAssignedTo}
                onChange={(e) => setGenAssignedTo(e.target.value)}
                className="w-full input-glass px-3 py-2.5 rounded-xl text-body-sm bg-[#161d1b] text-white"
              >
                {members.map((m) => (
                  <option key={m.id} value={m.id}>{m.full_name}</option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-body-sm text-[#bbcac6]">Trigger Time *</label>
              <input
                type="time"
                value={genTime}
                onChange={(e) => setGenTime(e.target.value)}
                className="w-full input-glass px-3 py-2.5 rounded-xl text-body-sm text-white"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-body-sm text-[#bbcac6]">Frequency</label>
              <select
                value={genFreq}
                onChange={(e) => setGenFreq(e.target.value)}
                className="w-full input-glass px-3 py-2.5 rounded-xl text-body-sm bg-[#161d1b] text-white"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="once">Once</option>
              </select>
            </div>
          </div>

          {genFreq === 'weekly' && (
            <div className="space-y-2">
              <label className="text-body-sm text-[#bbcac6] block">Repeat on Days</label>
              <div className="flex gap-2 justify-between">
                {DAYS.map((day) => {
                  const isSelected = genDays.includes(day.value);
                  return (
                    <button
                      key={day.value}
                      type="button"
                      onClick={() => toggleDayOfWeek(day.value, genDays, setGenDays)}
                      className={`w-9 h-9 rounded-full flex items-center justify-center text-label-sm font-bold border transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-[#4fdbc8] text-black border-[#4fdbc8]'
                          : 'border-white/10 text-[#859490] hover:bg-white/5'
                      }`}
                    >
                      {day.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex gap-4 pt-4 border-t border-white/5">
            <button
              type="button"
              onClick={() => setShowGeneralModal(false)}
              className="flex-1 py-3 rounded-xl border border-white/5 hover:border-white/10 hover:bg-white/[0.02] text-body-sm font-semibold transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex-1 py-3 rounded-xl bg-[#4fdbc8] text-black font-semibold text-body-sm hover:brightness-110 shadow-lg shadow-[#4fdbc8]/15 transition-all"
            >
              {isPending ? 'Saving...' : 'Save Reminder'}
            </button>
          </div>
        </form>
      </NexusModal>

      {/* Medication Reminder Form Modal */}
      <NexusModal
        isOpen={showMedModal}
        onClose={() => setShowMedModal(false)}
        title={medId ? 'Edit Medication' : 'Add Medication Schedule'}
      >
        <form onSubmit={handleSaveMedication} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-body-sm text-[#bbcac6]">Medicine Name *</label>
              <input
                type="text"
                value={medName}
                onChange={(e) => setMedName(e.target.value)}
                placeholder="e.g. Paracetamol, Metformin"
                className="w-full input-glass px-3 py-2.5 rounded-xl text-body-sm text-white"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-body-sm text-[#bbcac6]">Dosage (Optional)</label>
              <input
                type="text"
                value={medDosage}
                onChange={(e) => setMedDosage(e.target.value)}
                placeholder="e.g. 500mg, 1 tablet"
                className="w-full input-glass px-3 py-2.5 rounded-xl text-body-sm text-white"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-body-sm text-[#bbcac6]">For Family Member *</label>
            <select
              value={medMemberId}
              onChange={(e) => setMedMemberId(e.target.value)}
              className="w-full input-glass px-3 py-2.5 rounded-xl text-body-sm bg-[#161d1b] text-white"
              required
            >
              {members.map((m) => (
                <option key={m.id} value={m.id}>{m.full_name}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-body-sm text-[#bbcac6]">Scheduled Time *</label>
              <input
                type="time"
                value={medTime}
                onChange={(e) => setMedTime(e.target.value)}
                className="w-full input-glass px-3 py-2.5 rounded-xl text-body-sm text-white"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-body-sm text-[#bbcac6]">Frequency</label>
              <select
                value={medFreq}
                onChange={(e) => setMedFreq(e.target.value)}
                className="w-full input-glass px-3 py-2.5 rounded-xl text-body-sm bg-[#161d1b] text-white"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
              </select>
            </div>
          </div>

          {medFreq === 'weekly' && (
            <div className="space-y-2">
              <label className="text-body-sm text-[#bbcac6] block">Repeat on Days</label>
              <div className="flex gap-2 justify-between">
                {DAYS.map((day) => {
                  const isSelected = medDays.includes(day.value);
                  return (
                    <button
                      key={day.value}
                      type="button"
                      onClick={() => toggleDayOfWeek(day.value, medDays, setMedDays)}
                      className={`w-9 h-9 rounded-full flex items-center justify-center text-label-sm font-bold border transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-[#4fdbc8] text-black border-[#4fdbc8]'
                          : 'border-white/10 text-[#859490] hover:bg-white/5'
                      }`}
                    >
                      {day.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex gap-4 pt-4 border-t border-white/5">
            <button
              type="button"
              onClick={() => setShowMedModal(false)}
              className="flex-1 py-3 rounded-xl border border-white/5 hover:border-white/10 hover:bg-white/[0.02] text-body-sm font-semibold transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex-1 py-3 rounded-xl bg-[#4fdbc8] text-black font-semibold text-body-sm hover:brightness-110 shadow-lg shadow-[#4fdbc8]/15 transition-all"
            >
              {isPending ? 'Saving...' : 'Save Medication'}
            </button>
          </div>
        </form>
      </NexusModal>

      {/* Delete Confirmation */}
      <NexusConfirm
        isOpen={deleteConfirmOpen}
        title="Delete Reminder?"
        description="Are you sure you want to permanently delete this reminder? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={handleDeleteConfirm}
        onCancel={() => {
          setDeleteConfirmOpen(false);
          setItemToDelete(null);
        }}
        variant="danger"
        loading={isPending}
      />
    </div>
  );
}
