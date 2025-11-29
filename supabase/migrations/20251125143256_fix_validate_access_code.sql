DROP FUNCTION IF EXISTS validate_access_code(text);

CREATE OR REPLACE FUNCTION validate_access_code(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  community_id uuid;
  admin_code text;
  result jsonb;
BEGIN
  -- Check master admin code
  SELECT value INTO admin_code
  FROM settings
  WHERE key = 'master_admin_code';

  IF p_code = admin_code THEN
    result := jsonb_build_object(
      'is_admin', true,
      'community_id', NULL
    );
    RETURN result;
  END IF;

  -- Check community code
  SELECT id INTO community_id
  FROM communities
  WHERE access_code = p_code
    AND is_active = true;

  IF community_id IS NOT NULL THEN
    result := jsonb_build_object(
      'is_admin', false,
      'community_id', community_id
    );
    RETURN result;
  END IF;

  -- Invalid code
  RETURN NULL;
END
$$;

-- Grant execute to necessary roles
GRANT EXECUTE ON FUNCTION validate_access_code(text) TO anon;
GRANT EXECUTE ON FUNCTION validate_access_code(text) TO authenticated;
