-- Key-based passwordless identity, threaded comments, and feed indexes.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS auth_public_key jsonb;

CREATE TABLE IF NOT EXISTS public.orbis_auth_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  challenge text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS orbis_auth_challenges_user_idx
  ON public.orbis_auth_challenges(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS orbis_auth_challenges_expiry_idx
  ON public.orbis_auth_challenges(expires_at) WHERE used_at IS NULL;
ALTER TABLE public.orbis_auth_challenges ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.orbis_auth_challenges FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.orbis_auth_challenges TO service_role;

ALTER TABLE public.post_comments
  ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.post_comments(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS post_comments_post_feed_idx
  ON public.post_comments(post_id, created_at DESC, id DESC)
  WHERE status = 'published' AND parent_id IS NULL;
CREATE INDEX IF NOT EXISTS post_comments_parent_idx
  ON public.post_comments(parent_id, created_at ASC, id ASC)
  WHERE status = 'published';

CREATE INDEX IF NOT EXISTS posts_public_feed_cursor_idx
  ON public.posts(created_at DESC, id DESC)
  WHERE status = 'published' AND reply_to IS NULL;
CREATE INDEX IF NOT EXISTS posts_popular_feed_cursor_idx
  ON public.posts(engagement_score DESC, created_at DESC, id DESC)
  WHERE status = 'published' AND reply_to IS NULL;
CREATE INDEX IF NOT EXISTS follows_following_lookup_idx
  ON public.follows(following_id, follower_id);
CREATE INDEX IF NOT EXISTS notifications_recipient_unread_idx
  ON public.notifications(recipient_id, created_at DESC)
  WHERE read_at IS NULL;
