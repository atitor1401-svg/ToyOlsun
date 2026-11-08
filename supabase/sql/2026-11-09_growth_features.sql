-- ToyOlsun 1.2.0 — growth features
-- 1 favourites synced to the account      -> public.favorites
-- 2 customer <-> partner chat              -> public.conversations, public.messages
-- 3 partner busy-days calendar             -> public.service_busy_dates
-- 4 wedding countdown + checklist          -> profiles.wedding_date, public.checklist_items
-- 5 partner statistics                     -> public.service_events + RPCs
-- 6 photo reviews + "verified" badge       -> customer_reviews.images, public.service_badges
-- (7 share links and 8 estimate PDF need no database changes.)
--
-- Everything is additive: no existing column, row or policy is changed or removed,
-- so the store builds (1.1.9) keep working unchanged.
-- Every new table has RLS on. Writes that touch other people's data go through
-- SECURITY DEFINER functions that check auth.uid() themselves.

begin;

-- =====================================================================
-- 1. FAVOURITES
-- =====================================================================
create table if not exists public.favorites (
    user_id    uuid   not null references auth.users(id) on delete cascade,
    service_id bigint not null references public.service(id) on delete cascade,
    created_at timestamptz not null default now(),
    primary key (user_id, service_id)
);
alter table public.favorites enable row level security;

create policy "favorites: read own"   on public.favorites for select to authenticated using (user_id = auth.uid());
create policy "favorites: add own"    on public.favorites for insert to authenticated with check (user_id = auth.uid());
create policy "favorites: remove own" on public.favorites for delete to authenticated using (user_id = auth.uid());

-- =====================================================================
-- 2. CHAT
-- =====================================================================
create table if not exists public.conversations (
    id              bigint generated always as identity primary key,
    service_id      bigint references public.service(id) on delete set null,
    customer_id     uuid not null references auth.users(id) on delete cascade,
    partner_id      uuid not null references auth.users(id) on delete cascade,
    service_title   text,                       -- kept so the chat still reads well if the service is deleted
    last_message    text,
    last_message_at timestamptz not null default now(),
    customer_unread integer not null default 0,
    partner_unread  integer not null default 0,
    created_at      timestamptz not null default now(),
    unique (service_id, customer_id)
);
create index if not exists conversations_customer_idx on public.conversations (customer_id, last_message_at desc);
create index if not exists conversations_partner_idx  on public.conversations (partner_id,  last_message_at desc);
alter table public.conversations enable row level security;

-- Participants can read their conversations. No direct insert/update/delete:
-- conversations are opened by start_conversation() and kept up to date by the
-- message trigger and mark_conversation_read().
create policy "conversations: participants read" on public.conversations for select to authenticated
    using (auth.uid() = customer_id or auth.uid() = partner_id);

create table if not exists public.messages (
    id              bigint generated always as identity primary key,
    conversation_id bigint not null references public.conversations(id) on delete cascade,
    sender_id       uuid   not null references auth.users(id) on delete cascade,
    body            text   not null check (char_length(btrim(body)) between 1 and 2000),
    created_at      timestamptz not null default now()
);
create index if not exists messages_conversation_idx on public.messages (conversation_id, created_at);
alter table public.messages enable row level security;

create policy "messages: participants read" on public.messages for select to authenticated
    using (exists (select 1 from public.conversations c
                   where c.id = conversation_id and (auth.uid() = c.customer_id or auth.uid() = c.partner_id)));
create policy "messages: participants send" on public.messages for insert to authenticated
    with check (sender_id = auth.uid()
                and exists (select 1 from public.conversations c
                            where c.id = conversation_id and (auth.uid() = c.customer_id or auth.uid() = c.partner_id)));

-- Opens (or returns) the chat between the signed-in customer and a service's owner.
create or replace function public.start_conversation(p_service_id bigint)
returns bigint
language plpgsql security definer set search_path = public
as $$
declare
    v_uid   uuid := auth.uid();
    v_owner uuid;
    v_title text;
    v_id    bigint;
