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
 * Fetches habits for a specific user.
 * Regular members can only fetch their own habits.
 * Owners can fetch habits for any family member.
 */
export async function fetchHabits(memberUserId?: string) {
  const supabase = await createClient();
  const authUser = await getAuthUser(supabase);
  const currentUserProfile = await getUserProfile(supabase, authUser.id);

  let targetUserId = authUser.id;

  if (memberUserId && memberUserId !== authUser.id) {
    // Check if the current user is an owner or admin to see other members' habits
    if (currentUserProfile.role !== 'owner' && currentUserProfile.role !== 'admin') {
      throw new Error('Access denied. Only family owners or admins can view other members\' habits.');
    }
    
    // Check if target user belongs to the same family
    const targetUserProfile = await getUserProfile(supabase, memberUserId);
    if (targetUserProfile.family_id !== currentUserProfile.family_id) {
      throw new Error('Access denied. Target user is not in your family.');
    }
    targetUserId = memberUserId;
  }

  // Fetch habits
  const { data: habits, error: habitsError } = await supabase
    .from('habits')
    .select('*')
    .eq('user_id', targetUserId)
    .eq('family_id', currentUserProfile.family_id)
    .order('created_at', { ascending: false });

  if (habitsError) throw habitsError;

  // Fetch log history for these habits (last 30 days)
  const habitIds = (habits || []).map((h: any) => h.id);
  let logs: any[] = [];
  
  if (habitIds.length > 0) {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const dateStr = thirtyDaysAgo.toISOString().split('T')[0];

    const { data: logsData, error: logsError } = await supabase
      .from('habit_logs')
      .select('*')
      .in('habit_id', habitIds)
      .gte('date', dateStr);

    if (logsError) throw logsError;
    logs = logsData || [];
  }

  // Map logs to habits
  return (habits || []).map((habit: any) => {
    const habitLogs = logs.filter((l: any) => l.habit_id === habit.id);
    return {
      ...habit,
      logs: habitLogs.map((l: any) => l.date),
    };
  });
}

/**
 * Creates a new habit for the authenticated user.
 */
export async function createHabit(name: string, description: string, frequency: string = 'daily') {
  const supabase = await createClient();
  const authUser = await getAuthUser(supabase);
  const currentUserProfile = await getUserProfile(supabase, authUser.id);

  const { error } = await supabase
    .from('habits')
    .insert({
      family_id: currentUserProfile.family_id,
      user_id: authUser.id,
      name,
      description,
      frequency,
    });

  if (error) throw error;
  return { success: true };
}

/**
 * Logs or unlogs a habit for a specific date.
 */
export async function toggleHabitLog(habitId: string, date: string, isLogged: boolean) {
  const supabase = await createClient();
  const authUser = await getAuthUser(supabase);

  // Verify habit ownership
  const { data: habit, error: habitError } = await supabase
    .from('habits')
    .select('user_id')
    .eq('id', habitId)
    .single();

  if (habitError || !habit) throw new Error('Habit not found');
  if (habit.user_id !== authUser.id) {
    throw new Error('Access denied. You can only log your own habits.');
  }

  if (isLogged) {
    // Log habit
    const { error } = await supabase
      .from('habit_logs')
      .insert({
        habit_id: habitId,
        user_id: authUser.id,
        date,
      });
    if (error && error.code !== '23505') throw error; // Ignore duplicate key errors
  } else {
    // Unlog habit
    const { error } = await supabase
      .from('habit_logs')
      .delete()
      .eq('habit_id', habitId)
      .eq('user_id', authUser.id)
      .eq('date', date);
    if (error) throw error;
  }

  return { success: true };
}

/**
 * Deletes a habit.
 * Regular users can delete their own; Owners can delete any habit in their family.
 */
export async function deleteHabit(habitId: string) {
  const supabase = await createClient();
  const authUser = await getAuthUser(supabase);
  const currentUserProfile = await getUserProfile(supabase, authUser.id);

  const { data: habit, error: habitError } = await supabase
    .from('habits')
    .select('*')
    .eq('id', habitId)
    .single();

  if (habitError || !habit) throw new Error('Habit not found');

  if (habit.user_id !== authUser.id && currentUserProfile.role !== 'owner' && currentUserProfile.role !== 'admin') {
    throw new Error('Access denied. You cannot delete other members\' habits.');
  }

  const { error } = await supabase
    .from('habits')
    .delete()
    .eq('id', habitId);

  if (error) throw error;
  return { success: true };
}
