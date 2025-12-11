-- Create organizations table
CREATE TABLE IF NOT EXISTS public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  billing_date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on organizations
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- Create organization_managers junction table
CREATE TABLE IF NOT EXISTS public.organization_managers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organization_id, user_id)
);

-- Enable RLS on organization_managers
ALTER TABLE public.organization_managers ENABLE ROW LEVEL SECURITY;

-- RLS Policies for organizations

-- Admin has full access
DROP POLICY IF EXISTS "Admins can do everything on organizations" ON public.organizations;
CREATE POLICY "Admins can do everything on organizations"
  ON public.organizations
  FOR ALL
  USING (
    public.is_admin(auth.uid())
  );

-- Organization Managers can view their own organization
DROP POLICY IF EXISTS "Org Managers can view their own organization" ON public.organizations;
CREATE POLICY "Org Managers can view their own organization"
  ON public.organizations
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_managers
      WHERE organization_id = organizations.id
      AND user_id = auth.uid()
    )
  );

-- RLS Policies for organization_managers

-- Admin has full access
DROP POLICY IF EXISTS "Admins can do everything on organization_managers" ON public.organization_managers;
CREATE POLICY "Admins can do everything on organization_managers"
  ON public.organization_managers
  FOR ALL
  USING (
    public.is_admin(auth.uid())
  );

-- Organization Managers can view their own assignment
DROP POLICY IF EXISTS "Org Managers can view their own assignment" ON public.organization_managers;
CREATE POLICY "Org Managers can view their own assignment"
  ON public.organization_managers
  FOR SELECT
  USING (
    user_id = auth.uid()
  );