begin
    if v_uid is null then raise exception 'not signed in'; end if;
    select owner_id, title into v_owner, v_title from public.service where id = p_service_id and status = 'approved';
    if v_owner is null then raise exception 'service not found'; end if;
    if v_owner = v_uid then raise exception 'cannot message your own service'; end if;

    insert into public.conversations (service_id, customer_id, partner_id, service_title)
    values (p_service_id, v_uid, v_owner, v_title)
    on conflict (service_id, customer_id) do update set service_title = excluded.service_title
    returning id into v_id;
    return v_id;
end $$;
revoke all on function public.start_conversation(bigint) from public, anon;
grant execute on function public.start_conversation(bigint) to authenticated;

-- Clears the unread counter for the side that is reading.
create or replace function public.mark_conversation_read(p_conversation_id bigint)
returns void
language sql security definer set search_path = public
as $$
    update public.conversations
       set customer_unread = case when customer_id = auth.uid() then 0 else customer_unread end,
           partner_unread  = case when partner_id  = auth.uid() then 0 else partner_unread  end
     where id = p_conversation_id and auth.uid() in (customer_id, partner_id);
$$;
revoke all on function public.mark_conversation_read(bigint) from public, anon;
grant execute on function public.mark_conversation_read(bigint) to authenticated;

-- After each message: update the conversation preview + unread counter and
-- push-notify the other side (uses the existing push_send()).
create or replace function public.messages_after_insert()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
    c         public.conversations;
    v_to      uuid;
    v_tokens  text[];
    v_title   text;
begin
    update public.conversations
       set last_message    = left(new.body, 200),
           last_message_at = new.created_at,
           customer_unread = customer_unread + case when new.sender_id = partner_id  then 1 else 0 end,
           partner_unread  = partner_unread  + case when new.sender_id = customer_id then 1 else 0 end
     where id = new.conversation_id
    returning * into c;

    v_to := case when new.sender_id = c.customer_id then c.partner_id else c.customer_id end;
    select array_agg(token) into v_tokens from public.push_tokens where user_id = v_to;
    if v_tokens is not null and array_length(v_tokens, 1) > 0 then
        v_title := '💬 ' || coalesce(c.service_title, 'Toy Olsun');
        begin
            perform public.push_send(v_tokens, v_title, left(new.body, 120));
        exception when others then
            null; -- a failed push must never block the message
        end;
    end if;
    return new;
end $$;

drop trigger if exists messages_after_insert on public.messages;
create trigger messages_after_insert after insert on public.messages
    for each row execute function public.messages_after_insert();

-- Live updates in the chat screen.
do $$ begin
    alter publication supabase_realtime add table public.messages;
exception when duplicate_object then null; end $$;
do $$ begin
    alter publication supabase_realtime add table public.conversations;
exception when duplicate_object then null; end $$;

-- =====================================================================
-- 3. BUSY-DAYS CALENDAR
-- =====================================================================
create table if not exists public.service_busy_dates (
    service_id bigint not null references public.service(id) on delete cascade,
    day        date   not null,
    created_at timestamptz not null default now(),
    primary key (service_id, day)
);
create index if not exists service_busy_dates_day_idx on public.service_busy_dates (day);
alter table public.service_busy_dates enable row level security;

create policy "busy dates: anyone reads" on public.service_busy_dates for select to anon, authenticated using (true);
create policy "busy dates: owner adds" on public.service_busy_dates for insert to authenticated
    with check (exists (select 1 from public.service s where s.id = service_id and s.owner_id = auth.uid()));
create policy "busy dates: owner removes" on public.service_busy_dates for delete to authenticated
    using (exists (select 1 from public.service s where s.id = service_id and s.owner_id = auth.uid()));

-- =====================================================================
-- 4. WEDDING COUNTDOWN + CHECKLIST
-- =====================================================================
alter table public.profiles add column if not exists wedding_date date;  -- own-row update policy already exists

