'use server';

import { createClient } from '@/lib/supabase/server';

async function getAuthUser(supabase: any) {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error('Unauthorized');
  return user;
}

export async function fetchMedicalRecords() {
  const supabase = await createClient();
  const authUser = await getAuthUser(supabase);

  // Get user profile to find family_id
  const { data: userData } = await supabase
    .from('users')
    .select('family_id')
    .eq('id', authUser.id)
    .single();

  if (!userData?.family_id) return [];

  const { data, error } = await supabase
    .from('medical_records')
    .select('*')
    .eq('family_id', userData.family_id)
    .order('date', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function createMedicalRecord(data: {
  member_id: string;
  type: string;
  title: string;
  doctor?: string;
  hospital?: string;
  date?: string;
  file_url?: string;
  notes?: string;
}) {
  const supabase = await createClient();
  const authUser = await getAuthUser(supabase);

  // Get user profile for family_id
  const { data: userData } = await supabase
    .from('users')
    .select('family_id')
    .eq('id', authUser.id)
    .single();

  if (!userData?.family_id) throw new Error('No family assigned');

  const { error } = await supabase
    .from('medical_records')
    .insert({
      family_id: userData.family_id,
      member_id: data.member_id,
      type: data.type,
      title: data.title,
      doctor: data.doctor || null,
      hospital: data.hospital || null,
      date: data.date || new Date().toISOString().split('T')[0],
      file_url: data.file_url || null,
      notes: data.notes || null,
      created_by: authUser.id,
    });

  if (error) throw error;
  return { success: true };
}

export async function updateMedicalRecord(
  id: string,
  data: {
    member_id: string;
    type: string;
    title: string;
    doctor?: string;
    hospital?: string;
    date?: string;
    file_url?: string;
    notes?: string;
  }
) {
  const supabase = await createClient();
  const authUser = await getAuthUser(supabase);

  // Verify family ownership
  const { data: currentRecord } = await supabase
    .from('medical_records')
    .select('family_id')
    .eq('id', id)
    .single();

  const { data: userData } = await supabase
    .from('users')
    .select('family_id')
    .eq('id', authUser.id)
    .single();

  if (userData?.family_id !== currentRecord?.family_id) {
    throw new Error('Access denied');
  }

  const { error } = await supabase
    .from('medical_records')
    .update({
      member_id: data.member_id,
      type: data.type,
      title: data.title,
      doctor: data.doctor || null,
      hospital: data.hospital || null,
      date: data.date || new Date().toISOString().split('T')[0],
      file_url: data.file_url || null,
      notes: data.notes || null,
    })
    .eq('id', id);

  if (error) throw error;
  return { success: true };
}

export async function deleteMedicalRecord(id: string) {
  const supabase = await createClient();
  const authUser = await getAuthUser(supabase);

  // Verify family ownership
  const { data: currentRecord } = await supabase
    .from('medical_records')
    .select('family_id')
    .eq('id', id)
    .single();

  const { data: userData } = await supabase
    .from('users')
    .select('family_id')
    .eq('id', authUser.id)
    .single();

  if (userData?.family_id !== currentRecord?.family_id) {
    throw new Error('Access denied');
  }

  const { error } = await supabase
    .from('medical_records')
    .delete()
    .eq('id', id);

  if (error) throw error;
  return { success: true };
}

// ============================================
// NERALLA NEXUS — PHASE 12: MEDICATION ACTIONS
// ============================================

export async function fetchMedicationReminders() {
  const supabase = await createClient();
  const authUser = await getAuthUser(supabase);

  const { data: userData } = await supabase
    .from('users')
    .select('family_id')
    .eq('id', authUser.id)
    .single();

  if (!userData?.family_id) return [];

  const { data, error } = await supabase
    .from('medication_reminders')
    .select('*')
    .eq('family_id', userData.family_id)
    .order('scheduled_time', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function fetchMedicationLogs(dateStr: string) {
  const supabase = await createClient();
  const authUser = await getAuthUser(supabase);

  const { data: userData } = await supabase
    .from('users')
    .select('family_id')
    .eq('id', authUser.id)
    .single();

  if (!userData?.family_id) return [];

  const { data, error } = await supabase
    .from('medication_logs')
    .select('*, medication_reminders!inner(family_id)')
    .eq('date', dateStr)
    .eq('medication_reminders.family_id', userData.family_id);

  if (error) throw error;
  return data || [];
}

export async function createMedicationReminder(data: {
  member_id: string;
  name: string;
  dosage?: string;
  scheduled_time: string;
  frequency?: string;
  days_of_week?: number[];
  is_active?: boolean;
}) {
  const supabase = await createClient();
  const authUser = await getAuthUser(supabase);

  const { data: userData } = await supabase
    .from('users')
    .select('family_id')
    .eq('id', authUser.id)
    .single();

  if (!userData?.family_id) throw new Error('No family assigned');

  const { error } = await supabase
    .from('medication_reminders')
    .insert({
      family_id: userData.family_id,
      member_id: data.member_id,
      name: data.name,
      dosage: data.dosage || null,
      scheduled_time: data.scheduled_time,
      frequency: data.frequency || 'daily',
      days_of_week: data.days_of_week || null,
      is_active: data.is_active !== undefined ? data.is_active : true,
    });

  if (error) throw error;
  return { success: true };
}

export async function updateMedicationReminder(
  id: string,
  data: {
    member_id: string;
    name: string;
    dosage?: string;
    scheduled_time: string;
    frequency?: string;
    days_of_week?: number[];
    is_active?: boolean;
  }
) {
  const supabase = await createClient();
  const authUser = await getAuthUser(supabase);

  const { data: currentReminder } = await supabase
    .from('medication_reminders')
    .select('family_id')
    .eq('id', id)
    .single();

  const { data: userData } = await supabase
    .from('users')
    .select('family_id')
    .eq('id', authUser.id)
    .single();

  if (userData?.family_id !== currentReminder?.family_id) {
    throw new Error('Access denied');
  }

  const { error } = await supabase
    .from('medication_reminders')
    .update({
      member_id: data.member_id,
      name: data.name,
      dosage: data.dosage || null,
      scheduled_time: data.scheduled_time,
      frequency: data.frequency || 'daily',
      days_of_week: data.days_of_week || null,
      is_active: data.is_active !== undefined ? data.is_active : true,
    })
    .eq('id', id);

  if (error) throw error;
  return { success: true };
}

export async function deleteMedicationReminder(id: string) {
  const supabase = await createClient();
  const authUser = await getAuthUser(supabase);

  const { data: currentReminder } = await supabase
    .from('medication_reminders')
    .select('family_id')
    .eq('id', id)
    .single();

  const { data: userData } = await supabase
    .from('users')
    .select('family_id')
    .eq('id', authUser.id)
    .single();

  if (userData?.family_id !== currentReminder?.family_id) {
    throw new Error('Access denied');
  }

  const { error } = await supabase
    .from('medication_reminders')
    .delete()
    .eq('id', id);

  if (error) throw error;
  return { success: true };
}

export async function logMedicationDose(
  reminderId: string,
  dateStr: string,
  status: 'taken' | 'skipped' | 'snoozed'
) {
  const supabase = await createClient();
  const authUser = await getAuthUser(supabase);

  // Verify ownership via reminder
  const { data: reminder } = await supabase
    .from('medication_reminders')
    .select('family_id')
    .eq('id', reminderId)
    .single();

  const { data: userData } = await supabase
    .from('users')
    .select('family_id')
    .eq('id', authUser.id)
    .single();

  if (userData?.family_id !== reminder?.family_id) {
    throw new Error('Access denied');
  }

  let snoozedUntil = null;
  if (status === 'snoozed') {
    snoozedUntil = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  }

  const { error } = await supabase
    .from('medication_logs')
    .upsert({
      reminder_id: reminderId,
      date: dateStr,
      status,
      snoozed_until: snoozedUntil,
      logged_at: new Date().toISOString(),
    }, {
      onConflict: 'reminder_id,date'
    });

  if (error) throw error;
  return { success: true };
}
