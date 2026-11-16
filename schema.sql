-- Coach Field Log: database setup for Supabase
--
-- Run this whole file once: Supabase dashboard > SQL Editor > New query > paste > Run.
-- It is safe to run again later (for example after an update from the repository).
--
-- What it creates
--   profiles   one row per person who has an account, with a role and an approval flag
--   records    every form submission, stored as JSON so new forms need no new tables
--   analysis_* read-only views that turn the JSON into ordinary tables for analysis
--
-- Who can do what
--   Signed-out visitors   nothing
--   Signed in, not approved   nothing (they see a "waiting for approval" screen)
--   Approved coach        read all records, add records, edit and delete their own
--   Admin                 everything a coach can, edit or delete anyone's records,
--                         create custom forms, approve people and change roles
--   The first account created becomes the admin. Everyone after that needs approval.


-- 1. People ---------------------------------------------------------------------

create table if not exists public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  email      text,
  name       text not null default '',
  role       text not null default 'coach' check (role in ('coach', 'admin')),
  approved   boolean not null default false,
  created_at timestamptz not null default now()
);


-- 2. Records --------------------------------------------------------------------

create table if not exists public.records (
  id         uuid primary key default gen_random_uuid(),
  collection text not null check (collection ~ '^[a-zA-Z0-9_-]{1,80}$'),
  data       jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz
);

create index if not exists records_collection_created_idx
  on public.records (collection, created_at);

-- Lets live updates describe deleted rows fully.
alter table public.records replica identity full;


-- 3. Helper functions -------------------------------------------------------------
-- security definer lets these read profiles without tripping over profiles' own rules.

create or replace function public.is_approved()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select coalesce((select p.approved from public.profiles p where p.id = auth.uid()), false)
$$;

create or replace function public.is_admin()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select coalesce((select p.approved and p.role = 'admin' from public.profiles p where p.id = auth.uid()), false)
$$;

-- A harmless call the optional keep-alive workflow uses so the free project is not paused.
create or replace function public.ping()
returns text
language sql stable
as $$ select 'ok'::text $$;


-- 4. Triggers ---------------------------------------------------------------------

-- Stamp who created or changed a record on the server, so the browser cannot fake it.
create or replace function public.records_guard()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := auth.uid();
    new.created_at := now();
    new.updated_by := null;
    new.updated_at := null;
  else
    new.collection := old.collection;
    new.created_by := old.created_by;
    new.created_at := old.created_at;
    new.updated_by := auth.uid();
    new.updated_at := now();
  end if;
  return new;
end
$$;

drop trigger if exists records_guard on public.records;
create trigger records_guard
  before insert or update on public.records
  for each row execute function public.records_guard();

-- Only admins may change roles or approval. (The SQL editor has no signed-in user, so it may.)
create or replace function public.profiles_guard()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    new.role := old.role;
    new.approved := old.approved;
  end if;
  new.id := old.id;
  new.email := old.email;
  new.created_at := old.created_at;
  return new;
end
$$;

drop trigger if exists profiles_guard on public.profiles;
create trigger profiles_guard
  before update on public.profiles
  for each row execute function public.profiles_guard();

-- Create a profile whenever someone signs up. The very first person becomes the admin.
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  first_user boolean;
begin
  select not exists (select 1 from public.profiles) into first_user;
  insert into public.profiles (id, email, name, role, approved)
  values (
    new.id,
    new.email,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'name'), ''), split_part(new.email, '@', 1)),
    case when first_user then 'admin' else 'coach' end,
    first_user
  )
  on conflict (id) do nothing;
  return new;
end
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Accounts created before this script ran: give them profiles, and make the oldest the admin.
insert into public.profiles (id, email, name, role, approved)
select u.id, u.email, split_part(u.email, '@', 1), 'coach', false
from auth.users u
on conflict (id) do nothing;

update public.profiles
set role = 'admin', approved = true
where id = (select id from public.profiles order by created_at limit 1)
  and not exists (select 1 from public.profiles where role = 'admin');


-- 5. Access rules (row level security) ------------------------------------------------

alter table public.profiles enable row level security;
alter table public.records  enable row level security;

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_approved());

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles
  for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

drop policy if exists records_select on public.records;
create policy records_select on public.records
  for select to authenticated
  using (public.is_approved());

drop policy if exists records_insert on public.records;
create policy records_insert on public.records
  for insert to authenticated
  with check (public.is_approved() and (collection <> 'formdefs' or public.is_admin()));

drop policy if exists records_update on public.records;
create policy records_update on public.records
  for update to authenticated
  using (public.is_approved() and (created_by = auth.uid() or public.is_admin()))
  with check (public.is_approved() and (collection <> 'formdefs' or public.is_admin()));

drop policy if exists records_delete on public.records;
create policy records_delete on public.records
  for delete to authenticated
  using (
    public.is_approved()
    and (created_by = auth.uid() or public.is_admin())
    and (collection <> 'formdefs' or public.is_admin())
  );


