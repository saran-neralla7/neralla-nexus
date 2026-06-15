-- ============================================
-- NERALLA NEXUS — PHASE 8 & 9 GAMIFICATION, OFFLINE QUEUE, AND SYSTEM FEATURES
-- Migration 008: Next Phase Features
-- ============================================

-- 1. Add points column to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS points INTEGER DEFAULT 0;

-- 2. Create gamification_logs table
CREATE TABLE IF NOT EXISTS gamification_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  points_earned INTEGER NOT NULL,
  reason TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- 3. Create offline_queue table
CREATE TABLE IF NOT EXISTS offline_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- Enable RLS
ALTER TABLE gamification_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE offline_queue ENABLE ROW LEVEL SECURITY;

-- RLS Policies for gamification_logs
CREATE POLICY "Members can view gamification logs"
  ON gamification_logs FOR SELECT
  USING (family_id = get_my_family_id());

CREATE POLICY "Users can manage gamification logs for their family"
  ON gamification_logs FOR ALL
  USING (family_id = get_my_family_id());

-- RLS Policies for offline_queue
CREATE POLICY "Users can manage own offline queue"
  ON offline_queue FOR ALL
  USING (user_id = auth.uid());

-- 4. Triggers for points gamification

-- A. Todo Completed/Uncompleted Points Trigger (+10 / -10)
CREATE OR REPLACE FUNCTION trg_todos_gamification()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id UUID;
  v_family_id UUID;
BEGIN
  -- Determine who gets the points (or who loses them)
  IF TG_OP = 'DELETE' THEN
    v_user_id := COALESCE(OLD.assigned_to, OLD.created_by);
    v_family_id := OLD.family_id;
  ELSE
    v_user_id := COALESCE(NEW.assigned_to, NEW.created_by);
    v_family_id := NEW.family_id;
  END IF;

  IF v_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'completed' THEN
      UPDATE users SET points = COALESCE(points, 0) + 10 WHERE id = v_user_id;
      INSERT INTO gamification_logs (family_id, user_id, points_earned, reason)
      VALUES (v_family_id, v_user_id, 10, 'Completed todo: ' || NEW.title);
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status != 'completed' AND NEW.status = 'completed' THEN
      UPDATE users SET points = COALESCE(points, 0) + 10 WHERE id = v_user_id;
      INSERT INTO gamification_logs (family_id, user_id, points_earned, reason)
      VALUES (v_family_id, v_user_id, 10, 'Completed todo: ' || NEW.title);
    ELSIF OLD.status = 'completed' AND NEW.status != 'completed' THEN
      UPDATE users SET points = GREATEST(0, COALESCE(points, 0) - 10) WHERE id = v_user_id;
      INSERT INTO gamification_logs (family_id, user_id, points_earned, reason)
      VALUES (v_family_id, v_user_id, -10, 'Uncompleted todo: ' || NEW.title);
    ELSIF OLD.status = 'completed' AND NEW.status = 'completed' AND COALESCE(OLD.assigned_to, OLD.created_by) != v_user_id THEN
      -- Reassigned completed todo
      IF COALESCE(OLD.assigned_to, OLD.created_by) IS NOT NULL THEN
        UPDATE users SET points = GREATEST(0, COALESCE(points, 0) - 10) WHERE id = COALESCE(OLD.assigned_to, OLD.created_by);
        INSERT INTO gamification_logs (family_id, user_id, points_earned, reason)
        VALUES (OLD.family_id, COALESCE(OLD.assigned_to, OLD.created_by), -10, 'Todo reassigned: ' || NEW.title);
      END IF;
      UPDATE users SET points = COALESCE(points, 0) + 10 WHERE id = v_user_id;
      INSERT INTO gamification_logs (family_id, user_id, points_earned, reason)
      VALUES (v_family_id, v_user_id, 10, 'Assigned completed todo: ' || NEW.title);
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.status = 'completed' THEN
      UPDATE users SET points = GREATEST(0, COALESCE(points, 0) - 10) WHERE id = v_user_id;
      INSERT INTO gamification_logs (family_id, user_id, points_earned, reason)
      VALUES (v_family_id, v_user_id, -10, 'Deleted completed todo: ' || OLD.title);
    END IF;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER trg_todos_gamification_after
AFTER INSERT OR UPDATE OR DELETE ON todos
FOR EACH ROW EXECUTE FUNCTION trg_todos_gamification();

-- B. Habit Logs Completion Points Trigger (+5 / -5)
CREATE OR REPLACE FUNCTION trg_habit_logs_gamification()
RETURNS TRIGGER AS $$
DECLARE
  v_habit_name TEXT;
  v_family_id UUID;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT name, family_id INTO v_habit_name, v_family_id FROM habits WHERE id = NEW.habit_id;
    UPDATE users SET points = COALESCE(points, 0) + 5 WHERE id = NEW.user_id;
    INSERT INTO gamification_logs (family_id, user_id, points_earned, reason)
    VALUES (v_family_id, NEW.user_id, 5, 'Completed habit: ' || COALESCE(v_habit_name, 'Habit'));
  ELSIF TG_OP = 'DELETE' THEN
    SELECT name, family_id INTO v_habit_name, v_family_id FROM habits WHERE id = OLD.habit_id;
    UPDATE users SET points = GREATEST(0, COALESCE(points, 0) - 5) WHERE id = OLD.user_id;
    INSERT INTO gamification_logs (family_id, user_id, points_earned, reason)
    VALUES (v_family_id, OLD.user_id, -5, 'Habit log deleted: ' || COALESCE(v_habit_name, 'Habit'));
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER trg_habit_logs_gamification_after
AFTER INSERT OR DELETE ON habit_logs
FOR EACH ROW EXECUTE FUNCTION trg_habit_logs_gamification();

