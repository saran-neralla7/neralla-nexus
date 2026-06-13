-- ============================================
-- NERALLA NEXUS — DATABASE SCHEMA
-- Migration 001: Core Tables
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- FAMILIES (Multi-tenant root)
-- ============================================
CREATE TABLE IF NOT EXISTS families (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL UNIQUE,
  logo_url    TEXT,
  banner_url  TEXT,
  settings    JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- USERS
-- ============================================
CREATE TABLE IF NOT EXISTS users (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  family_id       UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  email           TEXT NOT NULL UNIQUE,
  full_name       TEXT NOT NULL,
  avatar_url      TEXT,
  role            TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member', 'guest')),
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'invited', 'suspended')),
  is_owner        BOOLEAN NOT NULL DEFAULT FALSE,
  pin_hash        TEXT,
  recovery_codes  TEXT[], -- encrypted recovery codes
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen       TIMESTAMPTZ,
  CONSTRAINT one_owner_per_family UNIQUE NULLS NOT DISTINCT (family_id, is_owner)
);

-- ============================================
-- FAMILY MEMBERS (Extended profiles, can exist without a user account)
-- ============================================
CREATE TABLE IF NOT EXISTS family_members (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID REFERENCES users(id) ON DELETE SET NULL,
  family_id     UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  full_name     TEXT NOT NULL,
  relationship  TEXT,
  date_of_birth DATE,
  blood_group   TEXT,
  phone         TEXT,
  email         TEXT,
  avatar_url    TEXT,
  cover_url     TEXT,
  address       TEXT,
  bio           TEXT,
  metadata      JSONB DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- INVITATIONS
-- ============================================
CREATE TABLE IF NOT EXISTS invitations (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  family_id   UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  role        TEXT NOT NULL DEFAULT 'member',
  token       TEXT NOT NULL UNIQUE,
  invited_by  UUID REFERENCES users(id),
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  accepted_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- SESSIONS (Trusted devices)
-- ============================================
CREATE TABLE IF NOT EXISTS user_sessions (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_name  TEXT,
  device_info  JSONB DEFAULT '{}',
  ip_address   TEXT,
  is_trusted   BOOLEAN DEFAULT FALSE,
  last_seen    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at   TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- AUDIT LOGS
-- ============================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  family_id     UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  user_id       UUID REFERENCES users(id) ON DELETE SET NULL,
  action        TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id   TEXT,
  metadata      JSONB DEFAULT '{}',
  ip_address    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- NOTIFICATIONS
-- ============================================
CREATE TABLE IF NOT EXISTS notifications (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  family_id   UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type        TEXT NOT NULL,
  title       TEXT NOT NULL,
  body        TEXT NOT NULL,
  data        JSONB DEFAULT '{}',
  read_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- DOCUMENTS VAULT
-- ============================================
CREATE TABLE IF NOT EXISTS documents (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  family_id    UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  member_id    UUID REFERENCES family_members(id) ON DELETE SET NULL,
  category     TEXT NOT NULL DEFAULT 'other',
  name         TEXT NOT NULL,
  description  TEXT,
  file_url     TEXT NOT NULL,
  file_size    BIGINT,
  mime_type    TEXT,
  tags         TEXT[] DEFAULT '{}',
  expiry_date  DATE,
  is_sensitive BOOLEAN DEFAULT FALSE,
  deleted_at   TIMESTAMPTZ,
  created_by   UUID REFERENCES users(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- PASSWORD VAULT (Encrypted)
-- ============================================
CREATE TABLE IF NOT EXISTS passwords (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  family_id     UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  member_id     UUID REFERENCES family_members(id) ON DELETE SET NULL,
  category      TEXT NOT NULL DEFAULT 'other',
  title         TEXT NOT NULL,
  username_enc  TEXT, -- AES-256-GCM encrypted
  password_enc  TEXT NOT NULL, -- AES-256-GCM encrypted
  url           TEXT,
  notes_enc     TEXT, -- AES-256-GCM encrypted
  shared_with   UUID[] DEFAULT '{}',
  deleted_at    TIMESTAMPTZ,
  created_by    UUID REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- MEDICAL RECORDS
-- ============================================
CREATE TABLE IF NOT EXISTS medical_records (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  family_id   UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  member_id   UUID NOT NULL REFERENCES family_members(id) ON DELETE CASCADE,
  type        TEXT NOT NULL DEFAULT 'other',
  title       TEXT NOT NULL,
  doctor      TEXT,
  hospital    TEXT,
  date        DATE,
  file_url    TEXT,
  notes       TEXT,
  metadata    JSONB DEFAULT '{}',
  created_by  UUID REFERENCES users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- POLICIES & INSURANCE
-- ============================================
CREATE TABLE IF NOT EXISTS policies (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  family_id       UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  member_id       UUID REFERENCES family_members(id) ON DELETE SET NULL,
  type            TEXT NOT NULL DEFAULT 'other',
  name            TEXT NOT NULL,
  provider        TEXT NOT NULL,
  policy_number_enc TEXT, -- encrypted
  premium_amount  DECIMAL(12, 2),
  premium_date    DATE,
  expiry_date     DATE,
  coverage        TEXT,
  document_url    TEXT,
  notes           TEXT,
  created_by      UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- ASSETS & WEALTH
-- ============================================
CREATE TABLE IF NOT EXISTS assets (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  family_id     UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  type          TEXT NOT NULL DEFAULT 'other',
  name          TEXT NOT NULL,
  description   TEXT,
  current_value DECIMAL(15, 2),
  purchase_date DATE,
  photos        TEXT[] DEFAULT '{}',
  documents     TEXT[] DEFAULT '{}',
  metadata      JSONB DEFAULT '{}',
  created_by    UUID REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- FAMILY TREE
-- ============================================
CREATE TABLE IF NOT EXISTS family_tree_nodes (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  family_id             UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  member_id             UUID NOT NULL REFERENCES family_members(id) ON DELETE CASCADE,
  parent_id             UUID REFERENCES family_tree_nodes(id) ON DELETE SET NULL,
  relationship_to_parent TEXT,
  position_x            DECIMAL DEFAULT 0,
  position_y            DECIMAL DEFAULT 0,
  metadata              JSONB DEFAULT '{}',
  UNIQUE(family_id, member_id)
);

-- ============================================
-- MEMORIES
-- ============================================
CREATE TABLE IF NOT EXISTS memories (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  family_id   UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  description TEXT,
  category    TEXT NOT NULL DEFAULT 'photo',
  date        DATE,
  media_urls  TEXT[] DEFAULT '{}',
  tags        TEXT[] DEFAULT '{}',
  members     UUID[] DEFAULT '{}',
  created_by  UUID REFERENCES users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- KNOWLEDGE CENTER
-- ============================================
CREATE TABLE IF NOT EXISTS knowledge_articles (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  family_id   UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  content     TEXT NOT NULL DEFAULT '',
  category    TEXT,
  tags        TEXT[] DEFAULT '{}',
  attachments TEXT[] DEFAULT '{}',
  created_by  UUID REFERENCES users(id),
  published   BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- CALENDAR EVENTS
-- ============================================
CREATE TABLE IF NOT EXISTS calendar_events (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  family_id   UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  description TEXT,
  type        TEXT NOT NULL DEFAULT 'other',
  start_at    TIMESTAMPTZ NOT NULL,
  end_at      TIMESTAMPTZ,
  all_day     BOOLEAN DEFAULT FALSE,
  members     UUID[] DEFAULT '{}',
  recurrence  JSONB,
  reminder_at TIMESTAMPTZ,
  metadata    JSONB DEFAULT '{}',
  created_by  UUID REFERENCES users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- TRUSTED CONTACTS
-- ============================================
CREATE TABLE IF NOT EXISTS trusted_contacts (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  family_id    UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  category     TEXT NOT NULL DEFAULT 'other',
  phone        TEXT,
  email        TEXT,
  company      TEXT,
  notes        TEXT,
  is_emergency BOOLEAN DEFAULT FALSE,
  created_by   UUID REFERENCES users(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- TRASH (Soft Delete Registry)
-- ============================================
CREATE TABLE IF NOT EXISTS trash_items (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  family_id       UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  resource_type   TEXT NOT NULL,
  resource_id     UUID NOT NULL,
  resource_data   JSONB DEFAULT '{}',
  deleted_by      UUID REFERENCES users(id),
  deleted_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  restore_by      TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days')
);

-- ============================================
-- DIGITAL LEGACY (Structure for future)
-- ============================================
CREATE TABLE IF NOT EXISTS digital_legacy (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  family_id       UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  trusted_contact TEXT,
  instructions    TEXT,
  access_type     TEXT DEFAULT 'emergency',
  is_active       BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- SYSTEM PROGRESS (Dev tracking)
-- ============================================
CREATE TABLE IF NOT EXISTS system_features (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name         TEXT NOT NULL,
  description  TEXT,
  status       TEXT NOT NULL DEFAULT 'not_started' CHECK (status IN ('completed', 'in_progress', 'not_started')),
  phase        INTEGER NOT NULL DEFAULT 1,
  module       TEXT NOT NULL,
  completed_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_users_family_id ON users(family_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_family_members_family_id ON family_members(family_id);
CREATE INDEX IF NOT EXISTS idx_family_members_user_id ON family_members(user_id);
CREATE INDEX IF NOT EXISTS idx_documents_family_id ON documents(family_id);
CREATE INDEX IF NOT EXISTS idx_documents_member_id ON documents(member_id);
CREATE INDEX IF NOT EXISTS idx_documents_deleted_at ON documents(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_passwords_family_id ON passwords(family_id);
CREATE INDEX IF NOT EXISTS idx_passwords_deleted_at ON passwords(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_policies_family_id ON policies(family_id);
CREATE INDEX IF NOT EXISTS idx_policies_expiry_date ON policies(expiry_date);
CREATE INDEX IF NOT EXISTS idx_assets_family_id ON assets(family_id);
CREATE INDEX IF NOT EXISTS idx_medical_records_family_id ON medical_records(family_id);
CREATE INDEX IF NOT EXISTS idx_memories_family_id ON memories(family_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_family_id ON calendar_events(family_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_start_at ON calendar_events(start_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_family_id ON audit_logs(family_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read_at ON notifications(read_at) WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_trash_items_family_id ON trash_items(family_id);
CREATE INDEX IF NOT EXISTS idx_trash_items_restore_by ON trash_items(restore_by);

-- ============================================
-- TRIGGERS
-- ============================================

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_families_updated_at BEFORE UPDATE ON families
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_family_members_updated_at BEFORE UPDATE ON family_members
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_documents_updated_at BEFORE UPDATE ON documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_passwords_updated_at BEFORE UPDATE ON passwords
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_policies_updated_at BEFORE UPDATE ON policies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_assets_updated_at BEFORE UPDATE ON assets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_medical_records_updated_at BEFORE UPDATE ON medical_records
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_memories_updated_at BEFORE UPDATE ON memories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_knowledge_articles_updated_at BEFORE UPDATE ON knowledge_articles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_trusted_contacts_updated_at BEFORE UPDATE ON trusted_contacts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_system_features_updated_at BEFORE UPDATE ON system_features
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
