UPDATE user_profiles up
SET billing_date = cm.created_at
FROM communities c
JOIN community_managers cm
  ON c.primary_manager = cm.user_id
WHERE up.id = cm.user_id
  AND up.billing_date IS NULL;
