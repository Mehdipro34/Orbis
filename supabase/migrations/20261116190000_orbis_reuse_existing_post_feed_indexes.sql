-- Reuse the pre-existing posts_for_you_rank_idx and posts_feed_cursor_idx.
-- The social feed queries filter by published status and root posts; those indexes
-- already cover popularity and newest-first pagination without duplicate index cost.
DROP INDEX IF EXISTS public.posts_popular_feed_cursor_idx;
DROP INDEX IF EXISTS public.posts_public_feed_cursor_idx;
