-- Server-only write boundary for the ORBIS daily feed.
-- The API is accessed through the signed-guest Supabase Edge Function.
drop trigger if exists orbis_daily_cooldown_trigger on public.orbis_daily_posts;
drop policy if exists "ORBIS users create own posts" on public.orbis_daily_posts;
drop policy if exists "ORBIS users delete own posts" on public.orbis_daily_posts;
drop policy if exists "ORBIS users add own reaction" on public.orbis_reactions;
drop policy if exists "ORBIS users update own reaction" on public.orbis_reactions;
drop policy if exists "ORBIS users remove own reaction" on public.orbis_reactions;
revoke all on public.orbis_daily_posts from public,anon,authenticated;
grant select on public.orbis_daily_posts to anon,authenticated;
revoke all on public.orbis_reactions from public,anon,authenticated;
grant select on public.orbis_reactions to anon,authenticated;
revoke all on public.orbis_post_limits from public,anon,authenticated;
create or replace function public.orbis_publish_daily_post(p_user_id uuid,p_body text)
returns public.orbis_daily_posts language plpgsql security definer set search_path=public,pg_temp as $$
declare accepted_user_id uuid; created_post public.orbis_daily_posts; clean_body text:=btrim(coalesce(p_body,''));
begin
 if p_user_id is null then raise exception using errcode='28000',message='AUTH_REQUIRED'; end if;
 if char_length(clean_body)<1 or char_length(clean_body)>140 then raise exception using errcode='22023',message='POST_LENGTH'; end if;
 if not exists(select 1 from public.profiles where id=p_user_id) then raise exception using errcode='23503',message='PROFILE_NOT_FOUND'; end if;
 insert into public.orbis_post_limits(user_id,last_post_at) values(p_user_id,now())
 on conflict(user_id) do update set last_post_at=excluded.last_post_at
 where public.orbis_post_limits.last_post_at<=now()-interval '24 hours'
 returning user_id into accepted_user_id;
 if accepted_user_id is null then raise exception using errcode='P0001',message='DAILY_LIMIT'; end if;
 insert into public.orbis_daily_posts(author_id,body) values(p_user_id,clean_body) returning * into created_post;
 return created_post;
end; $$;
revoke all on function public.orbis_publish_daily_post(uuid,text) from public,anon,authenticated;
grant execute on function public.orbis_publish_daily_post(uuid,text) to service_role;
create or replace function public.orbis_get_next_post_at(p_user_id uuid)
returns timestamptz language sql security definer set search_path=public,pg_temp as $$
 select last_post_at+interval '24 hours' from public.orbis_post_limits where user_id=p_user_id limit 1;
$$;
revoke all on function public.orbis_get_next_post_at(uuid) from public,anon,authenticated;
grant execute on function public.orbis_get_next_post_at(uuid) to service_role;
