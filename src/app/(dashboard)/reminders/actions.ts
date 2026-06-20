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
 * Fetches all reminders for the family.
 * Regular members only see reminders assigned to them or created by them.
 * Owners/Admins see all family reminders.
 */
export async function fetchReminders(memberUserId?: string) {
  const supabase = await createClient();
  const authUser = await getAuthUser(supabase);
  const profile = await getUserProfile(supabase, authUser.id);

  let query = supabase
    .from('reminders')
    .select(`
      *,
      creator:users!reminders_created_by_fkey (id, full_name, avatar_url),
      assigned_user:users!reminders_assigned_to_fkey (id, full_name, avatar_url)
    `)
    .eq('family_id', profile.family_id);

  const isOwner = profile.role === 'owner' || profile.role === 'admin';

  if (!isOwner) {
    query = query.or(`assigned_to.eq.${authUser.id},created_by.eq.${authUser.id}`);
  } else if (memberUserId && memberUserId !== 'all') {
    query = query.eq('assigned_to', memberUserId);
  }

  const { data, error } = await query.order('scheduled_time', { ascending: true });

  if (error) {
    console.error('Error fetching reminders:', error);
    throw new Error(error.message || 'Failed to fetch reminders');
  }

  return data || [];
}

/**
 * Creates a new reminder.
 * Regular members can only assign reminders to themselves.
 */
export async function createReminder(data: {
  title: string;
  description?: string;
  scheduled_time: string;
  frequency?: string;
  days_of_week?: number[];
  is_active?: boolean;
  assigned_to?: string;
}) {
  const supabase = await createClient();
  const authUser = await getAuthUser(supabase);
  const profile = await getUserProfile(supabase, authUser.id);

  let assignedId = data.assigned_to || authUser.id;
  const isOwner = profile.role === 'owner' || profile.role === 'admin';

  // Regular members can only assign to themselves
  if (!isOwner) {
    assignedId = authUser.id;
  }

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
      assigned_to: assignedId,
    });

  if (error) {
    console.error('Error creating reminder:', error);
    throw new Error(error.message || 'Failed to create reminder');
  }

  return { success: true };
}

/**
 * Updates an existing reminder.
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
    assigned_to?: string;
  }
) {
  const supabase = await createClient();
  const authUser = await getAuthUser(supabase);
  const profile = await getUserProfile(supabase, authUser.id);

  // First verify reminder belongs to family
  const { data: reminder, error: fetchErr } = await supabase
    .from('reminders')
    .select('family_id, created_by, assigned_to')
    .eq('id', id)
    .single();

  if (fetchErr || !reminder) throw new Error('Reminder not found');
  if (reminder.family_id !== profile.family_id) throw new Error('Access denied');

  const isOwner = profile.role === 'owner' || profile.role === 'admin';
  const isCreator = reminder.created_by === authUser.id;
  const isAssigned = reminder.assigned_to === authUser.id;

  if (!isOwner && !isCreator && !isAssigned) {
    throw new Error('Access denied');
  }

  let assignedId = data.assigned_to;
  if (!isOwner) {
    // Regular members cannot change assignment
    assignedId = reminder.assigned_to;
  }

  const { error } = await supabase
    .from('reminders')
    .update({
      title: data.title,
      description: data.description,
      scheduled_time: data.scheduled_time,
      frequency: data.frequency,
      days_of_week: data.days_of_week,
      is_active: data.is_active,
      assigned_to: assignedId,
    })
    .eq('id', id);

  if (error) {
    console.error('Error updating reminder:', error);
    throw new Error(error.message || 'Failed to update reminder');
  }

  return { success: true };
}

/**
 * Deletes a reminder.
 */
export async function deleteReminder(id: string) {
  const supabase = await createClient();
  const authUser = await getAuthUser(supabase);
  const profile = await getUserProfile(supabase, authUser.id);

  // First verify reminder belongs to family
  const { data: reminder, error: fetchErr } = await supabase
    .from('reminders')
    .select('family_id, created_by')
    .eq('id', id)
    .single();

  if (fetchErr || !reminder) throw new Error('Reminder not found');
  if (reminder.family_id !== profile.family_id) throw new Error('Access denied');

  const isOwner = profile.role === 'owner' || profile.role === 'admin';
  const isCreator = reminder.created_by === authUser.id;

  if (!isOwner && !isCreator) {
    throw new Error('Access denied. You can only delete reminders created by you.');
  }

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
