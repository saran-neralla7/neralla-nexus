-- ============================================
-- NERALLA NEXUS — REMINDERS AND TODO ROLLOVER
-- Migration 009: Reminders and Todo Rollover
-- ============================================

-- 1. Create reminders table
CREATE TABLE IF NOT EXISTS reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  scheduled_time TIME NOT NULL,
  frequency TEXT DEFAULT 'daily', -- 'once', 'daily', 'weekly'
  days_of_week INTEGER[], -- 0 = Sunday, 1 = Monday, etc.
  is_active BOOLEAN DEFAULT TRUE,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- 2. Create reminder_logs table to keep track of reminders triggered
CREATE TABLE IF NOT EXISTS reminder_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reminder_id UUID NOT NULL REFERENCES reminders(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'notified', -- 'notified', 'dismissed'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
  UNIQUE(reminder_id, date)
);

-- 3. Add completed_at column to todos table to track completions per date
ALTER TABLE todos ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE;

-- 4. Enable Row Level Security (RLS)
ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminder_logs ENABLE ROW LEVEL SECURITY;

-- 5. Define RLS Policies for reminders
CREATE POLICY "Members can manage reminders for their family"
  ON reminders FOR ALL
  USING (family_id = get_my_family_id());

-- 6. Define RLS Policies for reminder_logs
CREATE POLICY "Members can manage reminder logs for their family"
  ON reminder_logs FOR ALL
  USING (reminder_id IN (SELECT id FROM reminders WHERE family_id = get_my_family_id()));

-- 7. Add system features for reminders
INSERT INTO system_features (name, description, status, phase, module)
SELECT 'General Reminders', 'Scheduled custom alerts and push notification reminders', 'completed', 10, 'notifications'
WHERE NOT EXISTS (SELECT 1 FROM system_features WHERE name = 'General Reminders');
