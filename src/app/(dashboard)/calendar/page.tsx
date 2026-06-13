'use client';

import { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useUser } from '@/hooks/useUser';
import { toast } from 'sonner';
import { formatDate } from '@/lib/utils';
import NexusModal from '@/components/nexus/NexusModal';
import NexusConfirm from '@/components/nexus/NexusConfirm';
import type { FamilyMember, CalendarEvent } from '@/types';
import {
  fetchCalendarEvents,
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
} from './actions';

const EVENT_CATEGORIES = [
  { id: 'birthday', label: 'Birthdays', icon: 'cake', color: '#4fdbc8', bgClass: 'bg-primary/20 border-primary/40 text-primary event-glow-teal' },
  { id: 'medical', label: 'Medical Appts', icon: 'medical_information', color: '#adc6ff', bgClass: 'bg-secondary/20 border-secondary/40 text-secondary event-glow-violet' },
  { id: 'policy_renewal', label: 'Renewals', icon: 'event_repeat', color: '#ffb59e', bgClass: 'bg-tertiary/20 border-tertiary/40 text-tertiary-container event-glow-orange' },
  { id: 'trip', label: 'Trips & Events', icon: 'flight', color: '#22c55e', bgClass: 'bg-green-500/20 border-green-500/40 text-green-400 event-glow-green' },
  { id: 'reminder', label: 'Reminders', icon: 'notifications_active', color: '#a78bfa', bgClass: 'bg-purple-500/20 border-purple-500/40 text-purple-400' },
  { id: 'other', label: 'Others', icon: 'more_horiz', color: '#859490', bgClass: 'bg-white/5 border-white/10 text-on-surface-variant' },
];

