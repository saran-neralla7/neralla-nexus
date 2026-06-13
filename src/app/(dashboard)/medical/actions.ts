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
