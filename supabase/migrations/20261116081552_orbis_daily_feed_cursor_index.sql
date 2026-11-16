CREATE INDEX IF NOT EXISTS orbis_daily_posts_feed_cursor_idx
ON public.orbis_daily_posts (created_at DESC, id DESC)
WHERE status = 'published';