export default function CalendarPage() {
  const { user } = useUser();
  const [events, setEvents] = useState<any[]>([]);
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  // Calendar State
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<'month' | 'week' | 'agenda'>('month');

  // Filters State
  const [selectedMemberFilters, setSelectedMemberFilters] = useState<string[]>(['all']);
  const [selectedCategoryFilters, setSelectedCategoryFilters] = useState<string[]>(['all']);

  // Modals & Forms State
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Form State
  const [selectedEvent, setSelectedEvent] = useState<any | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formType, setFormType] = useState('reminder');
  const [formStart, setFormStart] = useState('');
  const [formEnd, setFormEnd] = useState('');
  const [formAllDay, setFormAllDay] = useState(false);
  const [formMembers, setFormMembers] = useState<string[]>([]);
  const [isEditing, setIsEditing] = useState(false);

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

      // Fetch calendar events
      const items = await fetchCalendarEvents();
      setEvents(items);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load calendar events');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user]);

  // Calendar Calculations
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const handleToday = () => {
    const today = new Date();
    setCurrentDate(today);
    setSelectedDate(today);
  };

  // Generate days in grid
  const getDaysInMonthGrid = () => {
    const firstDayIndex = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();
    const totalDaysPrev = new Date(year, month, 0).getDate();

    const days = [];

    // Prev month padding
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const dayVal = totalDaysPrev - i;
      const prevDate = new Date(year, month - 1, dayVal);
      days.push({
        date: prevDate,
        dayNum: dayVal,
        isCurrentMonth: false,
      });
    }

    // Current month days
    for (let i = 1; i <= totalDays; i++) {
      const currDate = new Date(year, month, i);
      days.push({
        date: currDate,
        dayNum: i,
        isCurrentMonth: true,
      });
    }

    // Next month padding to fill grid (usually 42 cells total for 6 rows)
    const totalCells = 42;
    const remaining = totalCells - days.length;
    for (let i = 1; i <= remaining; i++) {
      const nextDate = new Date(year, month + 1, i);
      days.push({
        date: nextDate,
        dayNum: i,
        isCurrentMonth: false,
      });
    }

    return days;
  };

  const daysGrid = getDaysInMonthGrid();

  // Filtering Logic
  const getFilteredEvents = () => {
    return events.filter((e) => {
      // 1. Category Filter
      if (!selectedCategoryFilters.includes('all')) {
        if (!selectedCategoryFilters.includes(e.type)) return false;
      }

      // 2. Member Filter
      if (!selectedMemberFilters.includes('all')) {
        // Event should share at least one tagged member with selected filter
        if (e.members && e.members.length > 0) {
          const hasMatch = e.members.some((mId: string) => selectedMemberFilters.includes(mId));
          if (!hasMatch) return false;
        } else {
          // If event has no members, show it only if "Global" or "all" is checked
          if (!selectedMemberFilters.includes('global')) return false;
        }
      }

      return true;
    });
  };

  const filteredEvents = getFilteredEvents();

  // Helper: check if event is on a specific day
  const getEventsForDay = (date: Date) => {
    return filteredEvents.filter((e) => {
      const evDate = new Date(e.start_at);
      return (
        evDate.getFullYear() === date.getFullYear() &&
        evDate.getMonth() === date.getMonth() &&
        evDate.getDate() === date.getDate()
      );
    });
  };

  // Helper: check if date is today
  const isToday = (date: Date) => {
    const today = new Date();
    return (
      date.getFullYear() === today.getFullYear() &&
      date.getMonth() === today.getMonth() &&
      date.getDate() === today.getDate()
    );
  };

  // Helper: check if dates are equal
  const isSelected = (date: Date) => {
    return (
      date.getFullYear() === selectedDate.getFullYear() &&
      date.getMonth() === selectedDate.getMonth() &&
      date.getDate() === selectedDate.getDate()
    );
  };

  const selectedDayEvents = getEventsForDay(selectedDate);

  // Quick Add / Open Modal helpers
  const handleOpenAddModal = (date?: Date) => {
    setIsEditing(false);
    setSelectedEvent(null);
    setFormTitle('');
    setFormDesc('');
    setFormType('reminder');

    // Default to selected date or now, formatted for datetime-local
    const defaultDate = date || selectedDate || new Date();
    const formatted = new Date(defaultDate.getTime() - defaultDate.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
    setFormStart(formatted);
    setFormEnd('');
    setFormAllDay(false);
    setFormMembers([]);
    setShowAddModal(true);
  };

  const handleOpenEdit = (event: any) => {
    setIsEditing(true);
    setSelectedEvent(event);
    setFormTitle(event.title);
    setFormDesc(event.description || '');
    setFormType(event.type);
    
    const startIso = new Date(new Date(event.start_at).getTime() - new Date(event.start_at).getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
    setFormStart(startIso);

    const endIso = event.end_at
      ? new Date(new Date(event.end_at).getTime() - new Date(event.end_at).getTimezoneOffset() * 60000)
          .toISOString()
          .slice(0, 16)
      : '';
    setFormEnd(endIso);
    setFormAllDay(event.all_day || false);
    setFormMembers(event.members || []);
    setShowDetailModal(false);
    setShowAddModal(true);
  };

  const handleOpenDetail = (event: any) => {
    setSelectedEvent(event);
    setShowDetailModal(true);
  };

  // Handlers for Save / Delete
  const handleSaveEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle || !formStart) {
      toast.error('Title and Start Time are required');
      return;
    }

    startTransition(async () => {
      try {
        const payload = {
          title: formTitle,
          description: formDesc || undefined,
          type: formType,
          start_at: new Date(formStart).toISOString(),
          end_at: formEnd ? new Date(formEnd).toISOString() : undefined,
          all_day: formAllDay,
          members: formMembers,
        };

        if (isEditing && selectedEvent) {
          await updateCalendarEvent(selectedEvent.id, payload);
          toast.success('Event updated successfully');
        } else {
          await createCalendarEvent(payload);
          toast.success('Event created successfully');
        }

        setShowAddModal(false);
        loadData();
      } catch (err: any) {
        toast.error(err.message || 'Failed to save event');
      }
    });
  };

  const handleDeleteClick = () => {
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = async () => {
    if (!selectedEvent) return;
    startTransition(async () => {
      try {
        await deleteCalendarEvent(selectedEvent.id);
        toast.success('Event deleted successfully');
        setShowDeleteConfirm(false);
        setShowDetailModal(false);
        loadData();
      } catch (err: any) {
        toast.error(err.message || 'Failed to delete event');
      }
    });
  };

  // Toggle Filters helpers
  const handleToggleMemberFilter = (mId: string) => {
    if (mId === 'all') {
      setSelectedMemberFilters(['all']);
    } else {
      let next = selectedMemberFilters.filter((f) => f !== 'all');
      if (next.includes(mId)) {
        next = next.filter((f) => f !== mId);
        if (next.length === 0) next = ['all'];
      } else {
        next.push(mId);
      }
      setSelectedMemberFilters(next);
    }
  };

  const handleToggleCategoryFilter = (catId: string) => {
    if (catId === 'all') {
      setSelectedCategoryFilters(['all']);
    } else {
      let next = selectedCategoryFilters.filter((f) => f !== 'all');
      if (next.includes(catId)) {
        next = next.filter((f) => f !== catId);
        if (next.length === 0) next = ['all'];
      } else {
        next.push(catId);
      }
      setSelectedCategoryFilters(next);
    }
  };

  const handleToggleFormMember = (mId: string) => {
    if (formMembers.includes(mId)) {
      setFormMembers(formMembers.filter((id) => id !== mId));
    } else {
      setFormMembers([...formMembers, mId]);
    }
  };

  // Stats
  const nextBirthdays = filteredEvents.filter((e) => e.type === 'birthday' && new Date(e.start_at) >= new Date()).slice(0, 3);
  const nextAppointments = filteredEvents.filter((e) => e.type === 'medical' && new Date(e.start_at) >= new Date()).slice(0, 3);

  // Month names
  const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  return (
    <div className="px-4 md:px-8 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span
              className="material-symbols-outlined"
              style={{ color: '#4fdbc8', fontSize: '28px', fontVariationSettings: "'FILL' 1" }}
            >
              calendar_today
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
              Family Calendar
            </h1>
          </div>
          <p className="text-body-md" style={{ color: '#859490' }}>
            Unified family calendar for birthdays, medical visits, insurance, and trips.
          </p>
        </div>

        <button
          onClick={() => handleOpenAddModal()}
          className="py-3 px-5 bg-gradient-to-br from-[#14b8a6] to-[#0566d9] text-white font-semibold rounded-xl flex items-center justify-center gap-2 hover:brightness-110 transition-all active:scale-[0.98] shadow-lg self-start md:self-auto"
        >
          <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
            add_circle
          </span>
          Quick Add Event
        </button>
      </div>

      {/* Hero Quick Stats */}
      <section className="relative overflow-hidden rounded-2xl p-6 glass-card flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h2
            className="text-headline-md font-semibold text-[#dde4e1]"
            style={{ fontFamily: 'Geist, sans-serif' }}
          >
            Family Life Schedule
          </h2>
          <p className="text-body-sm mt-1" style={{ color: '#859490' }}>
            Organizing the pulses and milestones of the Neralla residence.
          </p>
        </div>
        <div className="flex gap-4 w-full md:w-auto">
          <div className="bg-white/5 p-4 rounded-xl border border-white/5 backdrop-blur-md flex-1 md:flex-initial">
            <div className="flex items-center gap-1.5 text-[#4fdbc8] mb-1">
              <span className="material-symbols-outlined text-[18px]">cake</span>
              <span className="text-label-sm">BIRTHDAYS</span>
            </div>
            <div className="text-2xl font-bold text-[#dde4e1]">
              {events.filter((e) => e.type === 'birthday').length / 3} Active
            </div>
          </div>
          <div className="bg-white/5 p-4 rounded-xl border border-white/5 backdrop-blur-md flex-1 md:flex-initial">
            <div className="flex items-center gap-1.5 text-[#ffb59e] mb-1">
              <span className="material-symbols-outlined text-[18px]">medical_information</span>
              <span className="text-label-sm">APPOINTMENTS</span>
            </div>
            <div className="text-2xl font-bold text-[#dde4e1]">
              {events.filter((e) => e.type === 'medical' && new Date(e.start_at) >= new Date()).length} Coming
            </div>
          </div>
        </div>
      </section>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Filters Side panel */}
        <aside className="lg:col-span-3 space-y-6">
          {/* Family Filter */}
          <div className="glass-card rounded-2xl p-5 space-y-4">
            <h3
              className="font-semibold text-xs tracking-wider uppercase"
              style={{ color: '#859490', fontFamily: 'Geist, sans-serif' }}
            >
              Filter by Member
            </h3>
            <div className="space-y-2.5">
              <label className="flex items-center justify-between cursor-pointer group">
                <span className="text-body-sm text-[#dde4e1] group-hover:text-[#4fdbc8] transition-colors">All Members</span>
                <input
                  type="checkbox"
                  checked={selectedMemberFilters.includes('all')}
                  onChange={() => handleToggleMemberFilter('all')}
                  className="rounded border-white/10 bg-transparent text-[#4fdbc8] focus:ring-[#4fdbc8]/20 h-4 w-4"
                />
              </label>

              {members.map((m) => {
                const isChecked = selectedMemberFilters.includes(m.id);
                return (
                  <label key={m.id} className="flex items-center justify-between cursor-pointer group">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#4fdbc8]" />
                      <span className="text-body-sm text-[#bbcac6] group-hover:text-[#4fdbc8] transition-colors">
                        {m.full_name}
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => handleToggleMemberFilter(m.id)}
                      className="rounded border-white/10 bg-transparent text-[#4fdbc8] focus:ring-[#4fdbc8]/20 h-4 w-4"
                    />
                  </label>
                );
              })}

              <label className="flex items-center justify-between cursor-pointer group">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-white/40" />
                  <span className="text-body-sm text-[#bbcac6] group-hover:text-white transition-colors">Global Events</span>
                </div>
                <input
                  type="checkbox"
                  checked={selectedMemberFilters.includes('global')}
                  onChange={() => handleToggleMemberFilter('global')}
                  className="rounded border-white/10 bg-transparent text-[#4fdbc8] focus:ring-[#4fdbc8]/20 h-4 w-4"
                />
              </label>
            </div>
          </div>

          {/* Category Filter */}
          <div className="glass-card rounded-2xl p-5 space-y-4">
            <h3
              className="font-semibold text-xs tracking-wider uppercase"
              style={{ color: '#859490', fontFamily: 'Geist, sans-serif' }}
            >
              Filter by Category
            </h3>
            <div className="space-y-2">
              <div
                onClick={() => handleToggleCategoryFilter('all')}
                className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/5 cursor-pointer transition-colors"
                style={{
                  background: selectedCategoryFilters.includes('all') ? 'rgba(79, 219, 200, 0.08)' : 'transparent',
                }}
              >
                <div className="w-3.5 h-3.5 rounded bg-white/20" />
                <span className="text-body-sm text-[#dde4e1]">All Categories</span>
              </div>

              {EVENT_CATEGORIES.map((cat) => {
                const isSelected = selectedCategoryFilters.includes(cat.id);
                return (
                  <div
                    key={cat.id}
                    onClick={() => handleToggleCategoryFilter(cat.id)}
                    className="flex items-center justify-between px-3 py-2 rounded-xl hover:bg-white/5 cursor-pointer transition-colors"
                    style={{
                      background: isSelected ? 'rgba(79, 219, 200, 0.08)' : 'transparent',
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className="material-symbols-outlined text-[16px]"
                        style={{ color: cat.color }}
                      >
                        {cat.icon}
                      </span>
                      <span className="text-body-sm text-[#bbcac6]">{cat.label}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </aside>

        {/* Central Calendar View */}
        <section className="lg:col-span-6 space-y-4">
          <div className="glass-card rounded-2xl overflow-hidden flex flex-col min-h-[600px] border border-white/10">
            {/* Calendar Header */}
            <div className="p-4 flex flex-col sm:flex-row justify-between items-center border-b border-white/10 gap-3">
              <div className="flex items-center gap-3">
                <h3
                  className="text-headline-sm font-semibold text-[#dde4e1]"
                  style={{ fontFamily: 'Geist, sans-serif' }}
                >
                  {MONTH_NAMES[month]} {year}
                </h3>
                <div className="flex border border-white/10 rounded-lg overflow-hidden">
                  <button
                    onClick={handlePrevMonth}
                    className="p-1.5 hover:bg-white/5 border-r border-white/10 transition-colors text-[#bbcac6]"
                  >
                    <span className="material-symbols-outlined text-[16px]">chevron_left</span>
                  </button>
                  <button
                    onClick={handleNextMonth}
                    className="p-1.5 hover:bg-white/5 transition-colors text-[#bbcac6]"
                  >
                    <span className="material-symbols-outlined text-[16px]">chevron_right</span>
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleToday}
                  className="px-3.5 py-1.5 rounded-lg text-label-sm border border-white/10 hover:bg-white/5 text-[#bbcac6]"
                >
                  Today
                </button>
                <div className="flex gap-1 bg-white/5 p-1 rounded-lg">
                  <button
                    onClick={() => setViewMode('month')}
                    className={`px-3 py-1 rounded-md text-label-sm transition-all ${
                      viewMode === 'month' ? 'bg-[#14b8a6] text-[#003731] font-bold' : 'text-[#bbcac6] hover:bg-white/5'
                    }`}
                  >
                    Month
                  </button>
                  <button
                    onClick={() => setViewMode('agenda')}
                    className={`px-3 py-1 rounded-md text-label-sm transition-all ${
                      viewMode === 'agenda' ? 'bg-[#14b8a6] text-[#003731] font-bold' : 'text-[#bbcac6] hover:bg-white/5'
                    }`}
                  >
                    Agenda
                  </button>
                </div>
              </div>
            </div>

            {loading ? (
              <div className="flex-1 flex flex-col items-center justify-center p-12 text-[#859490]">
                <span className="material-symbols-outlined animate-spin text-[36px] mb-2 text-[#4fdbc8]">
                  progress_activity
                </span>
                <p className="text-body-md">Retrieving schedule records...</p>
              </div>
            ) : viewMode === 'month' ? (
              <div className="flex-1 flex flex-col">
                {/* Days header */}
                <div className="grid grid-cols-7 border-b border-white/5 text-center text-label-sm text-[#859490] py-2">
                  <div>SUN</div>
                  <div>MON</div>
                  <div>TUE</div>
                  <div>WED</div>
                  <div>THU</div>
                  <div>FRI</div>
                  <div>SAT</div>
                </div>

                {/* Days grid */}
                <div className="grid grid-cols-7 flex-1">
                  {daysGrid.map((cell, idx) => {
                    const dayEvents = getEventsForDay(cell.date);
                    const isTodayCell = isToday(cell.date);
                    const isSelectedCell = isSelected(cell.date);

                    return (
                      <div
                        key={idx}
                        onClick={() => setSelectedDate(cell.date)}
                        className={`min-h-[90px] p-1.5 border-r border-b border-white/5 cursor-pointer hover:bg-white/5 transition-all flex flex-col justify-between ${
                          !cell.isCurrentMonth ? 'opacity-30 bg-white/[0.01]' : ''
                        } ${isSelectedCell ? 'bg-[#14b8a6]/5 border-2 border-[#14b8a6]/40' : ''}`}
                      >
                        <div className="flex justify-between items-center">
                          <span
                            className={`text-label-sm font-bold w-6 h-6 flex items-center justify-center rounded-full ${
                              isTodayCell
                                ? 'bg-[#4fdbc8] text-[#003731]'
                                : cell.isCurrentMonth
                                ? 'text-[#dde4e1]'
                                : 'text-[#859490]'
                            }`}
                          >
                            {cell.dayNum}
                          </span>
                        </div>

                        {/* Events list inside cell */}
                        <div className="mt-1 flex-1 overflow-y-auto space-y-1 custom-scrollbar max-h-[70px]">
                          {dayEvents.slice(0, 3).map((ev) => {
                            const cat = EVENT_CATEGORIES.find((c) => c.id === ev.type) || EVENT_CATEGORIES[5];
                            return (
                              <div
                                key={ev.id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenDetail(ev);
                                }}
                                className={`px-1.5 py-0.5 rounded text-[10px] truncate border ${cat.bgClass}`}
                                title={ev.title}
                              >
                                {ev.title}
                              </div>
                            );
                          })}
                          {dayEvents.length > 3 && (
                            <div className="text-[9px] text-[#4fdbc8] text-center font-bold">
                              + {dayEvents.length - 3} more
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="flex-1 p-5 space-y-4 overflow-y-auto max-h-[500px]">
                <h4 className="text-headline-sm font-semibold border-b border-white/5 pb-2 text-[#dde4e1]">
                  Chronological Agenda
                </h4>
                {filteredEvents.length === 0 ? (
                  <div className="text-center py-12 text-[#859490] text-body-md">
                    No events match your current filter selections.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredEvents
                      .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime())
                      .map((ev) => {
                        const dateStr = formatDate(ev.start_at);
                        const cat = EVENT_CATEGORIES.find((c) => c.id === ev.type) || EVENT_CATEGORIES[5];
                        return (
                          <div
                            key={ev.id}
                            onClick={() => handleOpenDetail(ev)}
                            className="p-3 bg-white/5 rounded-xl border border-white/10 hover:border-[#4fdbc8]/30 transition-all cursor-pointer flex justify-between items-center gap-3"
                          >
                            <div className="flex items-center gap-3">
                              <div
                                className="w-10 h-10 rounded-xl flex items-center justify-center"
                                style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${cat.color}25` }}
                              >
                                <span className="material-symbols-outlined" style={{ color: cat.color }}>
                                  {cat.icon}
                                </span>
                              </div>
                              <div>
                                <h5 className="font-semibold text-sm text-[#dde4e1]">{ev.title}</h5>
                                <p className="text-xs text-[#859490] mt-0.5">{dateStr}</p>
                              </div>
                            </div>
                            <span className="material-symbols-outlined text-[#859490] text-[18px]">
                              chevron_right
                            </span>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        {/* Agenda details panel */}
        <aside className="lg:col-span-3 space-y-6">
          {/* Selected day events */}
          <div className="glass-card rounded-2xl p-5 space-y-4">
            <div className="flex justify-between items-center border-b border-white/5 pb-2">
              <h3
                className="font-semibold text-xs tracking-wider uppercase text-[#859490]"
                style={{ fontFamily: 'Geist, sans-serif' }}
              >
                Schedule Details
              </h3>
              <span className="text-label-sm text-[#4fdbc8] font-bold">
                {selectedDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
              </span>
            </div>

            {selectedDayEvents.length === 0 ? (
              <div className="py-6 text-center text-body-sm text-[#859490]">
                No events scheduled for this date.
                <button
                  onClick={() => handleOpenAddModal(selectedDate)}
                  className="mt-3 block mx-auto text-xs text-[#4fdbc8] hover:underline font-semibold"
                >
                  + Add Event
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {selectedDayEvents.map((ev) => {
                  const cat = EVENT_CATEGORIES.find((c) => c.id === ev.type) || EVENT_CATEGORIES[5];
                  const timeStr = ev.all_day
                    ? 'All Day'
                    : new Date(ev.start_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

                  return (
                    <div
                      key={ev.id}
                      onClick={() => handleOpenDetail(ev)}
                      className="p-3 bg-white/5 hover:bg-white/[0.07] rounded-xl border border-white/5 cursor-pointer transition-all flex flex-col gap-1.5"
                    >
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-[14px]" style={{ color: cat.color }}>
                          {cat.icon}
                        </span>
                        <span className="text-xs text-[#859490]">{timeStr}</span>
                      </div>
                      <h4 className="font-semibold text-body-sm text-[#dde4e1] leading-tight">{ev.title}</h4>
                      {ev.description && (
                        <p className="text-[11px] text-[#859490] line-clamp-2 leading-relaxed">{ev.description}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Security badge */}
          <div className="rounded-2xl p-5 bg-[#1a211f]/60 border border-white/5 text-center flex flex-col items-center">
            <span
              className="material-symbols-outlined text-[#4fdbc8] text-[36px] mb-2"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              encrypted
            </span>
            <h4
              className="font-bold text-xs uppercase text-[#dde4e1]"
              style={{ fontFamily: 'Geist, sans-serif' }}
            >
              End-to-End Encrypted
            </h4>
            <p className="text-[10px] text-[#859490] mt-1 leading-relaxed">
              Your family life events are locked inside the secure local Nexus Vault.
            </p>
          </div>
        </aside>
      </div>

      {/* ADD / EDIT MODAL */}
      <NexusModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title={isEditing ? 'Edit Calendar Event' : 'Create Family Event'}
        description={isEditing ? 'Modify custom family event parameters' : 'Schedule a new event for the family command timeline'}
      >
        <form onSubmit={handleSaveEvent} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-label-sm text-[#bbcac6]">Event Title</label>
            <input
              type="text"
              required
              placeholder="e.g. Liam's Soccer Game"
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-white/10 bg-transparent text-[#dde4e1] placeholder:text-[#859490]/50 focus:border-[#4fdbc8] focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-label-sm text-[#bbcac6]">Category</label>
              <select
                value={formType}
                onChange={(e) => setFormType(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-white/10 bg-[#161d1b] text-[#dde4e1] focus:border-[#4fdbc8] focus:outline-none"
              >
                <option value="reminder">Reminder</option>
                <option value="trip">Trip & Event</option>
                <option value="birthday">Birthday</option>
                <option value="medical">Medical</option>
                <option value="policy_renewal">Policy Renewal</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div className="space-y-1.5 flex flex-col justify-end pb-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formAllDay}
                  onChange={(e) => setFormAllDay(e.target.checked)}
                  className="rounded border-white/10 bg-transparent text-[#4fdbc8] focus:ring-[#4fdbc8]/20 h-4 w-4"
                />
                <span className="text-body-sm text-[#bbcac6]">All Day Event</span>
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-label-sm text-[#bbcac6]">Start Date & Time</label>
              <input
                type="datetime-local"
                required
                value={formStart}
                onChange={(e) => setFormStart(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-white/10 bg-transparent text-[#dde4e1] focus:border-[#4fdbc8] focus:outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-label-sm text-[#bbcac6]">End Date & Time (Optional)</label>
              <input
                type="datetime-local"
                value={formEnd}
                onChange={(e) => setFormEnd(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-white/10 bg-transparent text-[#dde4e1] focus:border-[#4fdbc8] focus:outline-none"
              />
            </div>
          </div>

          {/* Members Tagging */}
          <div className="space-y-1.5">
            <label className="text-label-sm text-[#bbcac6]">Involve Family Members</label>
            <div className="flex flex-wrap gap-2 pt-1">
              {members.map((m) => {
                const isTagged = formMembers.includes(m.id);
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => handleToggleFormMember(m.id)}
                    className="px-3.5 py-1.5 rounded-full text-xs font-medium border transition-all flex items-center gap-1.5"
                    style={{
                      background: isTagged ? 'rgba(79, 219, 200, 0.1)' : 'transparent',
                      borderColor: isTagged ? '#4fdbc8' : 'rgba(255,255,255,0.08)',
                      color: isTagged ? '#4fdbc8' : '#bbcac6',
                    }}
                  >
                    {isTagged && <span className="material-symbols-outlined text-[12px]">check</span>}
                    {m.full_name}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-label-sm text-[#bbcac6]">Description / Notes</label>
            <textarea
              placeholder="Provide details or logistics..."
              value={formDesc}
              onChange={(e) => setFormDesc(e.target.value)}
              rows={3}
              className="w-full px-4 py-3 rounded-xl border border-white/10 bg-transparent text-[#dde4e1] placeholder:text-[#859490]/50 focus:border-[#4fdbc8] focus:outline-none resize-none"
            />
          </div>

          <div className="flex items-center gap-3 pt-4 border-t border-white/5">
            <button
              type="button"
              onClick={() => setShowAddModal(false)}
              className="flex-1 py-3 rounded-xl font-medium border border-white/10 text-[#bbcac6] hover:bg-white/5 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex-1 py-3 bg-gradient-to-br from-[#14b8a6] to-[#0566d9] text-white font-semibold rounded-xl flex items-center justify-center gap-2 hover:brightness-110 disabled:opacity-50 transition-all shadow-lg"
            >
              {isPending ? (
                <>
                  <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
                  Saving...
                </>
              ) : (
                'Save Event'
              )}
            </button>
          </div>
        </form>
      </NexusModal>

      {/* DETAIL MODAL */}
      <NexusModal
        isOpen={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        title={selectedEvent?.title}
      >
        {selectedEvent && (
          <div className="space-y-5">
            <div className="flex items-center gap-2 pb-3 border-b border-white/5">
              <span
                className="material-symbols-outlined text-[20px]"
                style={{
                  color: (EVENT_CATEGORIES.find((c) => c.id === selectedEvent.type) || EVENT_CATEGORIES[5]).color,
                }}
              >
                {(EVENT_CATEGORIES.find((c) => c.id === selectedEvent.type) || EVENT_CATEGORIES[5]).icon}
              </span>
              <span className="text-body-sm text-[#859490]">
                {selectedEvent.all_day
                  ? 'All Day Event'
                  : `${new Date(selectedEvent.start_at).toLocaleTimeString('en-IN', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}`}
              </span>
              <span className="mx-2 text-white/10">•</span>
              <span className="text-body-sm text-[#859490] font-medium">
                {formatDate(selectedEvent.start_at)}
              </span>
            </div>

            {selectedEvent.description && (
              <div className="space-y-1.5">
                <h5 className="text-xs font-bold uppercase tracking-wider text-[#859490]">Details</h5>
                <p className="text-body-sm text-[#bbcac6] leading-relaxed whitespace-pre-wrap">
                  {selectedEvent.description}
                </p>
              </div>
            )}

            {/* Tagged Members in detail view */}
            {selectedEvent.members && selectedEvent.members.length > 0 && (
              <div className="space-y-2">
                <h5 className="text-xs font-bold uppercase tracking-wider text-[#859490]">Tagged Members</h5>
                <div className="flex flex-wrap gap-2">
                  {selectedEvent.members.map((mId: string) => {
                    const member = members.find((m) => m.id === mId);
                    if (!member) return null;
                    return (
                      <span
                        key={mId}
                        className="px-3 py-1 rounded-full text-xs bg-white/5 border border-white/10 text-[#dde4e1]"
                      >
                        {member.full_name}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Source module routing link */}
            {selectedEvent.sourceModule && selectedEvent.sourceModule !== 'calendar' && (
              <div className="p-4 bg-white/[0.02] border border-white/5 rounded-2xl flex justify-between items-center">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-[#859490]">Generated Event</p>
                  <p className="text-xs text-[#bbcac6] mt-0.5">
                    This event is automatically synced from the **{selectedEvent.sourceModule}** module.
                  </p>
                </div>
                <Link
                  href={`/${selectedEvent.sourceModule}`}
                  className="px-4 py-2 bg-[#14b8a6]/10 text-[#4fdbc8] border border-[#14b8a6]/20 rounded-xl text-xs font-bold hover:bg-[#14b8a6]/20 transition-all"
                >
                  View Module
                </Link>
              </div>
            )}

            {/* Actions (Only editable if custom calendar source) */}
            <div className="flex items-center gap-3 pt-5 border-t border-white/5">
              {(!selectedEvent.sourceModule || selectedEvent.sourceModule === 'calendar') ? (
                <>
                  <button
                    onClick={handleDeleteClick}
                    className="px-4 py-3 rounded-xl border border-red-500/20 text-red-400 hover:bg-red-500/5 transition-colors font-medium flex-1"
                  >
                    Delete Event
                  </button>
                  <button
                    onClick={() => handleOpenEdit(selectedEvent)}
                    className="px-4 py-3 bg-[#14b8a6]/10 text-[#4fdbc8] border border-[#14b8a6]/20 hover:bg-[#14b8a6]/20 rounded-xl font-bold flex-1"
                  >
                    Edit Event
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="w-full py-3 bg-[#1a211f] border border-white/10 text-[#bbcac6] rounded-xl font-medium"
                >
                  Close Detail view
                </button>
              )}
            </div>
          </div>
        )}
      </NexusModal>

      {/* DELETE CONFIRM MODAL */}
      <NexusConfirm
        isOpen={showDeleteConfirm}
        title="Delete Event"
        description="Are you absolutely sure you want to delete this calendar event? This action is permanent and cannot be undone."
        confirmText="Yes, Delete"
        cancelText="No, Keep"
        onConfirm={handleConfirmDelete}
        onCancel={() => setShowDeleteConfirm(false)}
        variant="danger"
        loading={isPending}
      />
    </div>
  );
}
