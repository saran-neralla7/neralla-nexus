'use server';

import { createClient } from '@/lib/supabase/server';

async function getAuthUser(supabase: any) {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error('Unauthorized');
  return user;
}

export async function fetchTrashItems() {
  const supabase = await createClient();
  const authUser = await getAuthUser(supabase);

  // Get user profile for family_id
  const { data: userData } = await supabase
    .from('users')
    .select('family_id')
    .eq('id', authUser.id)
    .single();

  if (!userData?.family_id) return [];

  const familyId = userData.family_id;

  // 1. Fetch soft-deleted documents
  const { data: docTrash, error: docErr } = await supabase
    .from('documents')
    .select('*')
    .eq('family_id', familyId)
    .not('deleted_at', 'is', null)
    .order('deleted_at', { ascending: false });

  // 2. Fetch generic trash items (passwords, assets, memories)
  const { data: genericTrash, error: genErr } = await supabase
    .from('trash_items')
    .select('*')
    .eq('family_id', familyId)
    .order('deleted_at', { ascending: false });

  const trashList: any[] = [];

  if (docTrash) {
    docTrash.forEach((d: any) => {
      trashList.push({
        id: d.id,
        name: d.name,
        type: 'documents',
        deleted_at: d.deleted_at,
        metadata: { category: d.category, size: d.file_size },
      });
    });
  }

  if (genericTrash) {
    genericTrash.forEach((g: any) => {
      const data = g.resource_data || {};
      trashList.push({
        id: g.id,
        name: data.title || data.name || `Unnamed ${g.resource_type} entry`,
        type: g.resource_type,
        deleted_at: g.deleted_at,
        resourceId: g.resource_id,
        metadata: data,
      });
    });
  }

  // Sort merged list by deleted_at descending
  return trashList.sort((a, b) => new Date(b.deleted_at).getTime() - new Date(a.deleted_at).getTime());
}

export async function restoreTrashItem(id: string, type: string) {
  const supabase = await createClient();
  const authUser = await getAuthUser(supabase);

  const { data: userData } = await supabase
    .from('users')
    .select('family_id')
    .eq('id', authUser.id)
    .single();

  if (!userData?.family_id) throw new Error('Unauthorized');

  if (type === 'documents') {
    // 1. Restore soft-deleted document
    const { error } = await supabase
      .from('documents')
      .update({ deleted_at: null })
      .eq('id', id)
      .eq('family_id', userData.family_id);

    if (error) throw error;
  } else {
    // 2. Restore generic trash item
    const { data: trashRecord, error: fetchErr } = await supabase
      .from('trash_items')
      .select('*')
      .eq('id', id)
      .eq('family_id', userData.family_id)
      .single();

    if (fetchErr || !trashRecord) throw new Error('Trash item not found');

    const resourceData = trashRecord.resource_data;
    const tableName = trashRecord.resource_type;

    // Insert back into original table
    const { error: insertErr } = await supabase
      .from(tableName)
      .insert(resourceData);

    if (insertErr) throw insertErr;

    // Delete from trash_items
    const { error: deleteErr } = await supabase
      .from('trash_items')
      .delete()
      .eq('id', id);

    if (deleteErr) throw deleteErr;
  }

  // Audit log
  await supabase.from('audit_logs').insert({
    family_id: userData.family_id,
    user_id: authUser.id,
    action: 'restore_trash_item',
    resource_type: type,
    metadata: { item_id: id },
  });

  return { success: true };
}

export async function permanentDeleteTrashItem(id: string, type: string) {
  const supabase = await createClient();
  const authUser = await getAuthUser(supabase);

  const { data: userData } = await supabase
    .from('users')
    .select('family_id')
    .eq('id', authUser.id)
    .single();

  if (!userData?.family_id) throw new Error('Unauthorized');

  if (type === 'documents') {
    // Hard delete document
    const { error } = await supabase
      .from('documents')
      .delete()
      .eq('id', id)
      .eq('family_id', userData.family_id);

    if (error) throw error;
  } else {
    // Hard delete generic trash item row
    const { error } = await supabase
      .from('trash_items')
      .delete()
      .eq('id', id)
      .eq('family_id', userData.family_id);

    if (error) throw error;
  }

  // Audit log
  await supabase.from('audit_logs').insert({
    family_id: userData.family_id,
    user_id: authUser.id,
    action: 'purge_trash_item',
    resource_type: type,
    metadata: { item_id: id },
  });

  return { success: true };
}

export async function emptyTrash() {
  const supabase = await createClient();
  const authUser = await getAuthUser(supabase);

  const { data: userData } = await supabase
    .from('users')
    .select('family_id')
    .eq('id', authUser.id)
    .single();

  if (!userData?.family_id) throw new Error('Unauthorized');

  const familyId = userData.family_id;

  // 1. Purge all soft-deleted documents
  const { error: docErr } = await supabase
    .from('documents')
    .delete()
    .eq('family_id', familyId)
    .not('deleted_at', 'is', null);

  if (docErr) throw docErr;

  // 2. Purge all generic trash items
  const { error: genErr } = await supabase
    .from('trash_items')
    .delete()
    .eq('family_id', familyId);

  if (genErr) throw genErr;

  // Audit log
  await supabase.from('audit_logs').insert({
    family_id: familyId,
    user_id: authUser.id,
    action: 'empty_trash',
    resource_type: 'system',
    metadata: { cleared_all: true },
  });

  return { success: true };
}
