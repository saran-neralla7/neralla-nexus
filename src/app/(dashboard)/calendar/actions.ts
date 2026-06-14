'use server';

import { createClient } from '@/lib/supabase/server';

async function getAuthUser(supabase: any) {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error('Unauthorized');
  return user;
}

export async function fetchCalendarEvents() {
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

  // 1. Fetch custom events
  const { data: customEvents, error: customErr } = await supabase
    .from('calendar_events')
    .select('*')
    .eq('family_id', familyId)
    .order('start_at', { ascending: true });

  if (customErr) throw customErr;

  // 2. Fetch medical appointments
  const { data: medicalAppts, error: medicalErr } = await supabase
    .from('medical_records')
    .select('id, title, doctor, hospital, date, member_id')
    .eq('family_id', familyId)
    .eq('type', 'appointment')
    .order('date', { ascending: true });

  // 3. Fetch policy renewals
  const { data: policies, error: policyErr } = await supabase
    .from('policies')
    .select('id, name, provider, premium_date, expiry_date, member_id')
    .eq('family_id', familyId);

  // 4. Fetch family member birthdays
  const { data: members, error: membersErr } = await supabase
    .from('family_members')
    .select('id, full_name, date_of_birth')
    .eq('family_id', familyId);

  // 5. Fetch manual occasions
  const { data: occasions, error: occasionsErr } = await supabase
    .from('occasions')
    .select('id, name, type, date, relationship')
    .eq('family_id', familyId);

  const events: any[] = [];

  // Add custom events
  if (customEvents) {
    customEvents.forEach((e: any) => {
      events.push({
        id: e.id,
        title: e.title,
        description: e.description || '',
        start_at: e.start_at,
        end_at: e.end_at || e.start_at,
        type: e.type || 'other',
        all_day: e.all_day || false,
        members: e.members || [],
        recurrence: e.recurrence || null,
        reminder_at: e.reminder_at || null,
        sourceModule: 'calendar',
      });
    });
  }

  // Add medical appointments
  if (medicalAppts) {
    medicalAppts.forEach((app: any) => {
      if (app.date) {
        events.push({
          id: `medical-${app.id}`,
          title: `Medical Appt: ${app.title}`,
          description: `Doctor: ${app.doctor || 'N/A'}\nHospital: ${app.hospital || 'N/A'}`,
          start_at: app.date,
          end_at: app.date,
          type: 'medical',
          all_day: false,
          members: app.member_id ? [app.member_id] : [],
          sourceModule: 'medical',
          sourceId: app.id,
        });
      }
    });
  }

  // Add policies renewals
  if (policies) {
    policies.forEach((pol: any) => {
      // Expiry as event
      if (pol.expiry_date) {
        events.push({
          id: `policy-expiry-${pol.id}`,
          title: `Expiry: ${pol.name} (${pol.provider})`,
          description: `Insurance policy expiration date`,
          start_at: pol.expiry_date,
          end_at: pol.expiry_date,
          type: 'policy_renewal',
          all_day: true,
          members: pol.member_id ? [pol.member_id] : [],
          sourceModule: 'policies',
          sourceId: pol.id,
        });
      }
      // Premium Date as event
      if (pol.premium_date) {
        events.push({
          id: `policy-premium-${pol.id}`,
          title: `Premium Due: ${pol.name}`,
          description: `Insurance premium payment date`,
          start_at: pol.premium_date,
          end_at: pol.premium_date,
          type: 'policy_renewal',
          all_day: true,
          members: pol.member_id ? [pol.member_id] : [],
          sourceModule: 'policies',
          sourceId: pol.id,
        });
      }
    });
  }

  // Add birthdays (we repeat them for current, previous, and next year to ensure they appear on calendar view)
  if (members) {
    const currentYear = new Date().getFullYear();
    members.forEach((m: any) => {
      if (m.date_of_birth) {
        const dob = new Date(m.date_of_birth);
        // Create birthday events for currentYear - 1, currentYear, currentYear + 1
        for (let y = currentYear - 1; y <= currentYear + 1; y++) {
          const bdayDate = new Date(dob);
          bdayDate.setFullYear(y);
          events.push({
            id: `birthday-${m.id}-${y}`,
            title: `🎂 Birthday: ${m.full_name}`,
            description: `${m.full_name}'s birthday (Born ${dob.toLocaleDateString()})`,
            start_at: bdayDate.toISOString(),
            end_at: bdayDate.toISOString(),
            type: 'birthday',
            all_day: true,
            members: [m.id],
            sourceModule: 'family',
            sourceId: m.id,
          });
        }
      }
    });
  }

  // Add manual occasions (recurring annually)
  if (occasions) {
    const currentYear = new Date().getFullYear();
    occasions.forEach((occ: any) => {
      if (occ.date) {
        const occDate = new Date(occ.date);
        const emoji = occ.type === 'birthday' ? '🎂' : occ.type === 'anniversary' ? '💍' : '📅';
        const label = occ.type === 'birthday' ? 'Birthday' : occ.type === 'anniversary' ? 'Anniversary' : 'Key Date';
        
        for (let y = currentYear - 1; y <= currentYear + 1; y++) {
          const recurrenceDate = new Date(occDate);
          recurrenceDate.setFullYear(y);
          events.push({
            id: `occasion-${occ.id}-${y}`,
            title: `${emoji} ${label}: ${occ.name}`,
            description: `${occ.name}'s ${occ.type} (${occ.relationship})`,
            start_at: recurrenceDate.toISOString(),
            end_at: recurrenceDate.toISOString(),
            type: occ.type,
            all_day: true,
            members: [],
            sourceModule: 'occasions',
            sourceId: occ.id,
          });
        }
      }
    });
  }

  return events;
}

export async function createCalendarEvent(data: {
  title: string;
  description?: string;
  type: string;
  start_at: string;
  end_at?: string;
  all_day?: boolean;
  members?: string[];
  recurrence?: any;
  reminder_at?: string;
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
    .from('calendar_events')
    .insert({
      family_id: userData.family_id,
      title: data.title,
      description: data.description || null,
      type: data.type || 'other',
      start_at: data.start_at,
      end_at: data.end_at || null,
      all_day: data.all_day || false,
      members: data.members || [],
      recurrence: data.recurrence || null,
      reminder_at: data.reminder_at || null,
      created_by: authUser.id,
    });

  if (error) throw error;
  return { success: true };
}

export async function updateCalendarEvent(
  id: string,
  data: {
    title: string;
    description?: string;
    type: string;
    start_at: string;
    end_at?: string;
    all_day?: boolean;
    members?: string[];
    recurrence?: any;
    reminder_at?: string;
  }
) {
  const supabase = await createClient();
  const authUser = await getAuthUser(supabase);

  // Check family ownership
  const { data: currentEntry } = await supabase
    .from('calendar_events')
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
    .from('calendar_events')
    .update({
      title: data.title,
      description: data.description || null,
      type: data.type || 'other',
      start_at: data.start_at,
      end_at: data.end_at || null,
      all_day: data.all_day || false,
      members: data.members || [],
      recurrence: data.recurrence || null,
      reminder_at: data.reminder_at || null,
    })
    .eq('id', id);

  if (error) throw error;
  return { success: true };
}

export async function deleteCalendarEvent(id: string) {
  const supabase = await createClient();
  const authUser = await getAuthUser(supabase);

  // Check family ownership
  const { data: currentEntry } = await supabase
    .from('calendar_events')
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
    .from('calendar_events')
    .delete()
    .eq('id', id);

  if (error) throw error;
  return { success: true };
}
