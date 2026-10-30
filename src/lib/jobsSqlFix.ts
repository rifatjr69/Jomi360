export const JOBS_RLS_FIX_SQL = `-- =====================================================================
-- জমি৩৬০ জব মার্কেটপ্লেস ফিক্স: 42P17 RLS Recursion দূর করা ও সম্পূর্ণ ফ্লো সচল করা
-- Supabase Dashboard -> SQL Editor -> New Query তে পেস্ট করে Run বাটনে ক্লিক করুন
-- =====================================================================

-- 1. SECURITY DEFINER হেল্পার ফাংশন (RLS লুপ বা 42P17 সম্পূর্ণ বন্ধ করার জন্য)
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where (p.id = auth.uid() or p.auth_user_id = auth.uid())
      and p.role = 'admin'
  );
$$;

create or replace function public.current_user_profile_id()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(
    (
      select p.id
      from public.profiles p
      where p.id = auth.uid() or p.auth_user_id = auth.uid()
      order by (case when p.id = auth.uid() then 0 else 1 end)
      limit 1
    ),
    auth.uid()
  );
$$;

create or replace function public.is_my_actor_id(check_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select auth.uid() is not null
    and check_id is not null
    and (check_id = auth.uid() or check_id = public.current_user_profile_id());
$$;

create or replace function public.check_is_job_owner(p_job_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select auth.uid() is not null
    and exists (
      select 1
      from public.jobs j
      where j.id = p_job_id
        and (j.poster_id = auth.uid() or j.poster_id = public.current_user_profile_id())
    );
$$;

create or replace function public.check_is_job_worker_or_applicant(p_job_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select auth.uid() is not null
    and (
      exists (
        select 1
        from public.jobs j
        where j.id = p_job_id
          and (j.assigned_to = auth.uid() or j.assigned_to = public.current_user_profile_id())
      )
      or exists (
        select 1
        from public.job_applications a
        where a.job_id = p_job_id
          and (a.applicant_id = auth.uid() or a.applicant_id = public.current_user_profile_id())
      )
    );
$$;

create or replace function public.check_can_review_job(p_job_id uuid, p_reviewee_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select auth.uid() is not null
    and exists (
      select 1
      from public.jobs j
      where j.id = p_job_id
        and j.status = 'completed'
        and (
          (public.is_my_actor_id(j.poster_id) and j.assigned_to = p_reviewee_id)
          or (public.is_my_actor_id(j.assigned_to) and j.poster_id = p_reviewee_id)
        )
    );
$$;

grant execute on function public.is_admin() to anon, authenticated, service_role;
grant execute on function public.current_user_profile_id() to anon, authenticated, service_role;
grant execute on function public.is_my_actor_id(uuid) to anon, authenticated, service_role;
grant execute on function public.check_is_job_owner(uuid) to anon, authenticated, service_role;
grant execute on function public.check_is_job_worker_or_applicant(uuid) to anon, authenticated, service_role;
grant execute on function public.check_can_review_job(uuid, uuid) to anon, authenticated, service_role;

-- 2. পুরনো সকল রিকার্সিভ পলিসি মুছে ফেলা
do $$
declare
  pol record;
begin
  for pol in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('jobs', 'job_applications', 'job_messages', 'reviews', 'notifications')
  loop
    execute format('drop policy if exists %I on %I.%I', pol.policyname, pol.schemaname, pol.tablename);
  end loop;
end $$;

alter table public.jobs enable row level security;
alter table public.job_applications enable row level security;
alter table public.job_messages enable row level security;
alter table public.reviews enable row level security;
alter table public.notifications enable row level security;

grant select on public.jobs, public.reviews to anon, authenticated;
grant select, insert, update, delete on public.jobs, public.job_applications, public.job_messages, public.reviews, public.notifications to authenticated;

-- 3. public.jobs এর নতুন নন-রিকার্সিভ পলিসি
create policy "jobs_select_clean"
  on public.jobs for select
  using (
    status = 'open'
    or public.is_my_actor_id(poster_id)
    or public.is_my_actor_id(assigned_to)
    or public.check_is_job_worker_or_applicant(id)
    or public.is_admin()
  );

create policy "jobs_insert_clean"
  on public.jobs for insert
  with check (
    public.is_my_actor_id(poster_id) or public.is_admin()
  );

create policy "jobs_update_clean"
  on public.jobs for update
  using (
    public.is_my_actor_id(poster_id)
    or public.is_my_actor_id(assigned_to)
    or public.is_admin()
  )
  with check (
    public.is_my_actor_id(poster_id)
    or public.is_my_actor_id(assigned_to)
    or public.is_admin()
  );

create policy "jobs_delete_clean"
  on public.jobs for delete
  using (
    public.is_my_actor_id(poster_id) or public.is_admin()
  );

-- 4. public.job_applications এর নতুন নন-রিকার্সিভ পলিসি
create policy "job_apps_select_clean"
  on public.job_applications for select
  using (
    public.is_my_actor_id(applicant_id)
    or public.check_is_job_owner(job_id)
    or public.is_admin()
  );

create policy "job_apps_insert_clean"
  on public.job_applications for insert
  with check (
    (public.is_my_actor_id(applicant_id) and not public.check_is_job_owner(job_id))
    or public.is_admin()
  );

create policy "job_apps_update_clean"
  on public.job_applications for update
  using (
    public.is_my_actor_id(applicant_id)
    or public.check_is_job_owner(job_id)
    or public.is_admin()
  )
  with check (
    public.is_my_actor_id(applicant_id)
    or public.check_is_job_owner(job_id)
    or public.is_admin()
  );

create policy "job_apps_delete_clean"
  on public.job_applications for delete
  using (
    public.is_my_actor_id(applicant_id)
    or public.check_is_job_owner(job_id)
    or public.is_admin()
  );

-- 5. public.job_messages এর পলিসি
create policy "job_msgs_select_clean"
  on public.job_messages for select
  using (
    public.is_my_actor_id(sender_id)
    or public.is_my_actor_id(receiver_id)
    or public.is_my_actor_id(applicant_id)
    or public.check_is_job_owner(job_id)
    or public.is_admin()
  );

create policy "job_msgs_insert_clean"
  on public.job_messages for insert
  with check (
    public.is_my_actor_id(sender_id) or public.is_admin()
  );

create policy "job_msgs_update_clean"
  on public.job_messages for update
  using (
    public.is_my_actor_id(receiver_id) or public.is_my_actor_id(sender_id) or public.is_admin()
  );

-- 6. public.reviews এর পলিসি
create policy "reviews_select_clean"
  on public.reviews for select
  using (true);

create policy "reviews_insert_clean"
  on public.reviews for insert
  with check (
    public.is_my_actor_id(reviewer_id)
    and public.check_can_review_job(job_id, reviewee_id)
  );

create policy "reviews_delete_clean"
  on public.reviews for delete
  using (public.is_admin());

-- 7. public.notifications এর পলিসি
create policy "notifs_select_clean"
  on public.notifications for select
  using (
    public.is_my_actor_id(user_id) or public.is_admin()
  );

create policy "notifs_insert_clean"
  on public.notifications for insert
  with check (
    auth.uid() is not null
  );

create policy "notifs_update_clean"
  on public.notifications for update
  using (
    public.is_my_actor_id(user_id) or public.is_admin()
  );

create policy "notifs_delete_clean"
  on public.notifications for delete
  using (
    public.is_my_actor_id(user_id) or public.is_admin()
  );

-- 8. প্রোফাইলে অটো রেটিং ও সম্পন্ন কাজের সংখ্যা আপডেট ট্রিগার
create or replace function public.sync_profile_review_stats()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_id uuid;
begin
  target_id := coalesce(new.reviewee_id, old.reviewee_id);
  if target_id is not null then
    update public.profiles
    set
      avg_rating = coalesce((select round(avg(rating)::numeric, 2) from public.reviews where reviewee_id = target_id), 0),
      review_count = (select count(*) from public.reviews where reviewee_id = target_id)
    where id = target_id;
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_sync_profile_review_stats on public.reviews;
create trigger trg_sync_profile_review_stats
after insert or update or delete on public.reviews
for each row execute function public.sync_profile_review_stats();

create or replace function public.sync_profile_completed_jobs()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.assigned_to is not null and (old.status is distinct from new.status or old.assigned_to is distinct from new.assigned_to) then
    update public.profiles
    set completed_jobs_count = (
      select count(*) from public.jobs where assigned_to = new.assigned_to and status = 'completed'
    )
    where id = new.assigned_to;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sync_profile_completed_jobs on public.jobs;
create trigger trg_sync_profile_completed_jobs
after insert or update on public.jobs
for each row execute function public.sync_profile_completed_jobs();

-- 9. জব ফাইল অ্যাটাচমেন্ট স্টোরেজ পলিসি
insert into storage.buckets (id, name, public)
values ('job-attachments', 'job-attachments', true)
on conflict (id) do update set public = true;

drop policy if exists "job_attachments_public_read" on storage.objects;
create policy "job_attachments_public_read"
  on storage.objects for select
  using (bucket_id = 'job-attachments');

drop policy if exists "job_attachments_auth_upload" on storage.objects;
create policy "job_attachments_auth_upload"
  on storage.objects for insert
  with check (bucket_id = 'job-attachments' and auth.uid() is not null);

-- 10. যেকোনো লগইন ইউজার যেন সাথে সাথে জব পোস্ট ও আবেদন করতে পারেন (অ্যাডমিন প্যানেল থেকে যেকোনো সময় পরিবর্তনযোগ্য)
update public.site_settings
set
  require_verified_to_post_job = false,
  require_verified_to_apply_job = false,
  require_job_approval = false
where id = 1;
`;

export function isJobsRlsError(err: any): boolean {
  if (!err) return false;
  const code = String(err?.code || '');
  const msg = String(err?.message || err || '').toLowerCase();
  return (
    code === '42P17' ||
    msg.includes('infinite recursion') ||
    msg.includes('42p17')
  );
}
