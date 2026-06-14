'use server';

import { createClient } from '@/lib/supabase/server';

async function getAuthUser(supabase: any) {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error('Unauthorized');
  return user;
}

function sanitizePhone(phone?: string) {
  if (!phone) return '';
  // Remove all non-numeric characters
  let cleaned = phone.replace(/\D/g, '');
  // Prepend India country code '91' if it's 10 digits without one
  if (cleaned.length === 10) {
    cleaned = '91' + cleaned;
  }
  return cleaned;
}

export async function fetchOccasions() {
  const supabase = await createClient();
  const authUser = await getAuthUser(supabase);

  // Get user profile for family_id
  const { data: userData } = await supabase
    .from('users')
    .select('family_id')
    .eq('id', authUser.id)
    .single();

  if (!userData?.family_id) return [];

  const { data, error } = await supabase
    .from('occasions')
    .select('*')
    .eq('family_id', userData.family_id)
    .order('date', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function createOccasion(data: {
  name: string;
  type: string;
  date: string;
  relationship: string;
  reminder_days?: number;
  notes?: string;
  phone?: string;
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
    .from('occasions')
    .insert({
      family_id: userData.family_id,
      name: data.name,
      type: data.type,
      date: data.date,
      relationship: data.relationship,
      reminder_days: data.reminder_days || 1,
      notes: data.notes || null,
      phone: sanitizePhone(data.phone),
      created_by: authUser.id,
    });

  if (error) throw error;
  return { success: true };
}

export async function updateOccasion(
  id: string,
  data: {
    name: string;
    type: string;
    date: string;
    relationship: string;
    reminder_days?: number;
    notes?: string;
    phone?: string;
  }
) {
  const supabase = await createClient();
  const authUser = await getAuthUser(supabase);

  // Verify family ownership
  const { data: currentEntry } = await supabase
    .from('occasions')
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
    .from('occasions')
    .update({
      name: data.name,
      type: data.type,
      date: data.date,
      relationship: data.relationship,
      reminder_days: data.reminder_days || 1,
      notes: data.notes || null,
      phone: sanitizePhone(data.phone),
    })
    .eq('id', id);

  if (error) throw error;
  return { success: true };
}

export async function deleteOccasion(id: string) {
  const supabase = await createClient();
  const authUser = await getAuthUser(supabase);

  // Verify family ownership
  const { data: currentEntry } = await supabase
    .from('occasions')
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
    .from('occasions')
    .delete()
    .eq('id', id);

  if (error) throw error;
  return { success: true };
}
