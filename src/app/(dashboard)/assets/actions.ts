'use server';

import { createClient } from '@/lib/supabase/server';

async function getAuthUser(supabase: any) {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error('Unauthorized');
  return user;
}

export async function fetchAssets() {
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
    .from('assets')
    .select('*')
    .eq('family_id', userData.family_id)
    .order('created_at', { ascending: false });

  if (error) throw error;
  
  // Format numeric values cleanly
  return (data || []).map((entry: any) => ({
    ...entry,
    current_value: entry.current_value ? Number(entry.current_value) : undefined,
    photos: entry.photos || [],
    documents: entry.documents || [],
  }));
}

export async function createAsset(data: {
  type: string;
  name: string;
  description?: string;
  current_value?: number;
  purchase_date?: string;
  photos?: string[];
  documents?: string[];
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
    .from('assets')
    .insert({
      family_id: userData.family_id,
      type: data.type,
      name: data.name,
      description: data.description || null,
      current_value: data.current_value || null,
      purchase_date: data.purchase_date || null,
      photos: data.photos || [],
      documents: data.documents || [],
    });

  if (error) throw error;
  return { success: true };
}

export async function updateAsset(
  id: string,
  data: {
    type: string;
    name: string;
    description?: string;
    current_value?: number;
    purchase_date?: string;
    photos?: string[];
    documents?: string[];
  }
) {
  const supabase = await createClient();
  const authUser = await getAuthUser(supabase);

  // Check family ownership
  const { data: currentEntry } = await supabase
    .from('assets')
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
    .from('assets')
    .update({
      type: data.type,
      name: data.name,
      description: data.description || null,
      current_value: data.current_value || null,
      purchase_date: data.purchase_date || null,
      photos: data.photos || [],
      documents: data.documents || [],
    })
    .eq('id', id);

  if (error) throw error;
  return { success: true };
}

export async function deleteAsset(id: string) {
  const supabase = await createClient();
  const authUser = await getAuthUser(supabase);

  // Fetch full entry for trash backup
  const { data: currentEntry, error: fetchErr } = await supabase
    .from('assets')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchErr || !currentEntry) throw new Error('Asset entry not found');

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
      resource_type: 'assets',
      resource_id: id,
      resource_data: currentEntry,
      deleted_by: authUser.id,
      deleted_at: new Date().toISOString(),
    });

  if (trashErr) throw trashErr;

  // Delete from original table
  const { error } = await supabase
    .from('assets')
    .delete()
    .eq('id', id);

  if (error) throw error;
  return { success: true };
}