-- 6. Privileges -----------------------------------------------------------------------
-- Supabase gives new tables to everyone by default. Take that back, then grant only what is needed.

revoke all on public.profiles from anon, authenticated;
revoke all on public.records  from anon, authenticated;

grant select, insert, update, delete on public.records to authenticated;
grant select on public.profiles to authenticated;
grant update (name, role, approved) on public.profiles to authenticated;

revoke execute on function public.is_approved() from public, anon;
revoke execute on function public.is_admin()    from public, anon;
grant  execute on function public.is_approved() to authenticated;
grant  execute on function public.is_admin()    to authenticated;
grant  execute on function public.ping()        to anon, authenticated;


-- 7. Live updates -----------------------------------------------------------------------

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.records;
    exception when duplicate_object then
      null;
    end;
  end if;
end
$$;


-- 7b. Admin password reset ---------------------------------------------------------
-- A page in the browser cannot set someone else's password, and Supabase's own reset emails
-- only reach addresses on your Supabase team unless you set up your own email service.
-- So an admin can set a temporary password here (People tab > Reset password) and the person
-- changes it after signing in (Password at the top of the app).

create extension if not exists pgcrypto with schema extensions;

create or replace function public.admin_set_password(target uuid, new_password text)
returns void
language plpgsql
security definer
set search_path = public, extensions, auth
as $$
begin
  if not public.is_admin() then
    raise exception 'Only admins can reset passwords' using errcode = '42501';
  end if;
  if target = auth.uid() then
    raise exception 'Use Password at the top of the app to change your own password' using errcode = '22023';
  end if;
  if new_password is null or length(new_password) < 8 then
    raise exception 'The password must be at least 8 characters' using errcode = '22023';
  end if;
  update auth.users
     set encrypted_password = crypt(new_password, gen_salt('bf', 10)),
         updated_at = now()
   where id = target;
  if not found then
    raise exception 'No such account' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.admin_set_password(uuid, text) from public, anon, authenticated;
grant execute on function public.admin_set_password(uuid, text) to authenticated;


-- 8. Analysis views ----------------------------------------------------------------------
-- Ordinary tables built from the JSON, one row per school, student, session and so on.
-- They follow the same access rules as the records they read (security_invoker).
-- Find them in Supabase under Table Editor, where each has an Export to CSV button.

create or replace view public.analysis_schools
with (security_invoker = true) as
select
  r.id                                       as school_id,
  r.data -> 'd' ->> 'school_name'            as school_name,
  r.data -> 'd' ->> 'region'                 as region,
  r.data -> 'd' ->> 'school_type'            as school_type,
  r.data -> 'd' ->> 'contact_person'         as contact_person,
  r.data -> 'd' ->> 'contact_phone'          as contact_phone,
  (r.data -> 'd' ->> 'total_learners')::numeric as total_learners,
  r.data -> 'd' ->> 'notes'                  as notes,
  r.created_at
from public.records r
where r.collection = 'school';

create or replace view public.analysis_students
with (security_invoker = true) as
select
  r.id                                       as student_id,
  r.data -> 'd' ->> 'school'                 as school_id,
  sc.data -> 'd' ->> 'school_name'           as school_name,
  r.data -> 'd' ->> 'first_name'             as first_name,
  r.data -> 'd' ->> 'last_name'              as last_name,
  concat_ws(' ', r.data -> 'd' ->> 'first_name', r.data -> 'd' ->> 'last_name') as student_name,
  r.data -> 'd' ->> 'gender'                 as gender,
  (r.data -> 'd' ->> 'date_of_birth')::date  as date_of_birth,
  r.data -> 'd' ->> 'grade'                  as grade,
  r.data -> 'd' ->> 'guardian_name'          as guardian_name,
  r.data -> 'd' ->> 'guardian_phone'         as guardian_phone,
  r.data -> 'd' ->> 'consent_given'          as consent_given,
  r.created_at
from public.records r
left join public.records sc
  on sc.collection = 'school' and sc.id::text = r.data -> 'd' ->> 'school'
where r.collection = 'student';

create or replace view public.analysis_sessions
with (security_invoker = true) as
select
  r.id                                       as session_id,
  (r.data -> 'd' ->> 'date')::date           as session_date,
  r.data -> 'd' ->> 'school'                 as school_id,
  sc.data -> 'd' ->> 'school_name'           as school_name,
  r.created_by                               as coach_id,
  p.name                                     as coach_name,
  r.data -> 'd' ->> 'session_type'           as session_type,
  r.data -> 'd' ->> 'module'                 as module,
  r.data -> 'd' ->> 'topic'                  as topic,
  (r.data -> 'd' ->> 'duration_minutes')::numeric        as duration_minutes,
  round((r.data -> 'd' ->> 'duration_minutes')::numeric / 60, 2) as duration_hours,
  coalesce(a.present, 0)                     as present_count,
  coalesce(a.absent, 0)                      as absent_count,
  coalesce(a.excused, 0)                     as excused_count,
  coalesce(a.marked, 0)                      as students_marked,
  round(100.0 * coalesce(a.present, 0) / nullif(coalesce(a.marked, 0), 0), 1) as attendance_pct,
  r.data -> 'd' ->> 'summary'                as summary,
  r.data -> 'd' ->> 'challenges'             as challenges,
  r.data -> 'd' ->> 'next_steps'             as next_steps,
  r.created_at
