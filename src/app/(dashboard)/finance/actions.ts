'use server';

import { createClient } from '@/lib/supabase/server';

// Helper to get authenticated user from supabase
async function getAuthUser(supabase: any) {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error('Unauthorized');
  return user;
}

// Get user profile details
async function getUserProfile(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();
  if (error || !data) throw new Error('User profile not found');
  return data;
}

/**
 * Fetch expenses based on type ('solo' or 'common')
 */
export async function fetchExpenses(type: 'solo' | 'common', memberUserId?: string) {
  const supabase = await createClient();
  const authUser = await getAuthUser(supabase);
  const currentUserProfile = await getUserProfile(supabase, authUser.id);

  if (type === 'solo') {
    let targetUserId = authUser.id;

    if (memberUserId && memberUserId !== authUser.id) {
      if (currentUserProfile.role !== 'owner' && currentUserProfile.role !== 'admin') {
        throw new Error('Access denied. Only family owners or admins can view other members\' solo daily expenses.');
      }
      const targetUserProfile = await getUserProfile(supabase, memberUserId);
      if (targetUserProfile.family_id !== currentUserProfile.family_id) {
        throw new Error('Access denied. Target user is not in your family.');
      }
      targetUserId = memberUserId;
    }

    const { data, error } = await supabase
      .from('expenses')
      .select('*')
      .eq('family_id', currentUserProfile.family_id)
      .eq('type', 'solo')
      .eq('paid_by', targetUserId)
      .order('date', { ascending: false });

    if (error) throw error;
    return data || [];
  } else {
    // Fetch all common/shared expenses for the family
    const { data: expenses, error: expensesError } = await supabase
      .from('expenses')
      .select(`
        *,
        payer:users!expenses_paid_by_fkey (id, full_name, avatar_url)
      `)
      .eq('family_id', currentUserProfile.family_id)
      .eq('type', 'common')
      .order('date', { ascending: false });

    if (expensesError) throw expensesError;

    // Fetch participants for these expenses
    const expenseIds = (expenses || []).map((e: any) => e.id);
    let participants: any[] = [];

    if (expenseIds.length > 0) {
      const { data: partData, error: partError } = await supabase
        .from('expense_participants')
        .select(`
          *,
          user:users (id, full_name, avatar_url)
        `)
        .in('expense_id', expenseIds);

      if (partError) throw partError;
      participants = partData || [];
    }

    // Map participants back to expenses
    return (expenses || []).map((exp: any) => {
      const expParts = participants.filter((p: any) => p.expense_id === exp.id);
      return {
        ...exp,
        participants: expParts.map((p: any) => ({
          id: p.id,
          userId: p.user_id,
          name: p.user ? p.user.full_name : p.custom_name,
          avatarUrl: p.user ? p.user.avatar_url : null,
          isCustom: !p.user_id,
        })),
      };
    });
  }
}

/**
 * Creates a new expense (supporting Solo/Common and participant tracking)
 */
export async function createExpense(expenseData: {
  amount: number;
  category: string;
  description?: string;
  date: string;
  type: 'solo' | 'common';
  paid_by?: string;
  participants?: Array<{ userId?: string; customName?: string }>;
}) {
  const supabase = await createClient();
  const authUser = await getAuthUser(supabase);
  const currentUserProfile = await getUserProfile(supabase, authUser.id);

  const payerId = expenseData.paid_by || authUser.id;

  // Insert into expenses
  const { data: newExpense, error: expenseError } = await supabase
    .from('expenses')
    .insert({
      family_id: currentUserProfile.family_id,
      amount: expenseData.amount,
      category: expenseData.category,
      description: expenseData.description || '',
      paid_by: payerId,
      type: expenseData.type,
      date: expenseData.date,
    })
    .select()
    .single();

  if (expenseError) throw expenseError;

  // If common, log participants
  if (expenseData.type === 'common' && expenseData.participants && expenseData.participants.length > 0) {
    const participantRows = expenseData.participants.map((p) => ({
      expense_id: newExpense.id,
      user_id: p.userId || null,
      custom_name: p.customName || null,
    }));

    const { error: partError } = await supabase
      .from('expense_participants')
      .insert(participantRows);

    if (partError) throw partError;
  }

  return { success: true };
}

/**
 * Deletes an expense
 */
export async function deleteExpense(expenseId: string) {
  const supabase = await createClient();
  const authUser = await getAuthUser(supabase);
  const currentUserProfile = await getUserProfile(supabase, authUser.id);

  // Check ownership
  const { data: currentExpense, error: fetchErr } = await supabase
    .from('expenses')
    .select('*')
    .eq('id', expenseId)
    .single();

  if (fetchErr || !currentExpense) throw new Error('Expense not found');

  if (currentExpense.paid_by !== authUser.id && currentUserProfile.role !== 'owner' && currentUserProfile.role !== 'admin') {
    throw new Error('Access denied. You cannot delete other members\' expenses.');
  }

  const { error } = await supabase
    .from('expenses')
    .delete()
    .eq('id', expenseId);

  if (error) throw error;
  return { success: true };
}

