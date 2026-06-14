-- ============================================
-- NERALLA NEXUS — PHASE 8 UTILITIES EXTENSION
-- Migration 005: Habits, Expenses, Todos, Vehicles, Shopping
-- ============================================

-- 1. Modify Passwords table to support integrated Subscriptions
ALTER TABLE passwords 
  ADD COLUMN IF NOT EXISTS cost DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS billing_cycle TEXT DEFAULT 'monthly', -- 'monthly', 'quarterly', 'yearly'
  ADD COLUMN IF NOT EXISTS next_billing_date DATE,
  ADD COLUMN IF NOT EXISTS is_subscription BOOLEAN DEFAULT FALSE;

-- 2. Habits Tracker
CREATE TABLE IF NOT EXISTS habits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID REFERENCES families(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE, -- Owner of this habit
  name TEXT NOT NULL,
  description TEXT,
  frequency TEXT NOT NULL DEFAULT 'daily', -- 'daily', 'weekly'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- 3. Habit Logs
CREATE TABLE IF NOT EXISTS habit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  habit_id UUID REFERENCES habits(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL, -- YYYY-MM-DD
  logged_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
  UNIQUE(habit_id, user_id, date)
);

-- 4. Expenses (Solo and Common/Trip tracking)
CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID REFERENCES families(id) ON DELETE CASCADE,
  amount DECIMAL(12,2) NOT NULL,
  category TEXT NOT NULL, -- 'groceries', 'utilities', 'rent', 'travel', 'entertainment', 'other'
  description TEXT,
  paid_by UUID REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'solo', -- 'solo' (private daily outlay) or 'common' (shared/trip)
  date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- 4b. Expense Participants (supporting member checkboxes & custom non-members)
CREATE TABLE IF NOT EXISTS expense_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id UUID REFERENCES expenses(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE, -- NULL if non-member guest
  custom_name TEXT, -- NULL if family member
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- 5. Family Todos (isolated per member)
CREATE TABLE IF NOT EXISTS todos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID REFERENCES families(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  due_date DATE,
  priority TEXT NOT NULL DEFAULT 'medium', -- 'low', 'medium', 'high'
  status TEXT NOT NULL DEFAULT 'todo', -- 'todo', 'in_progress', 'completed'
  assigned_to UUID REFERENCES users(id) ON DELETE SET NULL, -- Assigned member
  created_by UUID REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- 6. Vehicles Directory
CREATE TABLE IF NOT EXISTS vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID REFERENCES families(id) ON DELETE CASCADE,
  make TEXT NOT NULL,
  model TEXT NOT NULL,
  plate_number TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- 7. Vehicle Log (Upkeep, Fuel, Repairs)
CREATE TABLE IF NOT EXISTS vehicle_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID REFERENCES vehicles(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- 'service', 'fuel', 'insurance', 'pollution', 'repair', 'other'
  cost DECIMAL(10,2) NOT NULL,
  odometer INTEGER,
  date DATE NOT NULL,
  notes TEXT,
  expiry_date DATE, -- For insurance policies and pollution checks
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- 8. Shared Shopping & Pantry List
CREATE TABLE IF NOT EXISTS shopping_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID REFERENCES families(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  quantity TEXT DEFAULT '1',
  category TEXT, -- 'pantry', 'groceries', 'household', 'other'
  is_completed BOOLEAN DEFAULT FALSE,
  added_by UUID REFERENCES users(id) ON DELETE CASCADE,
  completed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- Enable RLS on all tables
ALTER TABLE habits ENABLE ROW LEVEL SECURITY;
ALTER TABLE habit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE todos ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE shopping_items ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS POLICIES FOR NEW TABLES
-- ============================================

-- 1. Habits
CREATE POLICY "Members can view habits in family"
  ON habits FOR SELECT
  USING (family_id = get_my_family_id() AND (user_id = auth.uid() OR is_owner()));

CREATE POLICY "Members can insert own habits"
  ON habits FOR INSERT
  WITH CHECK (family_id = get_my_family_id() AND user_id = auth.uid());

CREATE POLICY "Members/Owner can update habits in family"
  ON habits FOR UPDATE
  USING (family_id = get_my_family_id() AND (user_id = auth.uid() OR is_owner()));

CREATE POLICY "Members/Owner can delete habits in family"
  ON habits FOR DELETE
  USING (family_id = get_my_family_id() AND (user_id = auth.uid() OR is_owner()));

-- 2. Habit Logs
CREATE POLICY "Members can view habit logs in family"
  ON habit_logs FOR SELECT
  USING (user_id = auth.uid() OR is_owner());

CREATE POLICY "Members can insert own habit logs"
  ON habit_logs FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Members/Owner can update own habit logs"
  ON habit_logs FOR UPDATE
  USING (user_id = auth.uid() OR is_owner());

CREATE POLICY "Members/Owner can delete own habit logs"
  ON habit_logs FOR DELETE
  USING (user_id = auth.uid() OR is_owner());

-- 3. Expenses
CREATE POLICY "Members can view expenses in family"
  ON expenses FOR SELECT
  USING (family_id = get_my_family_id() AND (type = 'common' OR paid_by = auth.uid() OR is_owner()));

CREATE POLICY "Members can insert own expenses"
  ON expenses FOR INSERT
  WITH CHECK (family_id = get_my_family_id() AND paid_by = auth.uid());

CREATE POLICY "Members/Owner can update expenses in family"
  ON expenses FOR UPDATE
  USING (family_id = get_my_family_id() AND (paid_by = auth.uid() OR is_owner()));

CREATE POLICY "Members/Owner can delete expenses in family"
  ON expenses FOR DELETE
  USING (family_id = get_my_family_id() AND (paid_by = auth.uid() OR is_owner()));

-- 3b. Expense Participants
CREATE POLICY "Members can view expense participants"
  ON expense_participants FOR SELECT
  USING ((SELECT family_id FROM expenses WHERE id = expense_id) = get_my_family_id());

CREATE POLICY "Members can manage expense participants"
  ON expense_participants FOR ALL
  USING ((SELECT family_id FROM expenses WHERE id = expense_id) = get_my_family_id());

-- 4. Todos
CREATE POLICY "Members can view assigned/created todos in family"
  ON todos FOR SELECT
  USING (family_id = get_my_family_id() AND (assigned_to = auth.uid() OR created_by = auth.uid() OR is_owner()));

CREATE POLICY "Members can insert todos"
  ON todos FOR INSERT
  WITH CHECK (family_id = get_my_family_id());

CREATE POLICY "Members can update assigned/created todos"
  ON todos FOR UPDATE
  USING (family_id = get_my_family_id() AND (assigned_to = auth.uid() OR created_by = auth.uid() OR is_owner()));

CREATE POLICY "Members can delete own/created todos"
  ON todos FOR DELETE
  USING (family_id = get_my_family_id() AND (created_by = auth.uid() OR is_owner()));

-- 5. Vehicles
CREATE POLICY "Members can view vehicles"
  ON vehicles FOR SELECT
  USING (family_id = get_my_family_id());

CREATE POLICY "Members can manage vehicles"
  ON vehicles FOR ALL
  USING (family_id = get_my_family_id());

-- 6. Vehicle Logs
CREATE POLICY "Members can view vehicle logs"
  ON vehicle_logs FOR SELECT
  USING ((SELECT family_id FROM vehicles WHERE id = vehicle_id) = get_my_family_id());

CREATE POLICY "Members can manage vehicle logs"
  ON vehicle_logs FOR ALL
  USING ((SELECT family_id FROM vehicles WHERE id = vehicle_id) = get_my_family_id());

-- 7. Shopping Items
CREATE POLICY "Members can view shopping items"
  ON shopping_items FOR SELECT
  USING (family_id = get_my_family_id());

CREATE POLICY "Members can manage shopping items"
  ON shopping_items FOR ALL
  USING (family_id = get_my_family_id());
