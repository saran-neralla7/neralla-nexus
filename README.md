# 🏠 Neralla Nexus — Family Operating System

> The Digital Home of Neralla Family

## Overview

Neralla Nexus is a production-grade, private Family Operating System that centralizes everything a family needs in one secure, beautiful platform.

**Inspired by:** Apple Photos + 1Password + Notion + Tesla + A Private Family Headquarters

## 🎯 Core Modules

| Module | Status | Phase |
|--------|--------|-------|
| Authentication & RBAC | ✅ Active | 1 |
| Dashboard Command Center | ✅ Active | 1 |
| Family Profiles | 🚧 Phase 2 | 2 |
| Family Tree | 🚧 Phase 2 | 2 |
| Documents Vault | 🚧 Phase 2 | 2 |
| Password Vault | 🚧 Phase 3 | 3 |
| Medical Center | 🚧 Phase 4 | 4 |
| Policies & Insurance | 🚧 Phase 4 | 4 |
| Assets & Wealth | 🚧 Phase 5 | 5 |
| Family Memories | 🚧 Phase 5 | 5 |
| Knowledge Center | 🚧 Phase 5 | 5 |
| Family Calendar | 🚧 Phase 6 | 6 |
| Emergency Hub | 🚧 Phase 6 | 6 |
| Ask Nexus AI | 🚧 Phase 7 | 7 |

## 🛠️ Tech Stack

### Current
- **Frontend:** Next.js 15 + TypeScript (strict) + TailwindCSS + Shadcn/UI
- **Backend:** Next.js Route Handlers + Server Actions
- **Database:** Supabase PostgreSQL with RLS
- **Storage:** Supabase Storage
- **Auth:** Supabase Auth
- **Email:** Resend
- **Hosting:** Vercel

### Migration-Ready (Future)
- PostgreSQL → raw or Prisma
- MinIO → Supabase Storage swap
- Redis cache layer
- Docker + Nginx on Ubuntu VPS

## 🚀 Setup

### 1. Clone & Install
```bash
git clone https://github.com/neralla/neralla-nexus.git
cd neralla-nexus
npm install
```

### 2. Configure Environment
```bash
cp .env.local.example .env.local
# Edit .env.local with your Supabase credentials
```

### 3. Database Setup
Run the SQL migrations in order in Supabase SQL Editor:
```
supabase/migrations/001_initial_schema.sql
supabase/migrations/002_rls_policies.sql
supabase/migrations/003_seed_data.sql
```

### 4. Create Owner Account
1. Go to Supabase Dashboard → Authentication → Users
2. Create user: `saran.neralla@gmail.com`
3. Run in SQL Editor:
```sql
-- Get the auth user ID first
SELECT id FROM auth.users WHERE email = 'saran.neralla@gmail.com';

-- Insert user record (replace UUID with actual)
INSERT INTO users (id, family_id, email, full_name, role, is_owner)
SELECT 
  auth.users.id,
  families.id,
  'saran.neralla@gmail.com',
  'Saran Neralla',
  'owner',
  true
FROM auth.users, families
WHERE auth.users.email = 'saran.neralla@gmail.com'
AND families.slug = 'neralla';
```

### 5. Run Development Server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## 🏗️ Architecture

```
src/
├── app/                    # Next.js App Router
│   ├── (auth)/             # Public auth routes
│   └── (dashboard)/        # Protected app routes
├── components/nexus/       # Custom Nexus components
├── hooks/                  # React hooks
├── lib/
│   ├── supabase/           # DB client (swap for migration)
│   ├── encryption.ts       # AES-256-GCM
│   └── utils.ts
├── types/                  # TypeScript types
supabase/migrations/        # SQL schema files
```

## 🔐 Security

- AES-256-GCM encryption for sensitive fields
- Row-Level Security (RLS) on all tables
- Family-level data isolation (multi-tenant)
- Audit logging for all sensitive operations
- No public registration — invite-only

## 📱 Design System

Based on the approved **Stitch** design:
- **Theme:** Deep Space Dark (primary)
- **Primary:** Teal `#4fdbc8`
- **Secondary:** Blue `#adc6ff`
- **Accent:** Warm `#ffb59e`
- **Glassmorphism:** `backdrop-filter: blur(40px)`
- **Fonts:** Geist (headlines) + Inter (body) + JetBrains Mono (labels)

---

*Built with ❤️ for the Neralla Family*