/**
 * Fetches all family members for checkboxes
 */
export async function fetchFamilyMembersForExpenses() {
  const supabase = await createClient();
  const authUser = await getAuthUser(supabase);
  const currentUserProfile = await getUserProfile(supabase, authUser.id);

  const { data, error } = await supabase
    .from('users')
    .select('id, full_name, avatar_url')
    .eq('family_id', currentUserProfile.family_id);

  if (error) throw error;
  return data || [];
}

/**
 * Calculates debt splits using transaction minimization algorithm
 */
export async function fetchSettlements() {
  const supabase = await createClient();
  const authUser = await getAuthUser(supabase);
  const currentUserProfile = await getUserProfile(supabase, authUser.id);

  // Fetch all common expenses and participants
  const expenses = await fetchExpenses('common');

  // Map to hold net balance of each person
  // Key format: 'user:<id>' or 'guest:<custom_name>'
  const balances: Record<string, { balance: number; name: string; avatarUrl: string | null; id: string; isGuest: boolean }> = {};

  // Fetch names of all family members to populate balances correctly
  const familyMembers = await fetchFamilyMembersForExpenses();
  familyMembers.forEach((member) => {
    balances[`user:${member.id}`] = {
      balance: 0,
      name: member.full_name,
      avatarUrl: member.avatar_url || null,
      id: member.id,
      isGuest: false,
    };
  });

  // Calculate net balances
  expenses.forEach((exp: any) => {
    const payerKey = `user:${exp.paid_by}`;
    
    // Ensure payer exists in balances
    if (!balances[payerKey]) {
      balances[payerKey] = {
        balance: 0,
        name: exp.payer?.full_name || 'Unknown',
        avatarUrl: exp.payer?.avatar_url || null,
        id: exp.paid_by,
        isGuest: false,
      };
    }

    const participants = exp.participants || [];
    if (participants.length === 0) return;

    const share = exp.amount / participants.length;

    // Credit payer
    balances[payerKey].balance += exp.amount;

    // Debit participants
    participants.forEach((part: any) => {
      const partKey = part.userId ? `user:${part.userId}` : `guest:${part.name}`;
      if (!balances[partKey]) {
        balances[partKey] = {
          balance: 0,
          name: part.name,
          avatarUrl: null,
          id: part.userId || part.name,
          isGuest: !part.userId,
        };
      }
      balances[partKey].balance -= share;
    });
  });

  // Generate peer-to-peer settlement transactions
  const debtors: Array<{ key: string; name: string; balance: number; avatarUrl: string | null; isGuest: boolean }> = [];
  const creditors: Array<{ key: string; name: string; balance: number; avatarUrl: string | null; isGuest: boolean }> = [];

  Object.entries(balances).forEach(([key, info]) => {
    // Round to 2 decimal places to avoid floating point issues
    info.balance = Math.round(info.balance * 100) / 100;
    if (info.balance < -0.01) {
      debtors.push({ key, name: info.name, balance: info.balance, avatarUrl: info.avatarUrl, isGuest: info.isGuest });
    } else if (info.balance > 0.01) {
      creditors.push({ key, name: info.name, balance: info.balance, avatarUrl: info.avatarUrl, isGuest: info.isGuest });
    }
  });

  // Greedy settlement generator
  const settlements: Array<{
    from: { key: string; name: string; avatarUrl: string | null; isGuest: boolean };
    to: { key: string; name: string; avatarUrl: string | null; isGuest: boolean };
    amount: number;
  }> = [];

  // Sort debtors ascending (most negative first) and creditors descending (most positive first)
  debtors.sort((a, b) => a.balance - b.balance);
  creditors.sort((a, b) => b.balance - a.balance);

  let dIdx = 0;
  let cIdx = 0;

  while (dIdx < debtors.length && cIdx < creditors.length) {
    const debtor = debtors[dIdx];
    const creditor = creditors[cIdx];

    const debtAmount = -debtor.balance;
    const creditAmount = creditor.balance;

    const settled = Math.min(debtAmount, creditAmount);

    settlements.push({
      from: { key: debtor.key, name: debtor.name, avatarUrl: debtor.avatarUrl, isGuest: debtor.isGuest },
      to: { key: creditor.key, name: creditor.name, avatarUrl: creditor.avatarUrl, isGuest: creditor.isGuest },
      amount: Math.round(settled * 100) / 100,
    });

    debtor.balance += settled;
    creditor.balance -= settled;

    if (Math.abs(debtor.balance) < 0.01) dIdx++;
    if (Math.abs(creditor.balance) < 0.01) cIdx++;
  }

  return {
    balances: Object.values(balances),
    settlements,
  };
}
