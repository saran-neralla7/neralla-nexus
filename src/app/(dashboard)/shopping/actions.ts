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
 * Fetches all active shopping items for the family.
 */
export async function fetchShoppingItems() {
  const supabase = await createClient();
  const authUser = await getAuthUser(supabase);
  const currentUserProfile = await getUserProfile(supabase, authUser.id);

  const { data, error } = await supabase
    .from('shopping_items')
    .select(`
      *,
      creator:users!shopping_items_added_by_fkey (full_name),
      completer:users!shopping_items_completed_by_fkey (full_name)
    `)
    .eq('family_id', currentUserProfile.family_id)
    .order('is_completed', { ascending: true })
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

/**
 * Adds a new item to the shopping list.
 */
export async function createShoppingItem(name: string, quantity: string = '1', category?: string) {
  const supabase = await createClient();
  const authUser = await getAuthUser(supabase);
  const currentUserProfile = await getUserProfile(supabase, authUser.id);

  const { error } = await supabase
    .from('shopping_items')
    .insert({
      family_id: currentUserProfile.family_id,
      name,
      quantity,
      category: category || 'groceries',
      is_completed: false,
      added_by: authUser.id,
    });

  if (error) throw error;
  return { success: true };
}

/**
 * Toggles the completion status of a shopping item.
 */
export async function toggleShoppingItem(id: string, isCompleted: boolean) {
  const supabase = await createClient();
  const authUser = await getAuthUser(supabase);
  const currentUserProfile = await getUserProfile(supabase, authUser.id);

  // Validate family ownership
  const { data: item, error: itemErr } = await supabase
    .from('shopping_items')
    .select('family_id')
    .eq('id', id)
    .single();

  if (itemErr || !item) throw new Error('Shopping item not found');
  if (item.family_id !== currentUserProfile.family_id) throw new Error('Access denied');

  const { error } = await supabase
    .from('shopping_items')
    .update({
      is_completed: isCompleted,
      completed_by: isCompleted ? authUser.id : null,
      completed_at: isCompleted ? new Date().toISOString() : null,
    })
    .eq('id', id);

  if (error) throw error;
  return { success: true };
}

/**
 * Clears/Deletes all completed shopping items for the family.
 */
export async function clearCompletedShoppingItems() {
  const supabase = await createClient();
  const authUser = await getAuthUser(supabase);
  const currentUserProfile = await getUserProfile(supabase, authUser.id);

  const { error } = await supabase
    .from('shopping_items')
    .delete()
    .eq('family_id', currentUserProfile.family_id)
    .eq('is_completed', true);

  if (error) throw error;
  return { success: true };
}
