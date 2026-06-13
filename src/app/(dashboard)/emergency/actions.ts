'use server';

import { createClient } from '@/lib/supabase/server';

async function getAuthUser(supabase: any) {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error('Unauthorized');
  return user;
}

export async function fetchEmergencyData() {
  const supabase = await createClient();
  const authUser = await getAuthUser(supabase);

  // Get user profile for family_id
  const { data: userData } = await supabase
    .from('users')
    .select('family_id')
    .eq('id', authUser.id)
    .single();

  if (!userData?.family_id) {
    return {
      members: [],
      contacts: [],
      documents: [],
    };
  }

  const familyId = userData.family_id;

  // 1. Fetch family members with vital records
  const { data: members, error: membersErr } = await supabase
    .from('family_members')
    .select('*')
    .eq('family_id', familyId)
    .order('full_name');

  if (membersErr) throw membersErr;

  // 2. Fetch emergency contacts (where is_emergency is true)
  const { data: contacts, error: contactsErr } = await supabase
    .from('trusted_contacts')
    .select('*')
    .eq('family_id', familyId)
    .eq('is_emergency', true)
    .order('name');

  if (contactsErr) throw contactsErr;

  // 3. Fetch critical vault documents (category = 'medical' or 'insurance' or tags include 'emergency')
  // We will fetch up to 20 documents that might be needed in an emergency.
  const { data: documents, error: docsErr } = await supabase
    .from('documents')
    .select('*')
    .eq('family_id', familyId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (docsErr) throw docsErr;

  const emergencyDocs = (documents || []).filter((doc: any) => {
    const isCategory = ['medical', 'insurance', 'passport', 'property'].includes(doc.category);
    const hasTag = doc.tags && (
      doc.tags.includes('emergency') || 
      doc.tags.includes('urgent') || 
      doc.tags.includes('critical') ||
      doc.tags.includes('vital')
    );
    return isCategory || hasTag;
  });

  return {
    members: members || [],
    contacts: contacts || [],
    documents: emergencyDocs,
  };
}

export async function triggerSOSEmailAlert() {
  const supabase = await createClient();
  const authUser = await getAuthUser(supabase);

  // Get user profile for family_id and current user info
  const { data: userData } = await supabase
    .from('users')
    .select('full_name, family_id')
    .eq('id', authUser.id)
    .single();

  if (!userData) throw new Error('User details not found');

  // Fetch family members' emails to notify them
  const { data: familyMembers } = await supabase
    .from('family_members')
    .select('full_name, email')
    .eq('family_id', userData.family_id);

  const notifyList = (familyMembers || [])
    .map((m: any) => m.email)
    .filter((email: string) => email && email.trim() !== '');

  // Log in Audit Logs
  await supabase.from('audit_logs').insert({
    family_id: userData.family_id,
    user_id: authUser.id,
    action: 'sos_trigger',
    resource_type: 'emergency',
    metadata: {
      triggered_by: userData.full_name,
      recipients_notified: notifyList,
    },
  });

  // Create an in-app notification for all users of the family
  const { data: familyUsers } = await supabase
    .from('users')
    .select('id')
    .eq('family_id', userData.family_id);

  if (familyUsers && familyUsers.length > 0) {
    const notificationsToInsert = familyUsers.map((u: any) => ({
      family_id: userData.family_id,
      user_id: u.id,
      type: 'system',
      title: '🚨 EMERGENCY SOS TRIGGERED',
      body: `${userData.full_name} has triggered an SOS alert! Please check on them immediately.`,
      data: { triggered_by: userData.full_name, type: 'SOS' },
    }));

    await supabase.from('notifications').insert(notificationsToInsert);
  }

  return { 
    success: true, 
    notifiedCount: notifyList.length,
    recipients: notifyList 
  };
}
