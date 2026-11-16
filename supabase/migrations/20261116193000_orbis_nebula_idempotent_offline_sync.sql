-- ORBIS Nebula Sync: stable client operation IDs make retrying safe.
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS client_operation_id uuid;
CREATE UNIQUE INDEX IF NOT EXISTS posts_author_client_operation_uidx
  ON public.posts(author_id,client_operation_id)
  WHERE client_operation_id IS NOT NULL;

ALTER TABLE public.post_comments
  ADD COLUMN IF NOT EXISTS client_operation_id uuid;
CREATE UNIQUE INDEX IF NOT EXISTS post_comments_author_client_operation_uidx
  ON public.post_comments(author_id,client_operation_id)
  WHERE client_operation_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.orbis_sync_operations (
  operation_id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  operation_type text NOT NULL CHECK (operation_type IN
    ('post.create','like.set','comment.create','follow.set','profile.update')),
  request_hash text NOT NULL,
  status text NOT NULL DEFAULT 'processing' CHECK (status IN ('processing','done','retry','failed')),
  result jsonb,
  last_error text,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
CREATE INDEX IF NOT EXISTS orbis_sync_operations_user_created_idx
  ON public.orbis_sync_operations(user_id,created_at DESC);
CREATE INDEX IF NOT EXISTS orbis_sync_operations_retry_idx
  ON public.orbis_sync_operations(updated_at)
  WHERE status IN ('processing','retry');

ALTER TABLE public.orbis_sync_operations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.orbis_sync_operations FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.orbis_sync_operations TO service_role;
