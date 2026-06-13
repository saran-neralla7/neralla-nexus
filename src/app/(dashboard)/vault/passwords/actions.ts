'use server';

import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { encrypt, decrypt, safeDecrypt } from '@/lib/encryption';
import { hashPin, verifyPin } from '@/lib/pin';

const VAULT_COOKIE_NAME = 'nexus_vault_verified';
const VAULT_SESSION_DURATION = 900; // 15 minutes in seconds

// Helper to get authenticated user from supabase
async function getAuthUser(supabase: any) {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error('Unauthorized');
  return user;
}

/**
 * Checks if the current user has a security PIN set.
 */
export async function checkPinSet() {
  const supabase = await createClient();
  const authUser = await getAuthUser(supabase);

  const { data, error } = await supabase
    .from('users')
    .select('pin_hash')
    .eq('id', authUser.id)
    .single();

  if (error) return false;
  return !!data?.pin_hash;
}

/**
 * Sets up the initial security PIN for the user.
 */
export async function setupPin(pin: string) {
  if (!/^\d{4,6}$/.test(pin)) {
    throw new Error('PIN must be 4 to 6 digits');
  }

  const supabase = await createClient();
  const authUser = await getAuthUser(supabase);

  const hashed = hashPin(pin);

  const { error } = await supabase
    .from('users')
    .update({ pin_hash: hashed })
    .eq('id', authUser.id);

  if (error) throw error;

  // Automatically authenticate vault session on setup
  const cookieStore = await cookies();
  cookieStore.set(VAULT_COOKIE_NAME, 'true', {
    maxAge: VAULT_SESSION_DURATION,
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
  });

  return { success: true };
}

/**
 * Verifies the user PIN and sets a secure vault session cookie.
 */
export async function verifyVaultPin(pin: string) {
  const supabase = await createClient();
  const authUser = await getAuthUser(supabase);

  const { data, error } = await supabase
    .from('users')
    .select('pin_hash')
    .eq('id', authUser.id)
    .single();

  if (error || !data?.pin_hash) {
    throw new Error('No PIN configured');
  }

  const isValid = verifyPin(pin, data.pin_hash);
  if (!isValid) {
    throw new Error('Incorrect PIN');
  }

  const cookieStore = await cookies();
  cookieStore.set(VAULT_COOKIE_NAME, 'true', {
    maxAge: VAULT_SESSION_DURATION,
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
  });

  return { success: true };
}

/**
 * Checks if the vault session cookie is valid.
 */
export async function checkVaultSession() {
  const cookieStore = await cookies();
  return cookieStore.has(VAULT_COOKIE_NAME);
}

/**
 * Clears the vault session cookie.
 */
export async function clearVaultSession() {
  const cookieStore = await cookies();
  cookieStore.delete(VAULT_COOKIE_NAME);
  return { success: true };
}

/**
 * Fetches all password entries (without decrypting sensitive fields).
 */
export async function fetchPasswords() {
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
    .from('passwords')
    .select('*')
    .eq('family_id', userData.family_id)
    .order('title', { ascending: true });

  if (error) throw error;

  // Strip encrypted fields to keep network payloads safe
  return (data || []).map((entry: any) => ({
    id: entry.id,
    family_id: entry.family_id,
    member_id: entry.member_id,
    category: entry.category,
    title: entry.title,
    url: entry.url,
    shared_with: entry.shared_with || [],
    created_at: entry.created_at,
    updated_at: entry.updated_at,
    has_username: !!entry.username_enc,
    has_notes: !!entry.notes_enc,
  }));
}

/**
 * Reveals/Decrypts username, password, and notes for a specific entry.
 * Validates vault session first.
 */
export async function revealPassword(id: string) {
  const isSessionValid = await checkVaultSession();
  if (!isSessionValid) {
    throw new Error('Vault session expired or invalid. Please verify PIN.');
  }

  const supabase = await createClient();
  const authUser = await getAuthUser(supabase);

  const { data, error } = await supabase
    .from('passwords')
    .select('username_enc, password_enc, notes_enc, family_id')
    .eq('id', id)
    .single();

  if (error || !data) {
    throw new Error('Password entry not found');
  }

  // Double check user belongs to the same family (tenant isolation check)
  const { data: userData } = await supabase
    .from('users')
    .select('family_id')
    .eq('id', authUser.id)
    .single();

  if (userData?.family_id !== data.family_id) {
    throw new Error('Access denied');
  }

  return {
    username: safeDecrypt(data.username_enc) || '',
    password: decrypt(data.password_enc) || '',
    notes: safeDecrypt(data.notes_enc) || '',
  };
}

/**
 * Creates a new password entry by encrypting sensitive fields.
 */
export async function createPassword(data: {
  category: string;
  title: string;
  username?: string;
  password?: string;
  url?: string;
  notes?: string;
  member_id?: string;
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

  // Encrypt fields
  const username_enc = data.username ? encrypt(data.username) : null;
  const password_enc = data.password ? encrypt(data.password) : '';
  const notes_enc = data.notes ? encrypt(data.notes) : null;

  const { error } = await supabase
    .from('passwords')
    .insert({
      family_id: userData.family_id,
      member_id: data.member_id || null,
      category: data.category,
      title: data.title,
      username_enc,
      password_enc,
      url: data.url || null,
      notes_enc,
      created_by: authUser.id,
    });

  if (error) throw error;
  return { success: true };
}

/**
 * Updates an existing password entry by encrypting sensitive fields.
 */
export async function updatePassword(
  id: string,
  data: {
    category: string;
    title: string;
    username?: string;
    password?: string;
    url?: string;
    notes?: string;
    member_id?: string;
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
    .from('passwords')
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

  // Encrypt fields
  const username_enc = data.username ? encrypt(data.username) : null;
  const password_enc = data.password ? encrypt(data.password) : '';
  const notes_enc = data.notes ? encrypt(data.notes) : null;

  const { error } = await supabase
    .from('passwords')
    .update({
      member_id: data.member_id || null,
      category: data.category,
      title: data.title,
      username_enc,
      password_enc,
      url: data.url || null,
      notes_enc,
    })
    .eq('id', id);

  if (error) throw error;
  return { success: true };
}

/**
 * Moves a password entry to the Trash.
 */
export async function deletePassword(id: string) {
  const supabase = await createClient();
  const authUser = await getAuthUser(supabase);

  // Fetch full entry for trash backup
  const { data: currentEntry, error: fetchErr } = await supabase
    .from('passwords')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchErr || !currentEntry) throw new Error('Password entry not found');

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
      resource_type: 'passwords',
      resource_id: id,
      resource_data: currentEntry,
      deleted_by: authUser.id,
      deleted_at: new Date().toISOString(),
    });

  if (trashErr) throw trashErr;

  // Delete from original table
  const { error } = await supabase
    .from('passwords')
    .delete()
    .eq('id', id);

  if (error) throw error;
  return { success: true };
}
