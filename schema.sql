-- Run once in the Supabase SQL editor. Never expose your service-role key.
create table public.admins (user_id uuid primary key references auth.users(id) on delete cascade);
create table public.levels (
  id bigint generated always as identity primary key,
  rank integer not null unique check (rank > 0),
  name text not null, creator text not null, difficulty text not null
);
create table public.records (
  id bigint generated always as identity primary key,
  level_id bigint not null references public.levels(id) on delete cascade,
  player_name text not null, progress integer not null check (progress between 1 and 100),
  proof_url text not null check (proof_url ~* '^https?://')
);
create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  submitted_by uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('level','record')),
  payload jsonb not null check (jsonb_typeof(payload) = 'object' and length(payload::text) < 10000),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now()
);
alter table public.admins enable row level security;
alter table public.levels enable row level security;
alter table public.records enable row level security;
alter table public.submissions enable row level security;
create policy "Admins see their own membership" on public.admins for select to authenticated using (user_id = auth.uid());
create policy "Public levels" on public.levels for select using (true);
create policy "Public records" on public.records for select using (true);
create policy "Users submit as themselves" on public.submissions for insert to authenticated with check (submitted_by = auth.uid() and status = 'pending');
create policy "Users see own submissions or admins see all" on public.submissions for select to authenticated using (submitted_by = auth.uid() or exists (select 1 from public.admins where user_id = auth.uid()));
-- This function is the only public-facing way to publish. It checks membership server-side.
create function public.review_submission(submission_id uuid, approve boolean, level_rank integer default null, record_level_id bigint default null)
returns void language plpgsql security definer set search_path = public as $$
declare s public.submissions%rowtype;
begin
  if auth.uid() is null or not exists (select 1 from public.admins where user_id = auth.uid()) then raise exception 'Not authorized'; end if;
  select * into s from public.submissions where id = submission_id and status = 'pending' for update;
  if not found then raise exception 'Submission not found or already reviewed'; end if;
  if approve then
    if s.type = 'level' then
      if level_rank is null or level_rank < 1 or coalesce(trim(s.payload->>'level_name'),'') = '' or coalesce(trim(s.payload->>'creator'),'') = '' or s.payload->>'difficulty' not in ('Easy Demon','Medium Demon','Hard Demon','Insane Demon','Extreme Demon') then raise exception 'Invalid level or rank'; end if;
      insert into public.levels(rank,name,creator,difficulty) values (level_rank, s.payload->>'level_name',s.payload->>'creator',s.payload->>'difficulty');
    else
      if record_level_id is null or coalesce(trim(s.payload->>'player_name'),'') = '' or coalesce(s.payload->>'proof_url','') !~* '^https?://' then raise exception 'Invalid record'; end if;
      insert into public.records(level_id,player_name,progress,proof_url) values(record_level_id,s.payload->>'player_name',(s.payload->>'progress')::integer,s.payload->>'proof_url');
    end if;
  end if;
  update public.submissions set status = case when approve then 'approved' else 'rejected' end where id = s.id;
end $$;
revoke all on function public.review_submission(uuid, boolean, integer, bigint) from public, anon;
grant execute on function public.review_submission(uuid, boolean, integer, bigint) to authenticated;
