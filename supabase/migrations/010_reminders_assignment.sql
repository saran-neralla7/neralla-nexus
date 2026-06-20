-- ============================================
-- NERALLA NEXUS — REMINDERS ASSIGNMENT
-- Migration 010: Reminders Assignment
-- ============================================

-- 1. Add assigned_to column to reminders table
ALTER TABLE reminders ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES users(id) ON DELETE SET NULL;

-- 2. Update existing reminders to default assigned_to to their creator (created_by)
UPDATE reminders SET assigned_to = created_by WHERE assigned_to IS NULL;
