-- ============================================
-- NERALLA NEXUS — SEED DATA
-- Migration 003: Initial Family Setup
-- ============================================

-- NOTE: The owner user account is created through Supabase Auth.
-- After creating the auth user, run this to set up the family data.
-- Replace 'YOUR_SUPABASE_AUTH_USER_ID' with the actual UUID from auth.users

-- Step 1: Create Neralla Family
INSERT INTO families (id, name, slug, settings)
VALUES (
  uuid_generate_v4(),
  'Neralla Family',
  'neralla',
  '{
    "timezone": "Asia/Kolkata",
    "currency": "INR",
    "notification_email": true,
    "notification_push": false,
    "onboarding_completed": false,
    "onboarding_step": 1
  }'::jsonb
)
ON CONFLICT (slug) DO NOTHING;

-- Step 2: Insert system features for progress tracking
INSERT INTO system_features (name, description, status, phase, module) VALUES
  -- Phase 1
  ('Authentication', 'Email/password login, session management, PIN verification', 'completed', 1, 'auth'),
  ('User Management', 'RBAC roles: Owner, Admin, Member, Guest', 'completed', 1, 'auth'),
  ('Family Management', 'Family profile, settings, multi-tenant isolation', 'completed', 1, 'family'),
  ('Invite System', 'Owner/Admin can invite members via email', 'in_progress', 1, 'auth'),
  ('Onboarding Wizard', '7-step guided setup for new families', 'completed', 1, 'onboarding'),
  ('Core Layout', 'Glassmorphism sidebar, navbar, mobile dock', 'completed', 1, 'layout'),
  ('Dashboard', 'Command center with stats, activity, renewals', 'completed', 1, 'dashboard'),
  ('Notification Foundation', 'In-app notification system', 'in_progress', 1, 'notifications'),
  ('System Progress Center', '/system-progress owner-only tracking page', 'completed', 1, 'system'),

  -- Phase 2
  ('Family Profiles', 'Profile with tabs: overview, docs, passwords, medical, policies, assets, memories', 'not_started', 2, 'family'),
  ('Family Tree', 'Interactive zoomable family tree with SVG', 'not_started', 2, 'family'),
  ('Documents Vault', 'Upload, preview, search, expiry tracking', 'not_started', 2, 'documents'),

  -- Phase 3
  ('Password Vault', 'AES-256 encrypted with PIN reveal', 'not_started', 3, 'passwords'),
  ('Global Search', 'Cmd+K universal search across all modules', 'not_started', 3, 'search'),
  ('Audit Logs', 'Owner-only activity tracking', 'not_started', 3, 'audit'),

  -- Phase 4
  ('Medical Center', 'Records, prescriptions, health timeline', 'not_started', 4, 'medical'),
  ('Policies Module', 'LIC, insurance, renewals tracking', 'not_started', 4, 'policies'),
  ('Trusted Contacts', 'Bank managers, doctors, lawyers etc.', 'not_started', 4, 'contacts'),

  -- Phase 5
  ('Assets Module', 'Properties, vehicles, investments, gold', 'not_started', 5, 'assets'),
  ('Memories', 'Photos, videos, timeline/gallery view', 'not_started', 5, 'memories'),
  ('Knowledge Center', 'Private family wiki with articles/media', 'not_started', 5, 'knowledge'),

  -- Phase 6
  ('Family Calendar', 'Birthdays, anniversaries, appointments, renewals', 'not_started', 6, 'calendar'),
  ('Emergency Hub', 'Blood groups, emergency contacts, documents', 'not_started', 6, 'emergency'),

  -- Phase 7
  ('Ask Nexus', 'AI-ready search foundation (V1: search)', 'not_started', 7, 'ai'),
  ('Backup Management', 'Daily/weekly/monthly backup settings UI', 'not_started', 7, 'backup'),
  ('Digital Legacy', 'DB structure + minimal UI for future', 'not_started', 7, 'legacy'),
  ('Push Notifications', 'Firebase Cloud Messaging integration', 'not_started', 7, 'notifications'),
  ('Email Notifications', 'Resend email for policy/document reminders', 'not_started', 7, 'notifications'),
  ('Trash System', '30-day soft delete with restore', 'not_started', 7, 'system')
ON CONFLICT DO NOTHING;
