LOCK TABLE public.orbis_reactions IN SHARE ROW EXCLUSIVE MODE;

CREATE TABLE IF NOT EXISTS public.orbis_reaction_totals (
  post_id uuid NOT NULL REFERENCES public.orbis_daily_posts(id) ON DELETE CASCADE,
  reaction text NOT NULL CHECK (reaction IN ('🔥','💎','🚀','😂')),
  reaction_count bigint NOT NULL DEFAULT 0 CHECK (reaction_count >= 0),
  PRIMARY KEY (post_id, reaction)
);

ALTER TABLE public.orbis_reaction_totals ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.orbis_reaction_totals FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.orbis_reaction_totals TO service_role;

INSERT INTO public.orbis_reaction_totals (post_id, reaction, reaction_count)
SELECT post_id, reaction, count(*)::bigint
FROM public.orbis_reactions
GROUP BY post_id, reaction
ON CONFLICT (post_id, reaction) DO UPDATE
SET reaction_count = EXCLUDED.reaction_count;

CREATE OR REPLACE FUNCTION public.orbis_sync_reaction_totals()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.orbis_reaction_totals (post_id, reaction, reaction_count)
    VALUES (NEW.post_id, NEW.reaction, 1)
    ON CONFLICT (post_id, reaction) DO UPDATE
      SET reaction_count = public.orbis_reaction_totals.reaction_count + 1;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.orbis_reaction_totals
      SET reaction_count = reaction_count - 1
      WHERE post_id = OLD.post_id AND reaction = OLD.reaction AND reaction_count > 0;
    DELETE FROM public.orbis_reaction_totals
      WHERE post_id = OLD.post_id AND reaction = OLD.reaction AND reaction_count = 0;
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' AND OLD.post_id IS DISTINCT FROM NEW.post_id OR
        TG_OP = 'UPDATE' AND OLD.reaction IS DISTINCT FROM NEW.reaction THEN
    UPDATE public.orbis_reaction_totals
      SET reaction_count = reaction_count - 1
      WHERE post_id = OLD.post_id AND reaction = OLD.reaction AND reaction_count > 0;
    DELETE FROM public.orbis_reaction_totals
      WHERE post_id = OLD.post_id AND reaction = OLD.reaction AND reaction_count = 0;
    INSERT INTO public.orbis_reaction_totals (post_id, reaction, reaction_count)
    VALUES (NEW.post_id, NEW.reaction, 1)
    ON CONFLICT (post_id, reaction) DO UPDATE
      SET reaction_count = public.orbis_reaction_totals.reaction_count + 1;
    RETURN NEW;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS orbis_reactions_totals_sync ON public.orbis_reactions;
CREATE TRIGGER orbis_reactions_totals_sync
AFTER INSERT OR DELETE OR UPDATE OF post_id, reaction
ON public.orbis_reactions
FOR EACH ROW
EXECUTE FUNCTION public.orbis_sync_reaction_totals();

REVOKE ALL ON FUNCTION public.orbis_sync_reaction_totals() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.orbis_sync_reaction_totals() TO service_role;