from public.records r
left join public.records sc
  on sc.collection = 'school' and sc.id::text = r.data -> 'd' ->> 'school'
left join public.profiles p on p.id = r.created_by
left join lateral (
  select
    count(*) filter (where e.value = 'Present') as present,
    count(*) filter (where e.value = 'Absent')  as absent,
    count(*) filter (where e.value = 'Excused') as excused,
    count(*)                                    as marked
  from jsonb_each_text(
    case when jsonb_typeof(r.data -> 'd' -> 'attendance') = 'object'
         then r.data -> 'd' -> 'attendance' else '{}'::jsonb end
  ) e
) a on true
where r.collection = 'session';

create or replace view public.analysis_attendance
with (security_invoker = true) as
select
  r.id                                       as session_id,
  (r.data -> 'd' ->> 'date')::date           as session_date,
  r.data -> 'd' ->> 'school'                 as school_id,
  sc.data -> 'd' ->> 'school_name'           as school_name,
  e.key                                      as student_id,
  concat_ws(' ', st.data -> 'd' ->> 'first_name', st.data -> 'd' ->> 'last_name') as student_name,
  e.value                                    as status,
  (e.value = 'Present')                      as present
from public.records r
cross join lateral jsonb_each_text(
  case when jsonb_typeof(r.data -> 'd' -> 'attendance') = 'object'
       then r.data -> 'd' -> 'attendance' else '{}'::jsonb end
) e
left join public.records sc
  on sc.collection = 'school' and sc.id::text = r.data -> 'd' ->> 'school'
left join public.records st
  on st.collection = 'student' and st.id::text = e.key
where r.collection = 'session';

create or replace view public.analysis_assessments
with (security_invoker = true) as
select
  r.id                                       as assessment_id,
  (r.data -> 'd' ->> 'date')::date           as assessment_date,
  r.data -> 'd' ->> 'school'                 as school_id,
  sc.data -> 'd' ->> 'school_name'           as school_name,
  r.data -> 'd' ->> 'assessment_type'        as assessment_type,
  r.data -> 'd' ->> 'module'                 as module,
  e.key                                      as student_id,
  concat_ws(' ', st.data -> 'd' ->> 'first_name', st.data -> 'd' ->> 'last_name') as student_name,
  e.value::numeric                           as score,
  (r.data -> 'd' ->> 'max_score')::numeric   as max_score,
  round(100.0 * e.value::numeric / nullif((r.data -> 'd' ->> 'max_score')::numeric, 0), 1) as score_pct,
  r.created_by                               as recorded_by,
  r.created_at
from public.records r
cross join lateral jsonb_each_text(
  case when jsonb_typeof(r.data -> 'd' -> 'scores') = 'object'
       then r.data -> 'd' -> 'scores' else '{}'::jsonb end
) e
left join public.records sc
  on sc.collection = 'school' and sc.id::text = r.data -> 'd' ->> 'school'
left join public.records st
  on st.collection = 'student' and st.id::text = e.key
where r.collection = 'assessment';

-- One row per student and module, with the latest pre and post scores side by side.
create or replace view public.analysis_pre_post
with (security_invoker = true) as
select
  x.*,
  round(x.post_pct - x.pre_pct, 1) as change_points
from (
  select
    a.student_id,
    max(a.student_name) as student_name,
    max(a.school_id)    as school_id,
    max(a.school_name)  as school_name,
    a.module,
    (array_agg(a.score_pct order by a.assessment_date desc, a.created_at desc)
       filter (where a.assessment_type = 'Pre'))[1]  as pre_pct,
    (array_agg(a.score_pct order by a.assessment_date desc, a.created_at desc)
       filter (where a.assessment_type = 'Post'))[1] as post_pct
  from public.analysis_assessments a
  group by a.student_id, a.module
) x;

grant select on
  public.analysis_schools,
  public.analysis_students,
  public.analysis_sessions,
  public.analysis_attendance,
  public.analysis_assessments,
  public.analysis_pre_post
to authenticated;

revoke all on
  public.analysis_schools,
  public.analysis_students,
  public.analysis_sessions,
  public.analysis_attendance,
  public.analysis_assessments,
  public.analysis_pre_post
from anon;
