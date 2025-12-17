-- Create Enum for change type if not exists
DO $$ BEGIN
    CREATE TYPE public.log_type AS ENUM ('COMMUNITY_TIER_UPDATE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create the logs table without community_id column (stored in details)
CREATE TABLE IF NOT EXISTS public.logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    type public.log_type NOT NULL DEFAULT 'COMMUNITY_TIER_UPDATE',
    details JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.logs ENABLE ROW LEVEL SECURITY;

-- Policy for Admins: Can view all tier logs
CREATE POLICY "Admins can view all tier logs"
    ON public.logs
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE user_profiles.id = auth.uid()
            AND user_profiles.role = 'admin'
        )
    );

-- Function to log the tier change
CREATE OR REPLACE FUNCTION public.log_community_tier_change()
RETURNS TRIGGER AS $$
DECLARE
    changer_id UUID;
    changer_email TEXT;
BEGIN
    -- Only log if the membership_tier has changed
    IF OLD.membership_tier IS DISTINCT FROM NEW.membership_tier THEN
        -- Try to get the user ID from the session
        changer_id := auth.uid();
        
        -- Get email from user_profiles
        SELECT email INTO changer_email
        FROM public.user_profiles
        WHERE id = changer_id;

        INSERT INTO public.logs (
            type,
            details
        ) VALUES (
            'COMMUNITY_TIER_UPDATE',
            jsonb_build_object(
                'community_id', NEW.id,
                'community_name', NEW.name,
                'old_tier', OLD.membership_tier,
                'new_tier', NEW.membership_tier,
                'changed_by_user_id', changer_id,
                'changed_by_email', changer_email
            )
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to execute the function
DROP TRIGGER IF EXISTS on_community_tier_change ON public.communities;
CREATE TRIGGER on_community_tier_change
    AFTER UPDATE ON public.communities
    FOR EACH ROW
    EXECUTE FUNCTION public.log_community_tier_change();
