-- Daily-topic shared feed for the existing ORBIS profiles table.
create table if not exists public.orbis_daily_posts (
 id uuid primary key default gen_random_uuid(),
 author_id uuid not null references public.profiles(id) on delete cascade,
 body text not null,
 status text not null default 'published' check(status in ('published','hidden','removed')),
 created_at timestamptz not null default now(),
 boosted_until timestamptz,
 constraint orbis_daily_posts_body_length check(char_length(btrim(body)) between 1 and 140)
);
create index if not exists orbis_daily_posts_feed_idx on public.orbis_daily_posts(created_at desc) where status='published';
create index if not exists orbis_daily_posts_author_idx on public.orbis_daily_posts(author_id,created_at desc);
create table if not exists public.orbis_reactions(
 post_id uuid not null references public.orbis_daily_posts(id) on delete cascade,
 user_id uuid not null references public.profiles(id) on delete cascade,
 reaction text not null check(reaction in ('🔥','💎','🚀','😂')),
 created_at timestamptz not null default now(),
 primary key(post_id,user_id)
);
create index if not exists orbis_reactions_post_idx on public.orbis_reactions(post_id);
create index if not exists orbis_reactions_user_idx on public.orbis_reactions(user_id);
create table if not exists public.orbis_post_limits(
 user_id uuid primary key references public.profiles(id) on delete cascade,
 last_post_at timestamptz not null
);
create table if not exists public.orbis_bookmarks(
 user_id uuid not null references public.profiles(id) on delete cascade,
 post_id uuid not null references public.orbis_daily_posts(id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key(user_id,post_id)
);
create index if not exists orbis_bookmarks_post_idx on public.orbis_bookmarks(post_id);
alter table public.orbis_daily_posts enable row level security;
alter table public.orbis_reactions enable row level security;
alter table public.orbis_post_limits enable row level security;
alter table public.orbis_bookmarks enable row level security;
create policy "ORBIS published posts readable" on public.orbis_daily_posts for select to anon,authenticated using(status='published');
create policy "ORBIS reactions readable" on public.orbis_reactions for select to anon,authenticated using(true);
revoke all on public.orbis_daily_posts from public,anon,authenticated;
grant select on public.orbis_daily_posts to anon,authenticated;
revoke all on public.orbis_reactions from public,anon,authenticated;
grant select on public.orbis_reactions to anon,authenticated;
revoke all on public.orbis_post_limits from public,anon,authenticated;
revoke all on public.orbis_bookmarks from public,anon,authenticated;
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
