-- ============================================
-- NERALLA NEXUS — AUTH TRIGGER
-- Migration 004: Sync auth.users with public.users
-- ============================================

-- Create a trigger function to handle user creation
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER AS $$
DECLARE
  v_family_id UUID;
  v_role TEXT := 'member';
  v_is_owner BOOLEAN := FALSE;
  v_invitation_record RECORD;
BEGIN
  -- 1. Check if this is the first owner user (saran.neralla@gmail.com)
  IF NEW.email = 'saran.neralla@gmail.com' THEN
    v_role := 'owner';
    v_is_owner := TRUE;
    
    -- Check if family already exists
    SELECT id INTO v_family_id FROM public.families WHERE slug = 'neralla';
    
    -- If family doesn't exist, create it
    IF v_family_id IS NULL THEN
      INSERT INTO public.families (name, slug, settings)
      VALUES (
        'Neralla Family', 
        'neralla', 
        '{"timezone": "Asia/Kolkata", "currency": "INR", "onboarding_completed": false, "onboarding_step": 1}'::jsonb
      )
      RETURNING id INTO v_family_id;
    END IF;
  ELSE
    -- Check if there is an invitation for this email
    SELECT * INTO v_invitation_record 
    FROM public.invitations 
    WHERE email = NEW.email AND accepted_at IS NULL 
    ORDER BY created_at DESC 
    LIMIT 1;
    
    IF v_invitation_record.id IS NOT NULL THEN
      v_family_id := v_invitation_record.family_id;
      v_role := v_invitation_record.role;
      
      -- Mark invitation as accepted
      UPDATE public.invitations SET accepted_at = NOW() WHERE id = v_invitation_record.id;
    ELSE
      -- Fallback: Assign to the primary family as a member/guest
      SELECT id INTO v_family_id FROM public.families WHERE slug = 'neralla';
      IF v_family_id IS NULL THEN
        INSERT INTO public.families (name, slug) 
        VALUES ('Neralla Family', 'neralla') 
        RETURNING id INTO v_family_id;
      END IF;
    END IF;
  END IF;

  -- 2. Insert into public.users
  INSERT INTO public.users (id, family_id, email, full_name, role, is_owner, status)
  VALUES (
    NEW.id,
    v_family_id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    v_role,
    v_is_owner,
    'active'
  );

  -- 3. Insert into public.family_members
  INSERT INTO public.family_members (user_id, family_id, full_name, email)
  VALUES (
    NEW.id,
    v_family_id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.email
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();
