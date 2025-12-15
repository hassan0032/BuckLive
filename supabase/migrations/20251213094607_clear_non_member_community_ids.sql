-- Clear community_id for users who are not 'member'
UPDATE user_profiles
SET community_id = NULL
WHERE role != 'member';
