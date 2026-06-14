'use client';

import { useEffect, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { formatDate } from '@/lib/utils';
import NexusModal from '@/components/nexus/NexusModal';
import NexusConfirm from '@/components/nexus/NexusConfirm';
import {
  fetchOccasions,
  createOccasion,
  updateOccasion,
  deleteOccasion
} from './actions';

interface Occasion {
  id: string;
  name: string;
  type: string;
  date: string;
  relationship: string;
  reminder_days: number;
  notes: string | null;
  phone: string | null;
}

export default function OccasionsPage() {
  const [occasions, setOccasions] = useState<Occasion[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  // Filter & Search states
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'all' | 'family' | 'friend'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'birthday' | 'anniversary' | 'other'>('all');

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [occasionToEdit, setOccasionToEdit] = useState<Occasion | null>(null);
  const [occasionToDelete, setOccasionToDelete] = useState<Occasion | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [type, setType] = useState('birthday');
  const [relationship, setRelationship] = useState('family');
  const [date, setDate] = useState('');
  const [reminderDays, setReminderDays] = useState(1);
  const [notes, setNotes] = useState('');

  const loadOccasions = async () => {
    try {
      setLoading(true);
      const data = await fetchOccasions();
      setOccasions(data as Occasion[]);
    } catch {
      toast.error('Failed to load occasions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOccasions();
  }, []);

  const resetForm = () => {
    setName('');
    setPhone('');
    setType('birthday');
    setRelationship('family');
    setDate('');
    setReminderDays(1);
    setNotes('');
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !date) {
      toast.error('Name and Date are required');
      return;
    }

    startTransition(async () => {
      try {
        await createOccasion({
          name,
          type,
          date,
          relationship,
          reminder_days: reminderDays,
          notes,
          phone,
        });
        toast.success(`${name}'s occasion added!`);
        setShowAddModal(false);
        resetForm();
        loadOccasions();
      } catch (err: any) {
        toast.error(err.message || 'Failed to add occasion');
      }
    });
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!occasionToEdit) return;

    startTransition(async () => {
      try {
        await updateOccasion(occasionToEdit.id, {
          name,
          type,
          date,
          relationship,
          reminder_days: reminderDays,
          notes,
          phone,
        });
        toast.success('Occasion updated successfully');
        setShowEditModal(false);
        setOccasionToEdit(null);
        resetForm();
        loadOccasions();
      } catch (err: any) {
        toast.error(err.message || 'Failed to update occasion');
      }
    });
  };

  const handleDelete = async () => {
    if (!occasionToDelete) return;

    startTransition(async () => {
      try {
        await deleteOccasion(occasionToDelete.id);
        toast.success('Occasion removed successfully');
        setShowDeleteConfirm(false);
        setOccasionToDelete(null);
        loadOccasions();
      } catch (err: any) {
        toast.error(err.message || 'Failed to delete occasion');
      }
    });
  };

  const openEditModal = (occ: Occasion) => {
    setOccasionToEdit(occ);
    setName(occ.name);
    setPhone(occ.phone || '');
    setType(occ.type);
    setRelationship(occ.relationship);
    setDate(occ.date);
    setReminderDays(occ.reminder_days);
    setNotes(occ.notes || '');
    setShowEditModal(true);
  };

  const openDeleteConfirm = (occ: Occasion) => {
    setOccasionToDelete(occ);
    setShowDeleteConfirm(true);
  };

  // Helper: calculate days remaining until next occurrence
  const getDaysRemaining = (dateStr: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const occDate = new Date(dateStr);
    const nextOcc = new Date(today.getFullYear(), occDate.getMonth(), occDate.getDate());

    if (nextOcc.getTime() < today.getTime()) {
      nextOcc.setFullYear(today.getFullYear() + 1);
    }

    const diffMs = nextOcc.getTime() - today.getTime();
    return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  };

  // Helper: format phone number for display
  const formatPhoneDisplay = (p?: string | null) => {
    if (!p) return '';
    return `+${p.slice(0, 2)} ${p.slice(2, 7)} ${p.slice(7)}`;
  };

  // Helper: get preset wish message and generate link
  const getWhatsAppLink = (occ: Occasion) => {
    if (!occ.phone) return '#';
    let text = '';
    const firstName = occ.name.split(' ')[0];
    if (occ.type === 'birthday') {
      text = `Hey ${firstName}, wishing you a very Happy Birthday! 🎂🎉 Hope you have an amazing day ahead!`;
    } else if (occ.type === 'anniversary') {
      text = `Hey ${firstName}, wishing you both a very Happy Anniversary! 💍🥂 May your love continue to grow!`;
    } else {
      text = `Hey ${firstName}, thinking of you on this special day! Wishing you the very best! 💖`;
    }
    return `https://wa.me/${occ.phone}?text=${encodeURIComponent(text)}`;
  };

  // Filter logic
  const filteredOccasions = occasions.filter((occ) => {
    const matchesSearch = occ.name.toLowerCase().includes(search.toLowerCase());
    const matchesTab = tab === 'all' || occ.relationship === tab;
    const matchesType = typeFilter === 'all' || occ.type === typeFilter;
    return matchesSearch && matchesTab && matchesType;
  });

  // Aggregations
  const totalBdays = occasions.filter((o) => o.type === 'birthday').length;
  const totalAnnis = occasions.filter((o) => o.type === 'anniversary').length;
  const currentMonth = new Date().getMonth();
  const occurrencesThisMonth = occasions.filter((o) => {
    const m = new Date(o.date).getMonth();
    return m === currentMonth;
  }).length;

  return (
    <div className="px-4 md:px-8 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span className="material-symbols-outlined text-[28px]" style={{ color: '#ffb59e' }}>cake</span>
            <h1
              style={{
                fontFamily: 'Geist, sans-serif',
                fontSize: '32px',
                fontWeight: '700',
                color: '#dde4e1',
                letterSpacing: '-0.02em',
              }}
            >
              Occasions Tracker
            </h1>
          </div>
          <p className="text-body-md" style={{ color: '#859490' }}>
            Track birthdays, anniversaries, and custom key dates for family and friends.
          </p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowAddModal(true);
          }}
          className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl font-semibold transition-all active:scale-[0.98] cursor-pointer"
          style={{
            background: 'linear-gradient(135deg, #14b8a6, #0566d9)',
            color: 'white',
            boxShadow: '0 8px 32px rgba(20,184,166,0.25)',
          }}
        >
          <span className="material-symbols-outlined text-[20px]">add_circle</span>
          Add Occasion
        </button>
      </div>

      {/* Stats Summary Card */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: '🎂 Total Birthdays', value: totalBdays, color: '#4fdbc8' },
          { label: '💍 Total Anniversaries', value: totalAnnis, color: '#adc6ff' },
          { label: '📅 Celebrations This Month', value: occurrencesThisMonth, color: '#ffb59e' },
        ].map((stat) => (
          <div key={stat.label} className="glass-card rounded-2xl p-5 border border-white/5">
            <p className="text-label-sm text-[#859490]">{stat.label}</p>
            <p
              className="text-display-lg mt-2"
              style={{
                fontFamily: 'Geist, sans-serif',
                fontSize: '36px',
                fontWeight: '700',
                color: stat.color,
                letterSpacing: '-0.03em',
              }}
            >
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      {/* Tabs and Filters */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-4">
        <div className="flex gap-2 p-1 rounded-xl bg-white/3 border border-white/5 w-fit">
          {[
            { id: 'all', label: 'All Occasions' },
            { id: 'family', label: 'Family' },
            { id: 'friend', label: 'Friends' },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id as any)}
              className="px-4 py-2 rounded-lg text-body-sm font-semibold transition-all cursor-pointer"
              style={{
                background: tab === t.id ? 'rgba(79, 219, 200, 0.1)' : 'transparent',
                color: tab === t.id ? '#4fdbc8' : '#bbcac6',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row gap-3 flex-1 md:max-w-md">
          <input
            type="text"
            placeholder="Search by name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-glass px-4 py-2.5 rounded-xl text-body-sm text-[#dde4e1] flex-1"
          />

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as any)}
            className="input-glass px-4 py-2.5 rounded-xl text-body-sm text-[#dde4e1] bg-[#0e1513] border border-white/8 outline-none"
          >
            <option value="all">All Types</option>
            <option value="birthday">Birthdays</option>
            <option value="anniversary">Anniversaries</option>
            <option value="other">Other Important Dates</option>
          </select>
        </div>
      </div>

      {/* Main Grid */}
      {loading ? (
        <div className="text-center py-12">
          <span className="material-symbols-outlined animate-spin text-[32px] text-[#4fdbc8]">progress_activity</span>
        </div>
      ) : filteredOccasions.length === 0 ? (
        <div className="glass-card rounded-[32px] p-12 text-center border border-white/5 space-y-4">
          <span className="material-symbols-outlined text-[48px]" style={{ color: '#3c4947' }}>cake</span>
          <p className="text-body-sm text-[#859490]">No matching occasions found. Add a new occasion to start tracking!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredOccasions.map((occ) => {
            const daysRemaining = getDaysRemaining(occ.date);
            const isUrgent = daysRemaining <= 7;
            const originalDate = new Date(occ.date);

            return (
              <div
                key={occ.id}
                className="glass-card rounded-[28px] p-6 border border-white/5 hover:border-[#ffb59e]/30 hover:shadow-[0_20px_60px_rgba(255,181,158,0.04)] transition-all duration-300 flex flex-col justify-between group"
              >
                <div className="space-y-4">
                  {/* Top info and badge */}
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-body-md text-[#dde4e1] group-hover:text-[#ffb59e] transition-colors">
                        {occ.name}
                      </h3>
                      <span className="text-label-sm text-[#859490] uppercase tracking-wider text-[10px]">
                        {occ.relationship}
                      </span>
                    </div>

                    <span
                      className="px-2.5 py-0.5 rounded-full text-label-sm font-semibold text-[10px] uppercase border"
                      style={{
                        background:
                          occ.type === 'birthday'
                            ? 'rgba(79, 219, 200, 0.08)'
                            : occ.type === 'anniversary'
                            ? 'rgba(173, 198, 255, 0.08)'
                            : 'rgba(255, 181, 158, 0.08)',
                        color:
                          occ.type === 'birthday'
                            ? '#4fdbc8'
                            : occ.type === 'anniversary'
                            ? '#adc6ff'
                            : '#ffb59e',
                        borderColor:
                          occ.type === 'birthday'
                            ? 'rgba(79, 219, 200, 0.2)'
                            : occ.type === 'anniversary'
                            ? 'rgba(173, 198, 255, 0.2)'
                            : 'rgba(255, 181, 158, 0.2)',
                      }}
                    >
                      {occ.type}
                    </span>
                  </div>

                  {/* Date and Countdown */}
                  <div className="flex items-center justify-between pt-2">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-[18px] text-[#ffb59e]">calendar_today</span>
                      <span className="text-body-sm text-[#dde4e1] font-medium">
                        {originalDate.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
                      </span>
                    </div>

                    <span
                      className="text-label-sm text-[11px] px-2 py-0.5 rounded"
                      style={{
                        background: isUrgent ? 'rgba(239, 68, 68, 0.1)' : 'rgba(255, 255, 255, 0.03)',
                        color: isUrgent ? '#ffb4ab' : '#859490',
                      }}
                    >
                      {daysRemaining === 0 ? 'Today 🎉' : `${daysRemaining} days left`}
                    </span>
                  </div>

                  {/* Phone / Notes details */}
                  {occ.notes && (
                    <p className="text-body-sm text-[#859490] line-clamp-2 italic pt-1 border-t border-white/3">
                      &ldquo;{occ.notes}&rdquo;
                    </p>
                  )}
                </div>

                <div className="mt-6 pt-4 border-t border-white/5 flex items-center justify-between gap-3">
                  {occ.phone ? (
                    <a
                      href={getWhatsAppLink(occ)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-label-sm font-semibold transition-all hover:bg-emerald-500/10 hover:text-emerald-400 border border-emerald-500/20 text-[#859490] text-xs"
                    >
                      <span className="material-symbols-outlined text-xs">chat</span>
                      Wishes via WhatsApp
                    </a>
                  ) : (
                    <span className="text-xs text-[#859490] italic">No phone added</span>
                  )}

                  <div className="flex gap-1.5">
                    <button
                      onClick={() => openEditModal(occ)}
                      className="p-2 rounded-lg hover:bg-white/5 text-[#adc6ff] transition-colors"
                      title="Edit"
                    >
                      <span className="material-symbols-outlined text-[18px]">edit</span>
                    </button>
                    <button
                      onClick={() => openDeleteConfirm(occ)}
                      className="p-2 rounded-lg hover:bg-white/5 text-[#ffb4ab] transition-colors"
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

      {/* ================= MODALS ================= */}

      {/* Add Occasion Modal */}
      <NexusModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Add Occasion"
        description="Manually record a special date to track, set up reminders, and launch one-tap WhatsApp wishes."
      >
        <form onSubmit={handleAdd} className="space-y-4">
          <div className="space-y-2">
            <label className="text-label-sm uppercase text-[#859490]">Person Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Arjun Neralla or Rohan (Friend)"
              className="input-glass w-full px-4 py-3 rounded-xl text-body-sm text-[#dde4e1]"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-label-sm uppercase text-[#859490]">Occasion Type</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="input-glass w-full px-4 py-3 rounded-xl text-body-sm text-[#dde4e1] bg-[#1a211f]"
              >
                <option value="birthday">🎂 Birthday</option>
                <option value="anniversary">💍 Anniversary</option>
                <option value="other">📅 Other Key Date</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-label-sm uppercase text-[#859490]">Relationship</label>
              <select
                value={relationship}
                onChange={(e) => setRelationship(e.target.value)}
                className="input-glass w-full px-4 py-3 rounded-xl text-body-sm text-[#dde4e1] bg-[#1a211f]"
              >
                <option value="family">Family Member</option>
                <option value="friend">Friend</option>
                <option value="other">Other / Acquaintance</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-label-sm uppercase text-[#859490]">Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="input-glass w-full px-4 py-3 rounded-xl text-body-sm text-[#dde4e1]"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-label-sm uppercase text-[#859490]">Phone (WhatsApp)</label>
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
            <label className="text-label-sm uppercase text-[#859490]">Remind Me</label>
            <select
              value={reminderDays}
              onChange={(e) => setReminderDays(Number(e.target.value))}
              className="input-glass w-full px-4 py-3 rounded-xl text-body-sm text-[#dde4e1] bg-[#1a211f]"
            >
              <option value={0}>On the day</option>
              <option value={1}>1 day before</option>
              <option value={3}>3 days before</option>
              <option value={7}>1 week before</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-label-sm uppercase text-[#859490]">Notes / Gift Ideas</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Likes custom pens, dislikes sweets..."
              rows={3}
              className="input-glass w-full px-4 py-3 rounded-xl text-body-sm text-[#dde4e1] resize-none"
            />
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="w-full py-4 rounded-2xl flex items-center justify-center gap-2 font-semibold transition-all active:scale-[0.98] disabled:opacity-60 mt-4 cursor-pointer"
            style={{
              background: 'linear-gradient(135deg, #14b8a6, #0566d9)',
              color: 'white',
              boxShadow: '0 8px 32px rgba(20,184,166,0.3)',
            }}
          >
            {isPending ? 'Saving Occasion...' : 'Add Occasion'}
          </button>
        </form>
      </NexusModal>

      {/* Edit Occasion Modal */}
      <NexusModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        title="Edit Occasion"
        description="Update dates, phone numbers, or reminder settings for this occasion."
      >
        <form onSubmit={handleEdit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-label-sm uppercase text-[#859490]">Person Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input-glass w-full px-4 py-3 rounded-xl text-body-sm text-[#dde4e1]"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-label-sm uppercase text-[#859490]">Occasion Type</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="input-glass w-full px-4 py-3 rounded-xl text-body-sm text-[#dde4e1] bg-[#1a211f]"
              >
                <option value="birthday">🎂 Birthday</option>
                <option value="anniversary">💍 Anniversary</option>
                <option value="other">📅 Other Key Date</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-label-sm uppercase text-[#859490]">Relationship</label>
              <select
                value={relationship}
                onChange={(e) => setRelationship(e.target.value)}
                className="input-glass w-full px-4 py-3 rounded-xl text-body-sm text-[#dde4e1] bg-[#1a211f]"
              >
                <option value="family">Family Member</option>
                <option value="friend">Friend</option>
                <option value="other">Other / Acquaintance</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-label-sm uppercase text-[#859490]">Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="input-glass w-full px-4 py-3 rounded-xl text-body-sm text-[#dde4e1]"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-label-sm uppercase text-[#859490]">Phone (WhatsApp)</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="input-glass w-full px-4 py-3 rounded-xl text-body-sm text-[#dde4e1]"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-label-sm uppercase text-[#859490]">Remind Me</label>
            <select
              value={reminderDays}
              onChange={(e) => setReminderDays(Number(e.target.value))}
              className="input-glass w-full px-4 py-3 rounded-xl text-body-sm text-[#dde4e1] bg-[#1a211f]"
            >
              <option value={0}>On the day</option>
              <option value={1}>1 day before</option>
              <option value={3}>3 days before</option>
              <option value={7}>1 week before</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-label-sm uppercase text-[#859490]">Notes / Gift Ideas</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="input-glass w-full px-4 py-3 rounded-xl text-body-sm text-[#dde4e1] resize-none"
            />
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="w-full py-4 rounded-2xl flex items-center justify-center gap-2 font-semibold transition-all active:scale-[0.98] disabled:opacity-60 mt-4 cursor-pointer"
            style={{
              background: 'linear-gradient(135deg, #14b8a6, #0566d9)',
              color: 'white',
              boxShadow: '0 8px 32px rgba(20,184,166,0.3)',
            }}
          >
            {isPending ? 'Saving Changes...' : 'Save Changes'}
          </button>
        </form>
      </NexusModal>

      {/* Delete Occasion Confirmation */}
      <NexusConfirm
        isOpen={showDeleteConfirm}
        title="Delete Occasion?"
        description={`Are you sure you want to stop tracking celebrations for ${occasionToDelete?.name}?`}
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={handleDelete}
        onCancel={() => {
          setShowDeleteConfirm(false);
          setOccasionToDelete(null);
        }}
        variant="danger"
        loading={isPending}
      />
    </div>
  );
}
