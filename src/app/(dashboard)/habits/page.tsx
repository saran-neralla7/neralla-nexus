'use client';

import React, { useEffect, useState, useTransition } from 'react';
import { useUser } from '@/hooks/useUser';
import { toast } from 'sonner';
import {
  fetchHabits,
  createHabit,
  toggleHabitLog,
  deleteHabit
} from './actions';
import { fetchFamilyMembersForExpenses } from '../finance/actions';
import NexusModal from '@/components/nexus/NexusModal';
import NexusConfirm from '@/components/nexus/NexusConfirm';

export default function HabitsPage() {
  const { user } = useUser();
  const [habits, setHabits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  // Owner family view states
  const [members, setMembers] = useState<any[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState<string>('');

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [habitToDelete, setHabitToDelete] = useState<any | null>(null);

  // Form states
  const [newHabitName, setNewHabitName] = useState('');
  const [newHabitDesc, setNewHabitDesc] = useState('');
  const [newHabitFreq, setNewHabitFreq] = useState('daily');

  // Load initial habits & members
  useEffect(() => {
    if (user) {
      setSelectedMemberId(user.id);
      loadHabits(user.id);

      // If user is owner/admin, fetch family members
      if (user.role === 'owner' || user.role === 'admin') {
        loadFamilyMembers();
      }
    }
  }, [user]);

  const loadHabits = async (memberId: string) => {
    try {
      setLoading(true);
      const data = await fetchHabits(memberId);
      setHabits(data || []);
    } catch (err: any) {
      toast.error(err.message || 'Failed to fetch habits');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadFamilyMembers = async () => {
    try {
      const data = await fetchFamilyMembersForExpenses();
      setMembers(data || []);
    } catch (err) {
      console.error('Failed to load family members:', err);
    }
  };

  const handleMemberChange = (memberId: string) => {
    setSelectedMemberId(memberId);
    loadHabits(memberId);
  };

  const handleToggleLog = async (habitId: string, date: string, currentLogged: boolean) => {
    // Regular members can only log their own habits
    if (selectedMemberId !== user?.id) {
      toast.error('You can only log completions for your own habits.');
      return;
    }

    try {
      const targetState = !currentLogged;
      await toggleHabitLog(habitId, date, targetState);
      
      // Update local state instantly
      setHabits(prevHabits =>
        prevHabits.map(h => {
          if (h.id === habitId) {
            const updatedLogs = targetState
              ? [...h.logs, date]
              : h.logs.filter((d: string) => d !== date);
            return { ...h, logs: updatedLogs };
          }
          return h;
        })
      );
      toast.success(targetState ? 'Habit completed!' : 'Habit log removed.');
    } catch (err: any) {
      toast.error(err.message || 'Failed to log habit');
    }
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHabitName) {
      toast.error('Habit name is required');
      return;
    }

    startTransition(async () => {
      try {
        await createHabit(newHabitName, newHabitDesc, newHabitFreq);
        toast.success(`Habit "${newHabitName}" created!`);
        setShowAddModal(false);
        setNewHabitName('');
        setNewHabitDesc('');
        setNewHabitFreq('daily');
        loadHabits(selectedMemberId);
      } catch (err: any) {
        toast.error(err.message || 'Failed to create habit');
      }
    });
  };

  const handleDelete = async () => {
    if (!habitToDelete) return;
    startTransition(async () => {
      try {
        await deleteHabit(habitToDelete.id);
        toast.success('Habit deleted.');
        setShowDeleteConfirm(false);
        setHabitToDelete(null);
        loadHabits(selectedMemberId);
      } catch (err: any) {
        toast.error(err.message || 'Failed to delete habit');
      }
    });
  };

  // Helper to generate last 30 days dates
  const getLast30Days = () => {
    const dates = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      dates.push(d.toISOString().split('T')[0]);
    }
    return dates;
  };

  const calculateStreak = (logs: string[]) => {
    let currentStreak = 0;
    const sortedLogs = [...logs].sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
    
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    // If no logs or hasn't logged today or yesterday, streak is 0
    if (sortedLogs.length === 0 || (!sortedLogs.includes(today) && !sortedLogs.includes(yesterday))) {
      return 0;
    }

    let checkDate = sortedLogs.includes(today) ? new Date(today) : new Date(yesterday);

    while (true) {
      const dateStr = checkDate.toISOString().split('T')[0];
      if (sortedLogs.includes(dateStr)) {
        currentStreak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }

    return currentStreak;
  };

  const dates = getLast30Days();
  const isOwner = user?.role === 'owner' || user?.role === 'admin';

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 md:p-8 text-[#dde4e1]">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl premium-gradient flex items-center justify-center text-white">
              <span className="material-symbols-outlined text-[28px]">insights</span>
            </div>
            <div>
              <h1 className="text-headline-md font-bold tracking-tight text-white">Habit Tracker</h1>
              <p className="text-body-sm text-[#859490]">Build consistency and monitor your personal daily routines</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Owner Selector */}
          {isOwner && members.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-body-sm text-[#859490]">Viewing:</span>
              <select
                value={selectedMemberId}
                onChange={(e) => handleMemberChange(e.target.value)}
                className="input-glass px-3 py-2.5 rounded-xl text-body-sm bg-[#161d1b] text-white"
              >
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.id === user?.id ? 'Me' : m.full_name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Add Habit Button */}
          {selectedMemberId === user?.id && (
            <button
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-semibold bg-[#4fdbc8] text-black hover:brightness-110 shadow-lg shadow-[#4fdbc8]/15 transition-all"
            >
              <span className="material-symbols-outlined text-[20px]">add</span>
              Create Habit
            </button>
          )}
        </div>
      </div>

      {/* Habits Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-pulse">
          <div className="h-[220px] bg-white/[0.02] border border-white/5 rounded-2xl" />
          <div className="h-[220px] bg-white/[0.02] border border-white/5 rounded-2xl" />
        </div>
      ) : habits.length === 0 ? (
        <div className="glass-card rounded-2xl p-12 text-center border border-white/5 bg-white/[0.01]">
          <span className="material-symbols-outlined text-[48px] text-[#859490] mb-3">checklist</span>
          <p className="text-body-md font-semibold text-white">No habits configured yet</p>
          <p className="text-body-sm text-[#859490] mt-1">
            {selectedMemberId === user?.id 
              ? 'Create a routine habit to begin tracking your streaks.'
              : 'This member has not created any habits.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {habits.map((habit) => {
            const streak = calculateStreak(habit.logs);
            const todayStr = new Date().toISOString().split('T')[0];
            const isLoggedToday = habit.logs.includes(todayStr);

            return (
              <div key={habit.id} className="glass-card rounded-2xl p-6 border border-white/5 bg-white/[0.02] relative group">
                
                {/* Habit Header */}
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-headline-sm font-semibold text-white group-hover:text-[#4fdbc8] transition-colors">
                      {habit.name}
                    </h3>
                    <p className="text-body-sm text-[#bbcac6] mt-1">{habit.description || 'No description provided'}</p>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    {/* Streak Badge */}
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400">
                      <span className="material-symbols-outlined text-[16px] fill-current">local_fire_department</span>
                      <span className="text-label-sm font-bold">{streak}d streak</span>
                    </div>

                    {/* Delete Icon */}
                    {(habit.user_id === user?.id || isOwner) && (
                      <button
                        onClick={() => {
                          setHabitToDelete(habit);
                          setShowDeleteConfirm(true);
                        }}
                        className="p-1.5 rounded-lg border border-white/5 hover:border-red-500/20 text-[#859490] hover:text-red-400 hover:bg-red-500/5 transition-all"
                      >
                        <span className="material-symbols-outlined text-[18px]">delete</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Log Tracker Checkbox for Today */}
                <div className="mt-6 flex items-center justify-between p-4 rounded-xl bg-white/[0.02] border border-white/5">
                  <div className="flex flex-col">
                    <span className="text-label-md font-bold text-white">Mark Complete Today</span>
                    <span className="text-body-sm text-[#859490] mt-0.5">Toggle box to record today's habit completion</span>
                  </div>
                  <button
                    onClick={() => handleToggleLog(habit.id, todayStr, isLoggedToday)}
                    disabled={selectedMemberId !== user?.id}
                    className={`w-10 h-10 rounded-xl flex items-center justify-center border transition-all ${
                      isLoggedToday
                        ? 'bg-[#4fdbc8] border-[#4fdbc8] text-black shadow-lg shadow-[#4fdbc8]/15'
                        : 'bg-white/5 border-white/10 text-white/20 hover:border-white/20 hover:text-white/40'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[22px] font-bold">check</span>
                  </button>
                </div>

                {/* Streak Grid - Last 30 Days */}
                <div className="mt-6 space-y-2">
                  <h4 className="text-label-sm text-[#859490] uppercase tracking-wider">Last 30 Days History</h4>
                  <div className="grid grid-cols-10 gap-2">
                    {dates.map((dateStr) => {
                      const isLogged = habit.logs.includes(dateStr);
                      const isToday = dateStr === todayStr;
                      const dateObj = new Date(dateStr);
                      const displayLabel = dateObj.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
                      
                      return (
                        <div
                          key={dateStr}
                          title={`${displayLabel}: ${isLogged ? 'Completed' : 'Missed'}`}
                          className={`aspect-square rounded-lg flex items-center justify-center text-[9px] font-bold border transition-all ${
                            isLogged
                              ? 'bg-[#4fdbc8]/15 border-[#4fdbc8]/35 text-[#4fdbc8]'
                              : isToday
                              ? 'border-white/30 text-white/50 bg-white/5'
                              : 'bg-white/[0.02] border-white/5 text-white/20'
                          }`}
                        >
                          {dateObj.getDate()}
                        </div>
                      );
                    })}
                  </div>
                </div>

              </div>
            );
          })}
        </div>
      )}

      {/* Add Habit Modal */}
      <NexusModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Create New Habit"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="space-y-1">
            <label className="text-body-sm text-[#bbcac6]">Habit Name *</label>
            <input
              type="text"
              value={newHabitName}
              onChange={(e) => setNewHabitName(e.target.value)}
              placeholder="e.g. Read Books, Evening Walk, Drink Water"
              className="w-full input-glass px-3 py-2.5 rounded-xl text-body-sm text-white"
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-body-sm text-[#bbcac6]">Description / Notes</label>
            <textarea
              value={newHabitDesc}
              onChange={(e) => setNewHabitDesc(e.target.value)}
              placeholder="e.g. 15 pages of non-fiction, 30 minutes in park"
              rows={3}
              className="w-full input-glass px-3 py-2.5 rounded-xl text-body-sm text-white resize-none"
            />
          </div>

          <div className="space-y-1">
            <label className="text-body-sm text-[#bbcac6]">Target Frequency</label>
            <select
              value={newHabitFreq}
              onChange={(e) => setNewHabitFreq(e.target.value)}
              className="w-full input-glass px-3 py-2.5 rounded-xl text-body-sm bg-[#161d1b] text-white"
            >
              <option value="daily">Daily Habit</option>
              <option value="weekly">Weekly Routine</option>
            </select>
          </div>

          <div className="flex gap-4 pt-4 border-t border-white/5">
            <button
              type="button"
              onClick={() => setShowAddModal(false)}
              className="flex-1 py-3 rounded-xl border border-white/5 hover:border-white/10 hover:bg-white/[0.02] text-body-sm font-semibold transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex-1 py-3 rounded-xl bg-[#4fdbc8] text-black font-semibold text-body-sm hover:brightness-110 shadow-lg shadow-[#4fdbc8]/15 transition-all"
            >
              {isPending ? 'Creating...' : 'Create Habit'}
            </button>
          </div>
        </form>
      </NexusModal>

      {/* Delete Habit Confirmation */}
      <NexusConfirm
        isOpen={showDeleteConfirm}
        title="Delete Routine Habit?"
        description={`Are you sure you want to permanently delete "${habitToDelete?.name}"? All calendar streaks and records for this habit will be lost.`}
        confirmText="Delete Habit"
        cancelText="Cancel"
        onConfirm={handleDelete}
        onCancel={() => {
          setShowDeleteConfirm(false);
          setHabitToDelete(null);
        }}
        variant="danger"
        loading={isPending}
      />

    </div>
  );
}
