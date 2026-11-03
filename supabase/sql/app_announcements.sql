-- In-app information banners ("Yeni: DJ bölməsi!", promo codes, greetings).
-- Managed by the admin in the Supabase table editor; the app only reads them.
--   style   'popup' = a card shown once when the catalog opens
--           'strip' = a slim dismissible bar above the catalog
--   action  'service'  -> action_value = service id (opens that service)
--           'category' -> action_value = venues | artists | dj | media | cars |
--                         wedding_dress | flowers | decor | tourism
--           'url'      -> action_value = https://...
-- Each person sees a banner once; dismissing it remembers that on the phone.
-- Roll back: drop table public.app_announcements;

create table if not exists public.app_announcements (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  active boolean not null default false,
  style text not null default 'popup' check (style in ('popup', 'strip')),
  priority int not null default 0,
  starts_at timestamptz,
  ends_at timestamptz,
  title_az text not null,
  title_ru text,
  title_en text,
  body_az text,
  body_ru text,
  body_en text,
  button_az text,
  button_ru text,
  button_en text,
  image_url text,
  action text check (action in ('service', 'category', 'url')),
  action_value text
);

alter table public.app_announcements enable row level security;
grant select on public.app_announcements to anon, authenticated;

drop policy if exists "Live announcements are public" on public.app_announcements;
create policy "Live announcements are public" on public.app_announcements
  for select to anon, authenticated
  using (
    active
    and (starts_at is null or starts_at <= now())
    and (ends_at is null or ends_at > now())
  );
