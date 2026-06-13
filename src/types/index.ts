// ============================================
// NERALLA NEXUS — Core Type Definitions
// ============================================

export type UserRole = 'owner' | 'admin' | 'member' | 'guest';
export type UserStatus = 'active' | 'inactive' | 'invited' | 'suspended';

export interface Family {
  id: string;
  name: string;
  slug: string;
  logo_url?: string;
  banner_url?: string;
  settings: FamilySettings;
  created_at: string;
  updated_at: string;
}

export interface FamilySettings {
  timezone?: string;
  currency?: string;
  notification_email?: boolean;
  notification_push?: boolean;
  onboarding_completed?: boolean;
  onboarding_step?: number;
}

export interface User {
  id: string;
  family_id: string;
  email: string;
  full_name: string;
  avatar_url?: string;
  role: UserRole;
  status: UserStatus;
  is_owner: boolean;
  created_at: string;
  last_seen?: string;
}

export interface FamilyMember {
  id: string;
  user_id?: string;
  family_id: string;
  full_name: string;
  relationship?: string;
  date_of_birth?: string;
  blood_group?: string;
  phone?: string;
  email?: string;
  avatar_url?: string;
  cover_url?: string;
  address?: string;
  bio?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}

export interface Document {
  id: string;
  family_id: string;
  member_id?: string;
  category: DocumentCategory;
  name: string;
  description?: string;
  file_url: string;
  file_size?: number;
  mime_type?: string;
  tags: string[];
  expiry_date?: string;
  is_sensitive: boolean;
  deleted_at?: string;
  created_by: string;
  created_at: string;
}

export type DocumentCategory =
  | 'aadhaar'
  | 'pan'
  | 'passport'
  | 'driving_license'
  | 'property'
  | 'insurance'
  | 'certificate'
  | 'tax'
  | 'medical'
  | 'other';

export interface PasswordEntry {
  id: string;
  family_id: string;
  member_id?: string;
  category: PasswordCategory;
  title: string;
  username?: string;
  url?: string;
  notes?: string;
  shared_with: string[];
  deleted_at?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  // Decrypted fields (only when revealed)
  password?: string;
}

export type PasswordCategory =
  | 'ott'
  | 'email'
  | 'social_media'
  | 'banking'
  | 'utilities'
  | 'wifi'
  | 'other';

export interface Policy {
  id: string;
  family_id: string;
  member_id?: string;
  type: PolicyType;
  name: string;
  provider: string;
  policy_number?: string;
  premium_amount?: number;
  premium_date?: string;
  expiry_date?: string;
  coverage?: string;
  document_url?: string;
  created_at: string;
}

export type PolicyType = 'lic' | 'health' | 'property' | 'vehicle' | 'term' | 'other';

export interface Asset {
  id: string;
  family_id: string;
  type: AssetType;
  name: string;
  description?: string;
  current_value?: number;
  purchase_date?: string;
  photos: string[];
  documents: string[];
  metadata?: Record<string, unknown>;
  created_at: string;
}

export type AssetType = 'property' | 'vehicle' | 'investment' | 'gold' | 'valuable' | 'other';

export interface MedicalRecord {
  id: string;
  family_id: string;
  member_id: string;
  type: MedicalType;
  title: string;
  doctor?: string;
  hospital?: string;
  date?: string;
  file_url?: string;
  notes?: string;
  created_at: string;
}

export type MedicalType = 'report' | 'prescription' | 'scan' | 'vaccination' | 'appointment' | 'other';

export interface Memory {
  id: string;
  family_id: string;
  title: string;
  description?: string;
  category: MemoryCategory;
  date?: string;
  media_urls: string[];
  tags: string[];
  members: string[];
  created_by: string;
  created_at: string;
}

export type MemoryCategory = 'photo' | 'video' | 'trip' | 'event' | 'achievement' | 'other';

export interface CalendarEvent {
  id: string;
  family_id: string;
  title: string;
  description?: string;
  type: EventType;
  start_at: string;
  end_at?: string;
  members: string[];
  all_day?: boolean;
  recurrence?: RecurrenceRule;
  reminder_at?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}

export type EventType =
  | 'birthday'
  | 'anniversary'
  | 'medical'
  | 'policy_renewal'
  | 'trip'
  | 'reminder'
  | 'other';

export interface RecurrenceRule {
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  interval?: number;
  end_date?: string;
}

export interface TrustedContact {
  id: string;
  family_id: string;
  name: string;
  category: ContactCategory;
  phone?: string;
  email?: string;
  company?: string;
  notes?: string;
  is_emergency: boolean;
  created_at: string;
}

export type ContactCategory =
  | 'bank_manager'
  | 'insurance_agent'
  | 'doctor'
  | 'lawyer'
  | 'accountant'
  | 'mechanic'
  | 'electrician'
  | 'plumber'
  | 'other';

export interface KnowledgeArticle {
  id: string;
  family_id: string;
  title: string;
  content: string;
  category?: string;
  tags: string[];
  attachments: string[];
  created_by: string;
  published: boolean;
  created_at: string;
  updated_at: string;
}

export interface Notification {
  id: string;
  family_id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  read_at?: string;
  created_at: string;
}

export type NotificationType =
  | 'policy_expiry'
  | 'document_expiry'
  | 'birthday'
  | 'medical_reminder'
  | 'new_upload'
  | 'system'
  | 'other';

export interface AuditLog {
  id: string;
  family_id: string;
  user_id: string;
  action: string;
  resource_type: string;
  resource_id?: string;
  metadata?: Record<string, unknown>;
  ip_address?: string;
  created_at: string;
  user?: Pick<User, 'full_name' | 'email'>;
}

// UI Helper Types
export interface NavItem {
  label: string;
  href: string;
  icon: string;
  badge?: number;
  ownerOnly?: boolean;
  adminOnly?: boolean;
}

export interface DashboardStat {
  label: string;
  value: string | number;
  icon: string;
  trend?: 'up' | 'down' | 'neutral';
  color?: string;
}

export interface SearchResult {
  id: string;
  type: string;
  title: string;
  subtitle?: string;
  icon: string;
  href: string;
}

export type SystemFeatureStatus = 'completed' | 'in_progress' | 'not_started';

export interface SystemFeature {
  id: string;
  name: string;
  description?: string;
  status: SystemFeatureStatus;
  phase: number;
  module: string;
  completedAt?: string;
}