-- C. Medication Logs Taken Points Trigger (+15 / -15)
CREATE OR REPLACE FUNCTION trg_medication_logs_gamification()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id UUID;
  v_family_id UUID;
  v_med_name TEXT;
  v_reminder_id UUID;
BEGIN
  v_reminder_id := COALESCE(NEW.reminder_id, OLD.reminder_id);
  
  SELECT fm.user_id, r.family_id, r.name 
  INTO v_user_id, v_family_id, v_med_name
  FROM medication_reminders r
  JOIN family_members fm ON r.member_id = fm.id
  WHERE r.id = v_reminder_id;

  IF v_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'taken' THEN
      UPDATE users SET points = COALESCE(points, 0) + 15 WHERE id = v_user_id;
      INSERT INTO gamification_logs (family_id, user_id, points_earned, reason)
      VALUES (v_family_id, v_user_id, 15, 'Took medication: ' || COALESCE(v_med_name, 'Medication'));
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status != 'taken' AND NEW.status = 'taken' THEN
      UPDATE users SET points = COALESCE(points, 0) + 15 WHERE id = v_user_id;
      INSERT INTO gamification_logs (family_id, user_id, points_earned, reason)
      VALUES (v_family_id, v_user_id, 15, 'Took medication: ' || COALESCE(v_med_name, 'Medication'));
    ELSIF OLD.status = 'taken' AND NEW.status != 'taken' THEN
      UPDATE users SET points = GREATEST(0, COALESCE(points, 0) - 15) WHERE id = v_user_id;
      INSERT INTO gamification_logs (family_id, user_id, points_earned, reason)
      VALUES (v_family_id, v_user_id, -15, 'Medication log undone: ' || COALESCE(v_med_name, 'Medication'));
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.status = 'taken' THEN
      UPDATE users SET points = GREATEST(0, COALESCE(points, 0) - 15) WHERE id = v_user_id;
      INSERT INTO gamification_logs (family_id, user_id, points_earned, reason)
      VALUES (v_family_id, v_user_id, -15, 'Medication log deleted: ' || COALESCE(v_med_name, 'Medication'));
    END IF;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER trg_medication_logs_gamification_after
AFTER INSERT OR UPDATE OR DELETE ON medication_logs
FOR EACH ROW EXECUTE FUNCTION trg_medication_logs_gamification();

-- 5. Seed system features for Phase 8 and Phase 9

-- Phase 8
INSERT INTO system_features (name, description, status, phase, module)
SELECT 'Habit Tracker', 'Tracks daily/weekly habits and logs completion streaks', 'completed', 8, 'habits'
WHERE NOT EXISTS (SELECT 1 FROM system_features WHERE name = 'Habit Tracker');

INSERT INTO system_features (name, description, status, phase, module)
SELECT 'Family Budget & Expenses', 'Split expenses, manage shared debts, and track balances', 'completed', 8, 'expenses'
WHERE NOT EXISTS (SELECT 1 FROM system_features WHERE name = 'Family Budget & Expenses');

INSERT INTO system_features (name, description, status, phase, module)
SELECT 'Task Manager (Todos)', 'Assign, track, and complete family tasks', 'completed', 8, 'todos'
WHERE NOT EXISTS (SELECT 1 FROM system_features WHERE name = 'Task Manager (Todos)');

INSERT INTO system_features (name, description, status, phase, module)
SELECT 'Vehicle Management', 'Log vehicle maintenance, documents, and usage logs', 'completed', 8, 'vehicles'
WHERE NOT EXISTS (SELECT 1 FROM system_features WHERE name = 'Vehicle Management');

INSERT INTO system_features (name, description, status, phase, module)
SELECT 'Shopping List', 'Real-time collaborative shopping list', 'completed', 8, 'shopping'
WHERE NOT EXISTS (SELECT 1 FROM system_features WHERE name = 'Shopping List');

-- Phase 9 (In Progress / Implementing)
INSERT INTO system_features (name, description, status, phase, module)
SELECT 'WhatsApp Wishing Bot', 'Automated birthday & anniversary wishes using Meta Cloud API', 'in_progress', 9, 'notifications'
WHERE NOT EXISTS (SELECT 1 FROM system_features WHERE name = 'WhatsApp Wishing Bot');

INSERT INTO system_features (name, description, status, phase, module)
SELECT 'One-Tap Emergency Panic', 'Emergency GPS broadcast to registered family members', 'in_progress', 9, 'emergency'
WHERE NOT EXISTS (SELECT 1 FROM system_features WHERE name = 'One-Tap Emergency Panic');

INSERT INTO system_features (name, description, status, phase, module)
SELECT 'Weekly Family Digest', 'Weekly Sunday summary emails via Resend', 'in_progress', 9, 'notifications'
WHERE NOT EXISTS (SELECT 1 FROM system_features WHERE name = 'Weekly Family Digest');

INSERT INTO system_features (name, description, status, phase, module)
SELECT 'Gamified Chores', 'Points leaderboard for completing todos, habits, and medication', 'in_progress', 9, 'dashboard'
WHERE NOT EXISTS (SELECT 1 FROM system_features WHERE name = 'Gamified Chores');

INSERT INTO system_features (name, description, status, phase, module)
SELECT 'Offline-First PWA Sync', 'Service worker background sync with IndexedDB queue', 'in_progress', 9, 'system'
WHERE NOT EXISTS (SELECT 1 FROM system_features WHERE name = 'Offline-First PWA Sync');
