'use server';

import { createClient } from '@/lib/supabase/server';

// Helper to get authenticated user from supabase
async function getAuthUser(supabase: any) {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error('Unauthorized');
  return user;
}

// Get user profile details
async function getUserProfile(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();
  if (error || !data) throw new Error('User profile not found');
  return data;
}

/**
 * Fetches all vehicles in the family.
 */
export async function fetchVehicles() {
  const supabase = await createClient();
  const authUser = await getAuthUser(supabase);
  const currentUserProfile = await getUserProfile(supabase, authUser.id);

  const { data, error } = await supabase
    .from('vehicles')
    .select('*')
    .eq('family_id', currentUserProfile.family_id)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

/**
 * Creates a new vehicle.
 */
export async function createVehicle(vehicleData: {
  make: string;
  model: string;
  plate_number: string;
}) {
  const supabase = await createClient();
  const authUser = await getAuthUser(supabase);
  const currentUserProfile = await getUserProfile(supabase, authUser.id);

  const { error } = await supabase
    .from('vehicles')
    .insert({
      family_id: currentUserProfile.family_id,
      make: vehicleData.make,
      model: vehicleData.model,
      plate_number: vehicleData.plate_number,
    });

  if (error) throw error;
  return { success: true };
}

/**
 * Fetches maintenance logs for a specific vehicle.
 */
export async function fetchVehicleLogs(vehicleId: string) {
  const supabase = await createClient();
  const authUser = await getAuthUser(supabase);
  const currentUserProfile = await getUserProfile(supabase, authUser.id);

  // Verify vehicle family ownership
  const { data: vehicle, error: vehicleErr } = await supabase
    .from('vehicles')
    .select('family_id')
    .eq('id', vehicleId)
    .single();

  if (vehicleErr || !vehicle) throw new Error('Vehicle not found');
  if (vehicle.family_id !== currentUserProfile.family_id) throw new Error('Access denied');

  const { data, error } = await supabase
    .from('vehicle_logs')
    .select('*')
    .eq('vehicle_id', vehicleId)
    .order('date', { ascending: false });

  if (error) throw error;
  return data || [];
}

/**
 * Creates a maintenance/upkeep log entry and automatically syncs it to the Unified Calendar if it has an expiry date.
 */
export async function createVehicleLog(logData: {
  vehicleId: string;
  type: string;
  cost: number;
  odometer?: number;
  date: string;
  notes?: string;
  expiry_date?: string;
}) {
  const supabase = await createClient();
  const authUser = await getAuthUser(supabase);
  const currentUserProfile = await getUserProfile(supabase, authUser.id);

  // Verify vehicle ownership
  const { data: vehicle, error: vehicleErr } = await supabase
    .from('vehicles')
    .select('*')
    .eq('id', logData.vehicleId)
    .single();

  if (vehicleErr || !vehicle) throw new Error('Vehicle not found');
  if (vehicle.family_id !== currentUserProfile.family_id) throw new Error('Access denied');

  // Insert log
  const { data: newLog, error: logErr } = await supabase
    .from('vehicle_logs')
    .insert({
      vehicle_id: logData.vehicleId,
      type: logData.type,
      cost: logData.cost,
      odometer: logData.odometer || null,
      date: logData.date,
      notes: logData.notes || '',
      expiry_date: logData.expiry_date || null,
    })
    .select()
    .single();

  if (logErr) throw logErr;

  // Sync to calendar if it has an expiry date (e.g. Insurance expiry, Pollution control check expiry)
  if (logData.expiry_date) {
    const title = `${vehicle.make} ${vehicle.model} (${vehicle.plate_number}) - ${logData.type.toUpperCase()} Renewal`;
    const desc = `Renewal/Expiry date for vehicle ${logData.type}. Log details: ${logData.notes || 'No details provided.'}`;

    const { error: calErr } = await supabase
      .from('calendar_events')
      .insert({
        family_id: currentUserProfile.family_id,
        title,
        description: desc,
        type: 'policy_renewal',
        start_at: new Date(logData.expiry_date).toISOString(),
        end_at: new Date(logData.expiry_date).toISOString(),
        all_day: true,
        created_by: authUser.id,
        metadata: {
          source: 'vehicle_log',
          vehicle_id: vehicle.id,
          log_id: newLog.id,
        },
      });

    if (calErr) console.error('Failed to sync vehicle log expiry to calendar:', calErr);
  }

  return { success: true };
}
