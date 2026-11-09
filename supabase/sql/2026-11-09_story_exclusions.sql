-- Services hidden from the automatic "Yeni" / "Top" stories (they stay in the catalogue).
-- Only admins write here (dashboard / service role); everyone can read.
create table if not exists public.story_exclusions (
    service_id bigint primary key references public.service(id) on delete cascade,
    created_at timestamptz not null default now()
);
alter table public.story_exclusions enable row level security;
drop policy if exists "story exclusions: anyone reads" on public.story_exclusions;
create policy "story exclusions: anyone reads" on public.story_exclusions for select to anon, authenticated using (true);

-- Aynur Qarabağlı (id 221): owner asked to keep her out of the stories.
insert into public.story_exclusions (service_id) values (221) on conflict do nothing;
