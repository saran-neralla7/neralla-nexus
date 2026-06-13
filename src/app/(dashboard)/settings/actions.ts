'use server';

import { createClient } from '@/lib/supabase/server';

async function getAuthUser(supabase: any) {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error('Unauthorized');
  return user;
}

export async function fetchLegacyPlan() {
  const supabase = await createClient();
  const authUser = await getAuthUser(supabase);

  // Get user profile for family_id
  const { data: userData } = await supabase
    .from('users')
    .select('family_id')
    .eq('id', authUser.id)
    .single();

  if (!userData?.family_id) return null;

  const { data, error } = await supabase
    .from('digital_legacy')
    .select('*')
    .eq('user_id', authUser.id)
    .eq('family_id', userData.family_id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function saveLegacyPlan(data: {
  trusted_contact: string;
  instructions: string;
  access_type: string;
  is_active: boolean;
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

  // Check if record exists
  const { data: existing } = await supabase
    .from('digital_legacy')
    .select('id')
    .eq('user_id', authUser.id)
    .eq('family_id', userData.family_id)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from('digital_legacy')
      .update({
        trusted_contact: data.trusted_contact,
        instructions: data.instructions,
        access_type: data.access_type,
        is_active: data.is_active,
      })
      .eq('id', existing.id);

    if (error) throw error;
  } else {
    const { error } = await supabase
      .from('digital_legacy')
      .insert({
        family_id: userData.family_id,
        user_id: authUser.id,
        trusted_contact: data.trusted_contact,
        instructions: data.instructions,
        access_type: data.access_type,
        is_active: data.is_active,
      });

    if (error) throw error;
  }

  // Audit log
  await supabase.from('audit_logs').insert({
    family_id: userData.family_id,
    user_id: authUser.id,
    action: 'update_legacy_plan',
    resource_type: 'legacy',
    metadata: { is_active: data.is_active },
  });

  return { success: true };
}

export async function saveBackupSettings(frequency: string) {
  const supabase = await createClient();
  const authUser = await getAuthUser(supabase);

  // Get user profile for family_id
  const { data: userData } = await supabase
    .from('users')
    .select('family_id')
    .eq('id', authUser.id)
    .single();

  if (!userData?.family_id) throw new Error('No family assigned');

  // Fetch current family settings
  const { data: family } = await supabase
    .from('families')
    .select('settings')
    .eq('id', userData.family_id)
    .single();

  const currentSettings = family?.settings || {};
  const updatedSettings = {
    ...currentSettings,
    backup_frequency: frequency,
    backup_last_configured: new Date().toISOString(),
  };

  const { error } = await supabase
    .from('families')
    .update({ settings: updatedSettings })
    .eq('id', userData.family_id);

  if (error) throw error;

  // Audit log
  await supabase.from('audit_logs').insert({
    family_id: userData.family_id,
    user_id: authUser.id,
    action: 'update_backup_settings',
    resource_type: 'system',
    metadata: { backup_frequency: frequency },
  });

  return { success: true };
}

export async function exportFamilyData() {
  const supabase = await createClient();
  const authUser = await getAuthUser(supabase);

  // Get user profile for family_id
  const { data: userData } = await supabase
    .from('users')
    .select('family_id')
    .eq('id', authUser.id)
    .single();

  if (!userData?.family_id) throw new Error('No family assigned');

  const familyId = userData.family_id;

  // Query all tables associated with this family
  const queries = {
    family: supabase.from('families').select('*').eq('id', familyId).single(),
    users: supabase.from('users').select('id, email, full_name, role, status, is_owner').eq('family_id', familyId),
    members: supabase.from('family_members').select('*').eq('family_id', familyId),
    documents: supabase.from('documents').select('*').eq('family_id', familyId).is('deleted_at', null),
    passwords: supabase.from('passwords').select('*').eq('family_id', familyId).is('deleted_at', null),
    medical: supabase.from('medical_records').select('*').eq('family_id', familyId),
    policies: supabase.from('policies').select('*').eq('family_id', familyId),
    assets: supabase.from('assets').select('*').eq('family_id', familyId),
    calendar: supabase.from('calendar_events').select('*').eq('family_id', familyId),
    contacts: supabase.from('trusted_contacts').select('*').eq('family_id', familyId),
    memories: supabase.from('memories').select('*').eq('family_id', familyId),
    knowledge: supabase.from('knowledge_articles').select('*').eq('family_id', familyId),
  };

  const results = await Promise.all([
    queries.family,
    queries.users,
    queries.members,
    queries.documents,
    queries.passwords,
    queries.medical,
    queries.policies,
    queries.assets,
    queries.calendar,
    queries.contacts,
    queries.memories,
    queries.knowledge,
  ]);

  const exportPackage = {
    exported_at: new Date().toISOString(),
    exported_by: authUser.email,
    family_id: familyId,
    data: {
      family: results[0].data || null,
      users: results[1].data || [],
      members: results[2].data || [],
      documents: results[3].data || [],
      passwords: results[4].data || [],
      medical: results[5].data || [],
      policies: results[6].data || [],
      assets: results[7].data || [],
      calendar: results[8].data || [],
      contacts: results[9].data || [],
      memories: results[10].data || [],
      knowledge: results[11].data || [],
    },
  };

  // Log audit
  await supabase.from('audit_logs').insert({
    family_id: familyId,
    user_id: authUser.id,
    action: 'export_backup_data',
    resource_type: 'system',
    metadata: { records_count: Object.keys(exportPackage.data).reduce((acc, key) => acc + (Array.isArray((exportPackage.data as any)[key]) ? (exportPackage.data as any)[key].length : 0), 0) },
  });

  return exportPackage;
}

export async function updateSettingsPin(currentPin: string | null, newPin: string) {
  const { hashPin, verifyPin } = require('@/lib/pin');
  const supabase = await createClient();
  const authUser = await getAuthUser(supabase);

  // Fetch current user
  const { data: userRecord, error: userErr } = await supabase
    .from('users')
    .select('pin_hash, family_id')
    .eq('id', authUser.id)
    .single();

  if (userErr || !userRecord) throw new Error('User details not found');

  if (userRecord.pin_hash && currentPin) {
    const isValid = verifyPin(currentPin, userRecord.pin_hash);
    if (!isValid) throw new Error('Incorrect current PIN code');
  }

  if (!/^\d{4,6}$/.test(newPin)) {
    throw new Error('New PIN must be between 4 and 6 digits');
  }

  const hashed = hashPin(newPin);
  const { error: updateErr } = await supabase
    .from('users')
    .update({ pin_hash: hashed })
    .eq('id', authUser.id);

  if (updateErr) throw updateErr;

  // Log in Audit Logs
  await supabase.from('audit_logs').insert({
    family_id: userRecord.family_id,
    user_id: authUser.id,
    action: 'update_security_pin',
    resource_type: 'auth',
    metadata: { has_existing: !!userRecord.pin_hash },
  });

  return { success: true };
}
