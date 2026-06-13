'use server';

import { createClient } from '@/lib/supabase/server';

async function getAuthUser(supabase: any) {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error('Unauthorized');
  return user;
}

export async function fetchContacts() {
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
    .from('trusted_contacts')
    .select('*')
    .eq('family_id', userData.family_id)
    .order('is_emergency', { ascending: false })
    .order('name', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function createContact(data: {
  name: string;
  category: string;
  phone?: string;
  email?: string;
  company?: string;
  notes?: string;
  is_emergency: boolean;
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
    .from('trusted_contacts')
    .insert({
      family_id: userData.family_id,
      name: data.name,
      category: data.category,
      phone: data.phone || null,
      email: data.email || null,
      company: data.company || null,
      notes: data.notes || null,
      is_emergency: data.is_emergency,
      created_by: authUser.id,
    });

  if (error) throw error;
  return { success: true };
}

export async function updateContact(
  id: string,
  data: {
    name: string;
    category: string;
    phone?: string;
    email?: string;
    company?: string;
    notes?: string;
    is_emergency: boolean;
  }
) {
  const supabase = await createClient();
  const authUser = await getAuthUser(supabase);

  // Verify family ownership
  const { data: currentContact } = await supabase
    .from('trusted_contacts')
    .select('family_id')
    .eq('id', id)
    .single();

  const { data: userData } = await supabase
    .from('users')
    .select('family_id')
    .eq('id', authUser.id)
    .single();

  if (userData?.family_id !== currentContact?.family_id) {
    throw new Error('Access denied');
  }

  const { error } = await supabase
    .from('trusted_contacts')
    .update({
      name: data.name,
      category: data.category,
      phone: data.phone || null,
      email: data.email || null,
      company: data.company || null,
      notes: data.notes || null,
      is_emergency: data.is_emergency,
    })
    .eq('id', id);

  if (error) throw error;
  return { success: true };
}

export async function deleteContact(id: string) {
  const supabase = await createClient();
  const authUser = await getAuthUser(supabase);

  // Verify family ownership
  const { data: currentContact } = await supabase
    .from('trusted_contacts')
    .select('family_id')
    .eq('id', id)
    .single();

  const { data: userData } = await supabase
    .from('users')
    .select('family_id')
    .eq('id', authUser.id)
    .single();

  if (userData?.family_id !== currentContact?.family_id) {
    throw new Error('Access denied');
  }

  const { error } = await supabase
    .from('trusted_contacts')
    .delete()
    .eq('id', id);

  if (error) throw error;
  return { success: true };
}
