'use client';

import React, { useEffect, useState, useTransition } from 'react';
import { useUser } from '@/hooks/useUser';
import { toast } from 'sonner';
import {
  fetchExpenses,
  createExpense,
  deleteExpense,
  fetchFamilyMembersForExpenses,
  fetchSettlements
} from './actions';
import NexusModal from '@/components/nexus/NexusModal';
import NexusConfirm from '@/components/nexus/NexusConfirm';
import { formatDate } from '@/lib/utils';

export default function FinancePage() {
  const { user } = useUser();
  const [activeTab, setActiveTab] = useState<'solo' | 'common'>('solo');
  const [expenses, setExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  // Family members list
  const [members, setMembers] = useState<any[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState<string>('');

  // Settlement results
  const [balances, setBalances] = useState<any[]>([]);
  const [settlements, setSettlements] = useState<any[]>([]);

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [expenseToDelete, setExpenseToDelete] = useState<any | null>(null);

  // Form states
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('other');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [payerId, setPayerId] = useState('');

  // Participant selection states (for Shared Tab)
  const [selectedParticipantIds, setSelectedParticipantIds] = useState<string[]>([]);
  const [customGuests, setCustomGuests] = useState<string[]>([]);
  const [newGuestName, setNewGuestName] = useState('');

  // Initial load
  useEffect(() => {
    if (user) {
      setSelectedMemberId(user.id);
      setPayerId(user.id);
      loadExpenses(activeTab, user.id);
      loadFamilyMembers();
    }
  }, [user, activeTab]);

  const loadExpenses = async (tab: 'solo' | 'common', memberId: string) => {
    try {
      setLoading(true);
      const data = await fetchExpenses(tab, memberId);
      setExpenses(data || []);

      if (tab === 'common') {
        const setts = await fetchSettlements();
        setBalances(setts.balances || []);
        setSettlements(setts.settlements || []);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to fetch expenses');
    } finally {
      setLoading(false);
    }
  };

  const loadFamilyMembers = async () => {
    try {
      const data = await fetchFamilyMembersForExpenses();
      setMembers(data || []);
      // Check all family members by default for shared split
      setSelectedParticipantIds(data.map((m: any) => m.id));
    } catch (err) {
      console.error('Failed to load family members:', err);
    }
  };

  const handleMemberChange = (memberId: string) => {
    setSelectedMemberId(memberId);
    loadExpenses('solo', memberId);
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    const payload: any = {
      amount: parsedAmount,
      category,
      description,
      date,
      type: activeTab,
      paid_by: activeTab === 'solo' ? user?.id : payerId,
    };

    if (activeTab === 'common') {
      const parts = [
        ...selectedParticipantIds.map((id) => ({ userId: id })),
        ...customGuests.map((name) => ({ customName: name })),
      ];

      if (parts.length === 0) {
        toast.error('Please select or add at least one participant');
        return;
      }
      payload.participants = parts;
    }

    startTransition(async () => {
      try {
        await createExpense(payload);
        toast.success(`Expense of ₹${parsedAmount} logged!`);
        setShowAddModal(false);
        resetForm();
        loadExpenses(activeTab, selectedMemberId);
      } catch (err: any) {
        toast.error(err.message || 'Failed to create expense');
      }
    });
  };

  const handleDelete = async () => {
    if (!expenseToDelete) return;
    startTransition(async () => {
      try {
        await deleteExpense(expenseToDelete.id);
        toast.success('Expense deleted.');
        setShowDeleteConfirm(false);
        setExpenseToDelete(null);
        loadExpenses(activeTab, selectedMemberId);
      } catch (err: any) {
        toast.error(err.message || 'Failed to delete expense');
      }
    });
  };

  const resetForm = () => {
    setAmount('');
    setCategory('other');
    setDescription('');
    setDate(new Date().toISOString().split('T')[0]);
    setPayerId(user?.id || '');
    setCustomGuests([]);
    setNewGuestName('');
    setSelectedParticipantIds(members.map((m) => m.id));
  };

  const handleAddGuest = () => {
    const trimmed = newGuestName.trim();
    if (!trimmed) return;
    if (customGuests.includes(trimmed)) {
      toast.error('Guest name already added');
      return;
    }
    setCustomGuests([...customGuests, trimmed]);
    setNewGuestName('');
  };

  const handleRemoveGuest = (index: number) => {
    setCustomGuests(customGuests.filter((_, i) => i !== index));
  };

  const handleToggleMemberParticipant = (id: string) => {
    if (selectedParticipantIds.includes(id)) {
      setSelectedParticipantIds(selectedParticipantIds.filter((mId) => mId !== id));
    } else {
      setSelectedParticipantIds([...selectedParticipantIds, id]);
    }
  };

  const isOwner = user?.role === 'owner' || user?.role === 'admin';
  const totalSoloSpend = expenses.reduce((sum, e) => sum + parseFloat(e.amount), 0);

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 md:p-8 text-[#dde4e1]">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl premium-gradient flex items-center justify-center text-white">
            <span className="material-symbols-outlined text-[28px]">payments</span>
          </div>
          <div>
            <h1 className="text-headline-md font-bold tracking-tight text-white">Expense Tracker</h1>
            <p className="text-body-sm text-[#859490]">Manage personal outlays and calculate shared splits for trips</p>
          </div>
        </div>

        <button
          onClick={() => { resetForm(); setShowAddModal(true); }}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-semibold bg-[#4fdbc8] text-black hover:brightness-110 shadow-lg shadow-[#4fdbc8]/15 transition-all self-start sm:self-auto"
        >
          <span className="material-symbols-outlined text-[20px]">add</span>
          Add Expense
        </button>
      </div>

      {/* Tabs Selector */}
      <div className="flex border-b border-white/5 gap-2">
        <button
          onClick={() => setActiveTab('solo')}
          className={`px-4 py-3 font-semibold text-body-sm transition-all border-b-2 ${
            activeTab === 'solo'
              ? 'border-[#4fdbc8] text-[#4fdbc8]'
              : 'border-transparent text-[#859490] hover:text-white'
          }`}
        >
          My Daily Expenses (Solo)
        </button>
        <button
          onClick={() => setActiveTab('common')}
          className={`px-4 py-3 font-semibold text-body-sm transition-all border-b-2 ${
            activeTab === 'common'
              ? 'border-[#4fdbc8] text-[#4fdbc8]'
              : 'border-transparent text-[#859490] hover:text-white'
          }`}
        >
          Trip / Shared Expenses
        </button>
      </div>

      {/* Primary Dashboard Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left 2 Columns: Lists and Ledgers */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Members filter for Solo daily expenses */}
          {activeTab === 'solo' && isOwner && members.length > 0 && (
            <div className="glass-card p-4 rounded-2xl border border-white/5 flex items-center justify-between">
              <span className="text-body-sm text-[#bbcac6]">Overseeing Member Daily Logs:</span>
              <select
                value={selectedMemberId}
                onChange={(e) => handleMemberChange(e.target.value)}
                className="input-glass px-3 py-2.5 rounded-xl text-body-sm bg-[#161d1b] text-white"
              >
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.id === user?.id ? 'Me (Personal)' : m.full_name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Expenses List */}
          <div className="glass-card rounded-2xl p-6 border border-white/5 bg-white/[0.02]">
            <h3 className="text-headline-sm font-semibold text-white mb-4">
              {activeTab === 'solo' ? 'Daily Expense History' : 'Shared Group Log'}
            </h3>

            {loading ? (
              <div className="space-y-4 animate-pulse">
                <div className="h-14 bg-white/[0.02] border border-white/5 rounded-xl" />
                <div className="h-14 bg-white/[0.02] border border-white/5 rounded-xl" />
              </div>
            ) : expenses.length === 0 ? (
              <div className="text-center py-12 text-[#859490]">
                <span className="material-symbols-outlined text-[48px] mb-3">receipt_long</span>
                <p className="text-body-md font-semibold">No expenses recorded</p>
                <p className="text-body-sm mt-1">Select "Add Expense" to log your first transaction.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {expenses.map((expense) => (
                  <div
                    key={expense.id}
                    className="flex items-center justify-between p-4 rounded-xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-[#4fdbc8]">
                        <span className="material-symbols-outlined text-[20px]">
                          {expense.category === 'groceries' ? 'shopping_basket' :
                           expense.category === 'utilities' ? 'bolt' :
                           expense.category === 'rent' ? 'real_estate_agent' :
                           expense.category === 'travel' ? 'flight' :
                           expense.category === 'entertainment' ? 'movie' : 'payments'}
                        </span>
                      </div>
                      <div>
                        <h4 className="text-body-sm font-semibold text-white">{expense.description || expense.category}</h4>
                        <div className="flex items-center gap-2 text-label-sm text-[#859490] mt-0.5">
                          <span>{formatDate(expense.date)}</span>
                          {expense.type === 'common' && (
                            <>
                              <span>•</span>
                              <span className="text-[#adc6ff]">Paid by {expense.payer?.full_name || 'Member'}</span>
                              <span>•</span>
                              <span className="text-orange-400">{expense.participants?.length || 0} split</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <span className="text-body-md font-bold text-[#4fdbc8]">₹{parseFloat(expense.amount).toFixed(2)}</span>
                      
                      {/* Delete */}
                      {(expense.paid_by === user?.id || isOwner) && (
                        <button
                          onClick={() => {
                            setExpenseToDelete(expense);
                            setShowDeleteConfirm(true);
                          }}
                          className="p-1 rounded-lg hover:bg-white/5 text-[#859490] hover:text-red-400 transition-colors"
                        >
                          <span className="material-symbols-outlined text-[18px]">delete</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* Right 1 Column: Settlement balances / Burn rate widget */}
        <div className="space-y-6">
          
          {activeTab === 'solo' ? (
            <div className="glass-card p-6 rounded-2xl border border-white/5 bg-white/[0.02] text-center space-y-4">
              <h3 className="text-label-md font-bold text-[#4fdbc8] uppercase tracking-wider">Daily Expense summary</h3>
              <div className="py-4">
                <span className="text-body-sm text-[#859490] block">Logged Spend</span>
                <span className="text-display-lg text-white font-bold block mt-1">₹{totalSoloSpend.toFixed(2)}</span>
              </div>
              <p className="text-body-sm text-[#bbcac6]">
                This is the total daily outlay calculated for {selectedMemberId === user?.id ? 'your account' : 'the selected member'}.
              </p>
            </div>
          ) : (
            <>
              {/* Balances Ledger */}
              <div className="glass-card p-6 rounded-2xl border border-white/5 bg-white/[0.02] space-y-4">
                <h3 className="text-label-md font-bold text-[#4fdbc8] uppercase tracking-wider">Balances Ledger</h3>
                
                <div className="space-y-3">
                  {balances.map((bal) => {
                    const isOwed = bal.balance > 0.01;
                    const isOwes = bal.balance < -0.01;
                    return (
                      <div key={bal.id} className="flex items-center justify-between text-body-sm py-1 border-b border-white/5 last:border-0">
                        <span className="text-[#dde4e1] font-medium">
                          {bal.name} {bal.isGuest && <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-white/50 ml-1">Guest</span>}
                        </span>
                        <span className={`font-bold ${isOwed ? 'text-teal-400' : isOwes ? 'text-red-400' : 'text-[#859490]'}`}>
                          {isOwed ? `+₹${bal.balance.toFixed(2)}` : isOwes ? `-₹${Math.abs(bal.balance).toFixed(2)}` : 'Settle'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Settlements Calculator */}
              <div className="glass-card p-6 rounded-2xl border border-white/5 bg-white/[0.02] space-y-4">
                <h3 className="text-label-md font-bold text-[#4fdbc8] uppercase tracking-wider">Calculated Settlements</h3>
                
                {settlements.length === 0 ? (
                  <p className="text-body-sm text-[#859490] text-center py-4">Everyone is fully settled!</p>
                ) : (
                  <div className="space-y-3">
                    {settlements.map((sett, idx) => (
                      <div key={idx} className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-1.5 text-body-sm">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-white">{sett.from.name}</span>
                          <span className="text-[#859490] text-xs">pays</span>
                          <span className="font-semibold text-white">{sett.to.name}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-[#4fdbc8] font-bold text-body-md">₹{sett.amount.toFixed(2)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

        </div>

      </div>

      {/* Add Expense Modal */}
      <NexusModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title={activeTab === 'solo' ? 'Add Personal Daily Expense' : 'Add Shared/Trip Expense'}
      >
        <form onSubmit={handleCreate} className="space-y-4">
          
          <div className="space-y-1">
            <label className="text-body-sm text-[#bbcac6]">Amount (₹) *</label>
            <input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="w-full input-glass px-3 py-2.5 rounded-xl text-body-sm text-white font-bold"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-body-sm text-[#bbcac6]">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full input-glass px-3 py-2.5 rounded-xl text-body-sm bg-[#161d1b] text-white"
              >
                <option value="groceries">Groceries</option>
                <option value="utilities">Utilities & Bills</option>
                <option value="travel">Travel & Trips</option>
                <option value="rent">Rent/Housing</option>
                <option value="entertainment">Entertainment</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-body-sm text-[#bbcac6]">Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full input-glass px-3 py-2.5 rounded-xl text-body-sm text-white"
                required
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-body-sm text-[#bbcac6]">Description / Notes *</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Flight to Goa, Dinner bill, Milk packet"
              className="w-full input-glass px-3 py-2.5 rounded-xl text-body-sm text-white"
              required
            />
          </div>

          {activeTab === 'common' && (
            <>
              {/* Who Paid */}
              <div className="space-y-1">
                <label className="text-body-sm text-[#bbcac6]">Paid By</label>
                <select
                  value={payerId}
                  onChange={(e) => setPayerId(e.target.value)}
                  className="w-full input-glass px-3 py-2.5 rounded-xl text-body-sm bg-[#161d1b] text-white"
                >
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>{m.full_name}</option>
                  ))}
                </select>
              </div>

              {/* Participants Selection */}
              <div className="space-y-2">
                <label className="text-body-sm text-[#bbcac6] block">Participating Members (Checkboxes)</label>
                <div className="grid grid-cols-2 gap-2 bg-white/[0.02] p-3 border border-white/5 rounded-xl">
                  {members.map((m) => {
                    const isChecked = selectedParticipantIds.includes(m.id);
                    return (
                      <label key={m.id} className="flex items-center gap-2 text-body-sm text-[#dde4e1] cursor-pointer py-1 select-none">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleMemberParticipant(m.id)}
                          className="rounded border-white/10 accent-[#4fdbc8] bg-[#1a211f] h-4 w-4"
                        />
                        <span>{m.full_name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Non-Member Guest Inputs */}
              <div className="space-y-2">
                <label className="text-body-sm text-[#bbcac6]">Add Non-Members / Guests</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newGuestName}
                    onChange={(e) => setNewGuestName(e.target.value)}
                    placeholder="Guest Name (e.g. Ramesh)"
                    className="flex-1 input-glass px-3 py-2 rounded-lg text-body-sm text-white"
                  />
                  <button
                    type="button"
                    onClick={handleAddGuest}
                    className="px-4 py-2 bg-white/5 border border-white/10 hover:bg-white/10 rounded-lg text-body-sm font-semibold transition-all"
                  >
                    Add
                  </button>
                </div>
                
                {/* Guest Tags */}
                {customGuests.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {customGuests.map((g, index) => (
                      <span key={index} className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-[#4fdbc8]/15 border border-[#4fdbc8]/30 text-[#4fdbc8]">
                        {g}
                        <button type="button" onClick={() => handleRemoveGuest(index)} className="text-white/40 hover:text-white">
                          <span className="material-symbols-outlined text-[12px] font-bold">close</span>
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          <div className="flex gap-4 pt-4 border-t border-white/5">
            <button
              type="button"
              onClick={() => { setShowAddModal(false); resetForm(); }}
              className="flex-1 py-3 rounded-xl border border-white/5 hover:border-white/10 hover:bg-white/[0.02] text-body-sm font-semibold transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex-1 py-3 rounded-xl bg-[#4fdbc8] text-black font-semibold text-body-sm hover:brightness-110 shadow-lg shadow-[#4fdbc8]/15 transition-all"
            >
              {isPending ? 'Saving...' : 'Save Expense'}
            </button>
          </div>
        </form>
      </NexusModal>

      {/* Delete Expense Confirmation */}
      <NexusConfirm
        isOpen={showDeleteConfirm}
        title="Delete Expense Entry?"
        description="Are you sure you want to delete this expense record? If this is a shared expense, it will recalculate debt settlements for the family."
        confirmText="Delete Record"
        cancelText="Cancel"
        onConfirm={handleDelete}
        onCancel={() => {
          setShowDeleteConfirm(false);
          setExpenseToDelete(null);
        }}
        variant="danger"
        loading={isPending}
      />

    </div>
  );
}
