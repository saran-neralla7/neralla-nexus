'use server';

import { createClient } from '@/lib/supabase/server';

async function getAuthUser(supabase: any) {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error('Unauthorized');
  return user;
}

export async function fetchAuditLogs() {
  const supabase = await createClient();
  const authUser = await getAuthUser(supabase);

  // Retrieve requesting user profile
  const { data: userData } = await supabase
    .from('users')
    .select('family_id, role, is_owner')
    .eq('id', authUser.id)
    .single();

  if (!userData?.family_id) {
    throw new Error('User family configuration not found.');
  }

  // Double check client-side access control
  if (userData.role !== 'owner' && !userData.is_owner) {
    throw new Error('Access denied. Only the family owner can inspect audit trails.');
  }

  // Fetch audit logs joining user info
  const { data: logs, error } = await supabase
    .from('audit_logs')
    .select(`
      id,
      family_id,
      user_id,
      action,
      resource_type,
      resource_id,
      metadata,
      ip_address,
      created_at,
      users:user_id (
        full_name,
        email
      )
    `)
    .eq('family_id', userData.family_id)
    .order('created_at', { ascending: false })
    .limit(300); // Fetch top 300 logs for performance

  if (error) {
    throw new Error(error.message || 'Failed to fetch audit log trail.');
  }

  return logs || [];
}
