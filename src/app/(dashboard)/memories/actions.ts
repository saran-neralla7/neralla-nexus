'use server';

import { createClient } from '@/lib/supabase/server';

async function getAuthUser(supabase: any) {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error('Unauthorized');
  return user;
}

export async function fetchMemories() {
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
    .from('memories')
    .select('*')
    .eq('family_id', userData.family_id)
    .order('date', { ascending: false });

  if (error) throw error;

  return (data || []).map((entry: any) => ({
    ...entry,
    media_urls: entry.media_urls || [],
    tags: entry.tags || [],
    members: entry.members || [],
  }));
}

export async function createMemory(data: {
  title: string;
  description?: string;
  category: string;
  date?: string;
  media_urls?: string[];
  tags?: string[];
  members?: string[];
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
    .from('memories')
    .insert({
      family_id: userData.family_id,
      title: data.title,
      description: data.description || null,
      category: data.category,
      date: data.date || new Date().toISOString().split('T')[0],
      media_urls: data.media_urls || [],
      tags: data.tags || [],
      members: data.members || [],
      created_by: authUser.id,
    });

  if (error) throw error;
  return { success: true };
}

export async function updateMemory(
  id: string,
  data: {
    title: string;
    description?: string;
    category: string;
    date?: string;
    media_urls?: string[];
    tags?: string[];
    members?: string[];
  }
) {
  const supabase = await createClient();
  const authUser = await getAuthUser(supabase);

  // Verify family ownership
  const { data: currentEntry } = await supabase
    .from('memories')
    .select('family_id')
    .eq('id', id)
    .single();

  const { data: userData } = await supabase
    .from('users')
    .select('family_id')
    .eq('id', authUser.id)
    .single();

  if (userData?.family_id !== currentEntry?.family_id) {
    throw new Error('Access denied');
  }

  const { error } = await supabase
    .from('memories')
    .update({
      title: data.title,
      description: data.description || null,
      category: data.category,
      date: data.date || new Date().toISOString().split('T')[0],
      media_urls: data.media_urls || [],
      tags: data.tags || [],
      members: data.members || [],
    })
    .eq('id', id);

  if (error) throw error;
  return { success: true };
}

export async function deleteMemory(id: string) {
  const supabase = await createClient();
  const authUser = await getAuthUser(supabase);

  // Fetch full entry for trash backup
  const { data: currentEntry, error: fetchErr } = await supabase
    .from('memories')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchErr || !currentEntry) throw new Error('Memory entry not found');

  const { data: userData } = await supabase
    .from('users')
    .select('family_id')
    .eq('id', authUser.id)
    .single();

  if (!userData?.family_id) {
    throw new Error('Unauthorized');
  }

  if (userData.family_id !== currentEntry?.family_id) {
    throw new Error('Access denied');
  }

  // Insert into trash_items
  const { error: trashErr } = await supabase
    .from('trash_items')
    .insert({
      family_id: userData.family_id,
      resource_type: 'memories',
      resource_id: id,
      resource_data: currentEntry,
      deleted_by: authUser.id,
      deleted_at: new Date().toISOString(),
    });

  if (trashErr) throw trashErr;

  // Delete from original table
  const { error } = await supabase
    .from('memories')
    .delete()
    .eq('id', id);

  if (error) throw error;
  return { success: true };
}
