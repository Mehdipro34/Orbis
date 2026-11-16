-- Following feed uses a relational join in PostgreSQL instead of shipping thousands
-- of followed-user IDs to the Edge Function on every page.
CREATE OR REPLACE FUNCTION public.orbis_following_feed(
  p_user_id uuid,
  p_limit integer DEFAULT 21,
  p_cursor_created_at timestamptz DEFAULT NULL,
  p_cursor_id uuid DEFAULT NULL
)
RETURNS SETOF public.posts
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
  SELECT p.*
  FROM public.posts AS p
  INNER JOIN public.follows AS f
    ON f.following_id = p.author_id
  WHERE f.follower_id = p_user_id
    AND p.status = 'published'
    AND p.reply_to IS NULL
    AND (
      p_cursor_created_at IS NULL
      OR (p.created_at, p.id) < (p_cursor_created_at, p_cursor_id)
    )
  ORDER BY p.created_at DESC, p.id DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 21), 1), 31);
$function$;

REVOKE ALL ON FUNCTION public.orbis_following_feed(uuid, integer, timestamptz, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.orbis_following_feed(uuid, integer, timestamptz, uuid)
  TO service_role;
