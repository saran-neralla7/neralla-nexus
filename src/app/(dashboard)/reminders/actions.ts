'use server';

import { createClient } from '@/lib/supabase/server';

async function getAuthUser(supabase: any) {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error('Unauthorized');
  return user;
}

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
 * Fetches all reminders for the family
 */
export async function fetchReminders() {
  const supabase = await createClient();
  const authUser = await getAuthUser(supabase);
  const profile = await getUserProfile(supabase, authUser.id);

  const { data, error } = await supabase
    .from('reminders')
    .select(`
      *,
      creator:users!reminders_created_by_fkey (id, full_name, avatar_url)
    `)
    .eq('family_id', profile.family_id)
    .order('scheduled_time', { ascending: true });

  if (error) {
    console.error('Error fetching reminders:', error);
    throw new Error(error.message || 'Failed to fetch reminders');
  }

  return data || [];
}

/**
 * Creates a new reminder
 */
export async function createReminder(data: {
  title: string;
  description?: string;
  scheduled_time: string;
  frequency?: string;
  days_of_week?: number[];
  is_active?: boolean;
}) {
  const supabase = await createClient();
  const authUser = await getAuthUser(supabase);
  const profile = await getUserProfile(supabase, authUser.id);

  const { error } = await supabase
    .from('reminders')
    .insert({
      family_id: profile.family_id,
      title: data.title,
      description: data.description || '',
      scheduled_time: data.scheduled_time,
      frequency: data.frequency || 'daily',
      days_of_week: data.days_of_week || null,
      is_active: data.is_active !== undefined ? data.is_active : true,
      created_by: authUser.id,
    });

  if (error) {
    console.error('Error creating reminder:', error);
    throw new Error(error.message || 'Failed to create reminder');
  }

  return { success: true };
}

/**
 * Updates an existing reminder
 */
export async function updateReminder(
  id: string,
  data: {
    title?: string;
    description?: string;
    scheduled_time?: string;
    frequency?: string;
    days_of_week?: number[];
    is_active?: boolean;
  }
) {
  const supabase = await createClient();
  const authUser = await getAuthUser(supabase);
  const profile = await getUserProfile(supabase, authUser.id);

  // First verify reminder belongs to family
  const { data: reminder, error: fetchErr } = await supabase
    .from('reminders')
    .select('family_id')
    .eq('id', id)
    .single();

  if (fetchErr || !reminder) throw new Error('Reminder not found');
  if (reminder.family_id !== profile.family_id) throw new Error('Access denied');

  const { error } = await supabase
    .from('reminders')
    .update({
      title: data.title,
      description: data.description,
      scheduled_time: data.scheduled_time,
      frequency: data.frequency,
      days_of_week: data.days_of_week,
      is_active: data.is_active,
    })
    .eq('id', id);

  if (error) {
    console.error('Error updating reminder:', error);
    throw new Error(error.message || 'Failed to update reminder');
  }

  return { success: true };
}

/**
 * Deletes a reminder
 */
export async function deleteReminder(id: string) {
  const supabase = await createClient();
  const authUser = await getAuthUser(supabase);
  const profile = await getUserProfile(supabase, authUser.id);

  // First verify reminder belongs to family
  const { data: reminder, error: fetchErr } = await supabase
    .from('reminders')
    .select('family_id')
    .eq('id', id)
    .single();

  if (fetchErr || !reminder) throw new Error('Reminder not found');
  if (reminder.family_id !== profile.family_id) throw new Error('Access denied');

  const { error } = await supabase
    .from('reminders')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting reminder:', error);
    throw new Error(error.message || 'Failed to delete reminder');
  }

  return { success: true };
}