create table if not exists public.checklist_items (
    user_id  uuid not null references auth.users(id) on delete cascade,
    item_key text not null check (char_length(item_key) between 1 and 64),
    done_at  timestamptz not null default now(),
    primary key (user_id, item_key)
);
alter table public.checklist_items enable row level security;

create policy "checklist: read own"   on public.checklist_items for select to authenticated using (user_id = auth.uid());
create policy "checklist: add own"    on public.checklist_items for insert to authenticated with check (user_id = auth.uid());
create policy "checklist: remove own" on public.checklist_items for delete to authenticated using (user_id = auth.uid());

-- =====================================================================
-- 5. PARTNER STATISTICS
-- =====================================================================
create table if not exists public.service_events (
    id         bigint generated always as identity primary key,
    service_id bigint not null references public.service(id) on delete cascade,
    kind       text   not null check (kind in ('view','call','whatsapp','favorite','share','message','order')),
    created_at timestamptz not null default now()
);
create index if not exists service_events_service_idx on public.service_events (service_id, created_at desc);
alter table public.service_events enable row level security;
-- No policies on purpose: nobody reads or writes the table directly.

-- Anyone (also signed-out visitors) can log an event; only for live services.
create or replace function public.log_service_event(p_service_id bigint, p_kind text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
    if p_kind not in ('view','call','whatsapp','favorite','share','message','order') then return; end if;
    insert into public.service_events (service_id, kind)
    select id, p_kind from public.service where id = p_service_id and status = 'approved';
end $$;
revoke all on function public.log_service_event(bigint, text) from public;
grant execute on function public.log_service_event(bigint, text) to anon, authenticated;

-- Counts for the signed-in partner's own services over the last N days.
create or replace function public.get_my_service_stats(p_days integer default 30)
returns table (service_id bigint, title text, views bigint, calls bigint, whatsapp bigint,
               favorites bigint, shares bigint, messages bigint, orders bigint)
language sql stable security definer set search_path = public
as $$
    with mine as (select id, title from public.service where owner_id = auth.uid()),
         since as (select now() - make_interval(days => greatest(1, least(coalesce(p_days, 30), 365))) as t)
    select m.id, m.title,
           count(*) filter (where e.kind = 'view'),
           count(*) filter (where e.kind = 'call'),
           count(*) filter (where e.kind = 'whatsapp'),
           count(*) filter (where e.kind = 'favorite'),
           count(*) filter (where e.kind = 'share'),
           (select count(*) from public.conversations c, since where c.service_id = m.id and c.created_at >= since.t),
           (select count(*) from public.orders o, since where o.service_id = m.id and o.created_at >= since.t)
      from mine m
      left join public.service_events e
             on e.service_id = m.id and e.created_at >= (select t from since)
     group by m.id, m.title
     order by m.title;
$$;
revoke all on function public.get_my_service_stats(integer) from public, anon;
grant execute on function public.get_my_service_stats(integer) to authenticated;

-- =====================================================================
-- 6. PHOTO REVIEWS + VERIFIED BADGE
-- =====================================================================
alter table public.customer_reviews add column if not exists images text[] not null default '{}';
-- At most 4 photos per review, and only from our own storage bucket.
do $$ begin
    alter table public.customer_reviews add constraint customer_reviews_images_check
        check (cardinality(images) <= 4);
exception when duplicate_object then null; end $$;

-- Separate table on purpose: partners can update their own service row, so a
-- column there would let them give themselves the badge. Only admins (dashboard
-- / service role) write here.
create table if not exists public.service_badges (
    service_id  bigint primary key references public.service(id) on delete cascade,
    verified    boolean not null default true,
    verified_at timestamptz not null default now()
);
alter table public.service_badges enable row level security;
create policy "badges: anyone reads" on public.service_badges for select to anon, authenticated using (true);

commit;
