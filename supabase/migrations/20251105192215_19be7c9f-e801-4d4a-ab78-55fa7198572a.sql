-- Fix Critical Security Issues
-- 1. Create proper role-based access control system

-- Create enum for application roles
CREATE TYPE public.app_role AS ENUM ('super_admin', 'admin', 'supervisor', 'analista');

-- Create user_roles table (separate from profiles to prevent privilege escalation)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  assigned_by UUID REFERENCES auth.users(id),
  UNIQUE(user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles (bypasses RLS to prevent recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  );
$$;

-- Create function to check if user has any admin role
CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('super_admin', 'admin')
  );
$$;

-- RLS Policies for user_roles
-- Only super_admins can modify roles
CREATE POLICY "Only super_admins can insert roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Only super_admins can update roles"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Only super_admins can delete roles"
ON public.user_roles
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'));

-- Authenticated users can view roles
CREATE POLICY "Authenticated users can view roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (true);

-- 2. Fix user_profiles RLS to prevent privilege escalation
-- Drop the vulnerable policy that allows users to update their own profiles
DROP POLICY IF EXISTS "Users can update their own profile" ON public.user_profiles;

-- Make perfil and role read-only for regular users
CREATE POLICY "Users can update their own non-role fields"
ON public.user_profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id AND
  perfil = (SELECT perfil FROM public.user_profiles WHERE user_id = auth.uid()) AND
  role = (SELECT role FROM public.user_profiles WHERE user_id = auth.uid())
);

-- Only super_admins can modify role fields
CREATE POLICY "Super admins can update any profile"
ON public.user_profiles
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- 3. Require authentication to view user_profiles (fix public exposure)
DROP POLICY IF EXISTS "Users can view user_profiles" ON public.user_profiles;

CREATE POLICY "Authenticated users can view profiles"
ON public.user_profiles
FOR SELECT
TO authenticated
USING (true);

-- 4. Fix profile_permissions RLS
DROP POLICY IF EXISTS "Admins can update profile permissions" ON public.profile_permissions;

CREATE POLICY "Only super_admins can modify permissions"
ON public.profile_permissions
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- Keep read access for all authenticated users
DROP POLICY IF EXISTS "Anyone can view profile permissions" ON public.profile_permissions;

CREATE POLICY "Authenticated users can view permissions"
ON public.profile_permissions
FOR SELECT
TO authenticated
USING (true);

-- 5. Create closed schema for sensitive tables (per user requirement)
CREATE SCHEMA IF NOT EXISTS internal;

-- Move sensitive tables to internal schema with RLS enabled
-- Note: This will be done in subsequent migrations as it requires code changes

-- 6. Migrate existing admin user to new role system
-- Set davi.guedes@redesaoroque.com.br as super_admin
INSERT INTO public.user_roles (user_id, role)
SELECT user_id, 'super_admin'::app_role
FROM public.user_profiles
WHERE email = 'davi.guedes@redesaoroque.com.br'
ON CONFLICT (user_id, role) DO NOTHING;

-- 7. Create audit log for role changes
CREATE TABLE IF NOT EXISTS public.role_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  role app_role NOT NULL,
  action TEXT NOT NULL,
  performed_by UUID NOT NULL REFERENCES auth.users(id),
  performed_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  reason TEXT
);

ALTER TABLE public.role_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view role audit log"
ON public.role_audit_log
FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

-- Create trigger to log role changes
CREATE OR REPLACE FUNCTION public.log_role_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.role_audit_log (user_id, role, action, performed_by)
    VALUES (NEW.user_id, NEW.role, 'granted', auth.uid());
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.role_audit_log (user_id, role, action, performed_by)
    VALUES (OLD.user_id, OLD.role, 'revoked', auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER role_change_audit
AFTER INSERT OR DELETE ON public.user_roles
FOR EACH ROW
EXECUTE FUNCTION public.log_role_change();