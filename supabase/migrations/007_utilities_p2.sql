-- ============================================
-- NERALLA NEXUS — PHASE 9, 10, 11 & 12 SCHEMAS
-- Migration 007: Occasions, Push Subscriptions, Passkeys, Medication
-- ============================================

-- 1. Occasions Tracker
CREATE TABLE IF NOT EXISTS occasions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL, -- 'birthday', 'anniversary', 'other'
  date DATE NOT NULL,
  relationship TEXT NOT NULL, -- 'family', 'friend', 'other'
  reminder_days INTEGER DEFAULT 1,
  notes TEXT,
  phone TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- 2. Push Subscriptions
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subscription JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- 3. Biometric Passkey Credentials
CREATE TABLE IF NOT EXISTS passkey_credentials (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  public_key TEXT NOT NULL,
  counter BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- 4. Medication Reminders
CREATE TABLE IF NOT EXISTS medication_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES family_members(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  dosage TEXT,
  scheduled_time TIME NOT NULL,
  frequency TEXT DEFAULT 'daily',
  days_of_week INTEGER[],
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- 5. Medication Logs
CREATE TABLE IF NOT EXISTS medication_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reminder_id UUID NOT NULL REFERENCES medication_reminders(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- 'taken', 'skipped', 'snoozed'
  snoozed_until TIMESTAMP WITH TIME ZONE,
  logged_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
  UNIQUE(reminder_id, date)
);

-- Enable RLS
ALTER TABLE occasions ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE passkey_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE medication_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE medication_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Occasions
CREATE POLICY "Members can view occasions in family"
  ON occasions FOR SELECT
  USING (family_id = get_my_family_id());

CREATE POLICY "Members can manage occasions in family"
  ON occasions FOR ALL
  USING (family_id = get_my_family_id());

-- Push Subscriptions
CREATE POLICY "Users can manage own push subscriptions"
  ON push_subscriptions FOR ALL
  USING (user_id = auth.uid());

-- Passkeys
CREATE POLICY "Users can manage own passkeys"
  ON passkey_credentials FOR ALL
  USING (user_id = auth.uid());

-- Medication Reminders
CREATE POLICY "Members can view medication schedules"
  ON medication_reminders FOR SELECT
  USING (family_id = get_my_family_id());

CREATE POLICY "Members can manage medication schedules"
  ON medication_reminders FOR ALL
  USING (family_id = get_my_family_id());

-- Medication Logs
CREATE POLICY "Members can view medication logs"
  ON medication_logs FOR SELECT
  USING ((SELECT family_id FROM medication_reminders WHERE id = reminder_id) = get_my_family_id());

CREATE POLICY "Members can manage medication logs"
  ON medication_logs FOR ALL
  USING ((SELECT family_id FROM medication_reminders WHERE id = reminder_id) = get_my_family_id());
