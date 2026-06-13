'use server';

import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { encrypt, decrypt, safeDecrypt } from '@/lib/encryption';
import { checkVaultSession } from '../vault/passwords/actions';

async function getAuthUser(supabase: any) {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error('Unauthorized');
  return user;
}

export async function fetchPolicies() {
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
    .from('policies')
    .select('*')
    .eq('family_id', userData.family_id)
    .order('expiry_date', { ascending: true });

  if (error) throw error;

  // Strip sensitive policy number from initial payloads
  return (data || []).map((entry: any) => ({
    id: entry.id,
    family_id: entry.family_id,
    member_id: entry.member_id,
    type: entry.type,
    name: entry.name,
    provider: entry.provider,
    premium_amount: entry.premium_amount ? Number(entry.premium_amount) : undefined,
    premium_date: entry.premium_date || undefined,
    expiry_date: entry.expiry_date || undefined,
    coverage: entry.coverage || undefined,
    document_url: entry.document_url || undefined,
    notes: entry.notes || undefined,
    created_at: entry.created_at,
    has_policy_number: !!entry.policy_number_enc,
  }));
}

export async function revealPolicyNumber(id: string) {
  const isSessionValid = await checkVaultSession();
  if (!isSessionValid) {
    throw new Error('Vault session expired or invalid. Please verify PIN.');
  }

  const supabase = await createClient();
  const authUser = await getAuthUser(supabase);

  const { data, error } = await supabase
    .from('policies')
    .select('policy_number_enc, family_id')
    .eq('id', id)
    .single();

  if (error || !data) {
    throw new Error('Policy not found');
  }

  // Tenant check
  const { data: userData } = await supabase
    .from('users')
    .select('family_id')
    .eq('id', authUser.id)
    .single();

  if (userData?.family_id !== data.family_id) {
    throw new Error('Access denied');
  }

  return decrypt(data.policy_number_enc) || '';
}

export async function createPolicy(data: {
  member_id?: string;
  type: string;
  name: string;
  provider: string;
  policy_number?: string;
  premium_amount?: number;
  premium_date?: string;
  expiry_date?: string;
  coverage?: string;
  document_url?: string;
  notes?: string;
}) {
  const supabase = await createClient();
  const authUser = await getAuthUser(supabase);

  const { data: userData } = await supabase
    .from('users')
    .select('family_id')
    .eq('id', authUser.id)
    .single();

  if (!userData?.family_id) throw new Error('No family assigned');

  // Encrypt policy number
  const policy_number_enc = data.policy_number ? encrypt(data.policy_number) : null;

  const { error } = await supabase
    .from('policies')
    .insert({
      family_id: userData.family_id,
      member_id: data.member_id || null,
      type: data.type,
      name: data.name,
      provider: data.provider,
      policy_number_enc,
      premium_amount: data.premium_amount || null,
      premium_date: data.premium_date || null,
      expiry_date: data.expiry_date || null,
      coverage: data.coverage || null,
      document_url: data.document_url || null,
      notes: data.notes || null,
      created_by: authUser.id,
    });

  if (error) throw error;
  return { success: true };
}

export async function updatePolicy(
  id: string,
  data: {
    member_id?: string;
    type: string;
    name: string;
    provider: string;
    policy_number?: string;
    premium_amount?: number;
    premium_date?: string;
    expiry_date?: string;
    coverage?: string;
    document_url?: string;
    notes?: string;
  }
) {
  const isSessionValid = await checkVaultSession();
  if (!isSessionValid) {
    throw new Error('Vault session expired or invalid. Please verify PIN.');
  }

  const supabase = await createClient();
  const authUser = await getAuthUser(supabase);

  // Check family ownership
  const { data: currentEntry } = await supabase
    .from('policies')
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

  // Encrypt policy number
  const policy_number_enc = data.policy_number ? encrypt(data.policy_number) : null;

  const { error } = await supabase
    .from('policies')
    .update({
      member_id: data.member_id || null,
      type: data.type,
      name: data.name,
      provider: data.provider,
      policy_number_enc,
      premium_amount: data.premium_amount || null,
      premium_date: data.premium_date || null,
      expiry_date: data.expiry_date || null,
      coverage: data.coverage || null,
      document_url: data.document_url || null,
      notes: data.notes || null,
    })
    .eq('id', id);

  if (error) throw error;
  return { success: true };
}

export async function deletePolicy(id: string) {
  const supabase = await createClient();
  const authUser = await getAuthUser(supabase);

  // Check family ownership
  const { data: currentEntry } = await supabase
    .from('policies')
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
    .from('policies')
    .delete()
    .eq('id', id);

  if (error) throw error;
  return { success: true };
}
