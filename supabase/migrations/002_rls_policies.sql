-- ============================================
-- NERALLA NEXUS — RLS POLICIES
-- Migration 002: Row Level Security
-- ============================================

-- Enable RLS on all tables
ALTER TABLE families ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE passwords ENABLE ROW LEVEL SECURITY;
ALTER TABLE medical_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_tree_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE trusted_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE trash_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE digital_legacy ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_features ENABLE ROW LEVEL SECURITY;

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Get the current user's family_id
CREATE OR REPLACE FUNCTION get_my_family_id()
RETURNS UUID AS $$
  SELECT family_id FROM users WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Check if current user is owner or admin
CREATE OR REPLACE FUNCTION is_owner_or_admin()
RETURNS BOOLEAN AS $$
  SELECT role IN ('owner', 'admin') FROM users WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Check if current user is owner
CREATE OR REPLACE FUNCTION is_owner()
RETURNS BOOLEAN AS $$
  SELECT is_owner FROM users WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================
-- FAMILIES POLICIES
-- ============================================
CREATE POLICY "Users can view their own family"
  ON families FOR SELECT
  USING (id = get_my_family_id());

CREATE POLICY "Owner/Admin can update family"
  ON families FOR UPDATE
  USING (id = get_my_family_id() AND is_owner_or_admin());

-- ============================================
-- USERS POLICIES
-- ============================================
CREATE POLICY "Users can view family members"
  ON users FOR SELECT
  USING (family_id = get_my_family_id());

CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  USING (id = auth.uid());

CREATE POLICY "Owner/Admin can insert users"
  ON users FOR INSERT
  WITH CHECK (family_id = get_my_family_id() AND is_owner_or_admin());

CREATE POLICY "Owner/Admin can delete users (not owner)"
  ON users FOR DELETE
  USING (family_id = get_my_family_id() AND is_owner_or_admin() AND is_owner = FALSE);

-- ============================================
-- FAMILY MEMBERS POLICIES
-- ============================================
CREATE POLICY "Members can view family members"
  ON family_members FOR SELECT
  USING (family_id = get_my_family_id());

CREATE POLICY "Owner/Admin can manage family members"
  ON family_members FOR ALL
  USING (family_id = get_my_family_id() AND is_owner_or_admin());

-- ============================================
-- DOCUMENTS POLICIES
-- ============================================
CREATE POLICY "Members can view non-deleted documents"
  ON documents FOR SELECT
  USING (family_id = get_my_family_id() AND deleted_at IS NULL);

CREATE POLICY "Members can insert documents"
  ON documents FOR INSERT
  WITH CHECK (family_id = get_my_family_id());

CREATE POLICY "Owner/Admin or creator can update documents"
  ON documents FOR UPDATE
  USING (family_id = get_my_family_id() AND (is_owner_or_admin() OR created_by = auth.uid()));

CREATE POLICY "Owner/Admin or creator can delete documents"
  ON documents FOR DELETE
  USING (family_id = get_my_family_id() AND (is_owner_or_admin() OR created_by = auth.uid()));

-- ============================================
-- PASSWORDS POLICIES
-- ============================================
CREATE POLICY "Members can view non-deleted passwords"
  ON passwords FOR SELECT
  USING (family_id = get_my_family_id() AND deleted_at IS NULL);

CREATE POLICY "Members can insert passwords"
  ON passwords FOR INSERT
  WITH CHECK (family_id = get_my_family_id());

CREATE POLICY "Owner/Admin or creator can update passwords"
  ON passwords FOR UPDATE
  USING (family_id = get_my_family_id() AND (is_owner_or_admin() OR created_by = auth.uid()));

CREATE POLICY "Owner/Admin or creator can delete passwords"
  ON passwords FOR DELETE
  USING (family_id = get_my_family_id() AND (is_owner_or_admin() OR created_by = auth.uid()));

-- ============================================
-- OTHER MODULE POLICIES (All follow same family isolation pattern)
-- ============================================

-- Medical Records
CREATE POLICY "Members can view medical records"
  ON medical_records FOR SELECT USING (family_id = get_my_family_id());
CREATE POLICY "Members can manage medical records"
  ON medical_records FOR ALL USING (family_id = get_my_family_id());

-- Policies
CREATE POLICY "Members can view policies"
  ON policies FOR SELECT USING (family_id = get_my_family_id());
CREATE POLICY "Members can manage policies"
  ON policies FOR ALL USING (family_id = get_my_family_id());

-- Assets
CREATE POLICY "Members can view assets"
  ON assets FOR SELECT USING (family_id = get_my_family_id());
CREATE POLICY "Members can manage assets"
  ON assets FOR ALL USING (family_id = get_my_family_id());

-- Family Tree
CREATE POLICY "Members can view family tree"
  ON family_tree_nodes FOR SELECT USING (family_id = get_my_family_id());
CREATE POLICY "Owner/Admin can manage family tree"
  ON family_tree_nodes FOR ALL USING (family_id = get_my_family_id() AND is_owner_or_admin());

-- Memories
CREATE POLICY "Members can view memories"
  ON memories FOR SELECT USING (family_id = get_my_family_id());
CREATE POLICY "Members can manage memories"
  ON memories FOR ALL USING (family_id = get_my_family_id());

-- Knowledge
CREATE POLICY "Members can view published articles"
  ON knowledge_articles FOR SELECT USING (family_id = get_my_family_id() AND published = TRUE);
CREATE POLICY "Members can manage articles"
  ON knowledge_articles FOR ALL USING (family_id = get_my_family_id());

-- Calendar
CREATE POLICY "Members can view calendar events"
  ON calendar_events FOR SELECT USING (family_id = get_my_family_id());
CREATE POLICY "Members can manage calendar events"
  ON calendar_events FOR ALL USING (family_id = get_my_family_id());

-- Trusted Contacts
CREATE POLICY "Members can view trusted contacts"
  ON trusted_contacts FOR SELECT USING (family_id = get_my_family_id());
CREATE POLICY "Members can manage trusted contacts"
  ON trusted_contacts FOR ALL USING (family_id = get_my_family_id());

-- Notifications
CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE USING (user_id = auth.uid());

-- Audit Logs (Owner only read)
CREATE POLICY "Owner can view audit logs"
  ON audit_logs FOR SELECT USING (family_id = get_my_family_id() AND is_owner());

-- Trash
CREATE POLICY "Members can view trash"
  ON trash_items FOR SELECT USING (family_id = get_my_family_id());
CREATE POLICY "Members can manage trash"
  ON trash_items FOR ALL USING (family_id = get_my_family_id());

-- System Features (Owner only)
CREATE POLICY "Owner can view system features"
  ON system_features FOR SELECT USING (is_owner());
CREATE POLICY "Owner can manage system features"
  ON system_features FOR ALL USING (is_owner());

-- Invitations (Admin+)
CREATE POLICY "Owner/Admin can view invitations"
  ON invitations FOR SELECT USING (family_id = get_my_family_id() AND is_owner_or_admin());
CREATE POLICY "Owner/Admin can manage invitations"
  ON invitations FOR ALL USING (family_id = get_my_family_id() AND is_owner_or_admin());

-- Sessions
CREATE POLICY "Users can view own sessions"
  ON user_sessions FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can manage own sessions"
  ON user_sessions FOR ALL USING (user_id = auth.uid());
