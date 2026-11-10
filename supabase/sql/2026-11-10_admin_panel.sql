-- Admin panel (web page admin.html).
-- Who is admin lives in its own table that nobody can read or write through
-- the API; every admin action goes through a function that checks it first.
-- (profiles.role is NOT used for this: users can edit their own profile row.)

create table if not exists public.admins (
    user_id uuid primary key references auth.users(id) on delete cascade,
    created_at timestamptz not null default now()
);
alter table public.admins enable row level security;
-- No policies on purpose: the table is invisible to app users.

-- ibo96@icloud.com
insert into public.admins (user_id) values ('6ea2ff9c-756b-499c-a5f2-cc50641caaa8') on conflict do nothing;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
    select exists (select 1 from admins where user_id = auth.uid());
$$;

create or replace function public.admin_guard() returns void
language plpgsql stable security definer set search_path = public as $$
begin
    if not exists (select 1 from admins where user_id = auth.uid()) then
        raise exception 'not admin' using errcode = '42501';
    end if;
end; $$;

-- Global push switches, changed from the admin page.
--   broadcast_push: "new service" pushes that go to everyone
--   all_push:       every push (chat, orders, approvals too) — emergency off switch
create table if not exists public.app_settings (
    id int primary key default 1 check (id = 1),
    broadcast_push boolean not null default true,
    all_push boolean not null default true,
    updated_at timestamptz not null default now()
);
alter table public.app_settings enable row level security;
insert into public.app_settings (id) values (1) on conflict do nothing;

create or replace function public.push_send(p_tokens text[], p_title text, p_body text)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  i int := 1;
  v_messages jsonb;
begin
  if p_tokens is null then return; end if;
  if not coalesce((select all_push from app_settings where id = 1), true) then return; end if;
  while i <= coalesce(array_length(p_tokens, 1), 0) loop
    select jsonb_agg(jsonb_build_object(
             'to', tok, 'title', p_title, 'body', p_body,
             'sound', 'toyolsun.wav', 'channelId', 'toyolsun', 'priority', 'high'))
      into v_messages
    from unnest(p_tokens[i:i + 99]) as tok;
    perform net.http_post(
      url := 'https://exp.host/--/api/v2/push/send',
      body := v_messages,
      headers := '{"Content-Type": "application/json", "Accept": "application/json"}'::jsonb
    );
    i := i + 100;
  end loop;
exception when others then
  raise warning 'push_send failed: %', sqlerrm;
end; $function$;

-- Push trigger: an admin action can ask for silence for its own transaction,
-- and the broadcast part respects app_settings.broadcast_push.
create or replace function public.service_push_trigger()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_category text;
begin
  if coalesce(current_setting('toyolsun.silent_push', true), '') = 'on' then
    return null;
  end if;
  if new.status = 'approved' and old.status is distinct from 'approved' then
    if new.owner_id is not null then
      perform push_send(
        (select array_agg(distinct token) from push_tokens where user_id = new.owner_id),
        '🎉 Xidmətiniz təsdiqləndi',
        coalesce(new.title, 'Xidmətiniz') || ' artıq kataloqda görünür.');
    end if;
    insert into service_push_announced (service_id) values (new.id) on conflict do nothing;
    if found and coalesce((select broadcast_push from app_settings where id = 1), true) then
      v_category := case new.category
        when 'venues' then 'Zallar' when 'artists' then 'Artistlər' when 'dj' then 'DJ'
        when 'media' then 'Foto & Video' when 'cars' then 'VIP Kortej' when 'wedding_dress' then 'Gəlinlik'
        when 'flowers' then 'Gül Dükanı' when 'decor' then 'Dekor' when 'tourism' then 'Bal Ayı' else null end;
      perform push_send(
        (select array_agg(distinct token) from push_tokens where user_id is distinct from new.owner_id),
        '🆕 Yeni partnyor: ' || coalesce(new.title, 'Toy Olsun'),
        coalesce(v_category || ' bölməsində', 'Kataloqda') || ' yeni xidmət əlavə olundu. Baxmaq üçün toxunun.');
    end if;
  end if;
  return null;
exception when others then
  raise warning 'service_push_trigger failed: %', sqlerrm;
  return null;
end; $function$;

-- Services with owner info. p_status: 'pending' | 'approved' | 'rejected' | null (all).
create or replace function public.admin_services(p_status text default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
    perform admin_guard();
    return coalesce((
        select jsonb_agg(to_jsonb(s) || jsonb_build_object(
                   'owner_email', u.email,
                   'owner_name', p.full_name,
                   'hidden_from_stories', exists (select 1 from story_exclusions x where x.service_id = s.id))
               order by s.created_at desc)
        from service s
        left join auth.users u on u.id = s.owner_id
        left join profiles p on p.id = s.owner_id
        where p_status is null or s.status = p_status
    ), '[]'::jsonb);
end; $$;

-- Change status. p_push: 'none' (nobody), 'owner' (only the partner), 'all' (partner + everyone, first time only).
create or replace function public.admin_set_status(p_id bigint, p_status text, p_push text default 'none') returns void
language plpgsql security definer set search_path = public as $$
begin
    perform admin_guard();
    if p_status not in ('pending', 'approved', 'rejected') then raise exception 'bad status'; end if;
    if p_push = 'none' then
        perform set_config('toyolsun.silent_push', 'on', true);
    elsif p_push = 'owner' then
        insert into service_push_announced (service_id) values (p_id) on conflict do nothing;
    end if;
    update service set status = p_status where id = p_id;
end; $$;

-- Edit fields. Only keys present in p_patch change.
create or replace function public.admin_update_service(p_id bigint, p_patch jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
    perform admin_guard();
    perform set_config('toyolsun.silent_push', 'on', true);
    update service set
        title       = case when p_patch ? 'title'       then p_patch->>'title'               else title end,
        price       = case when p_patch ? 'price'       then (p_patch->>'price')::bigint     else price end,
        unit        = case when p_patch ? 'unit'        then p_patch->>'unit'                else unit end,
        rating      = case when p_patch ? 'rating'      then p_patch->>'rating'              else rating end,
        category    = case when p_patch ? 'category'    then p_patch->>'category'            else category end,
        phone       = case when p_patch ? 'phone'       then p_patch->>'phone'               else phone end,
        address     = case when p_patch ? 'address'     then p_patch->>'address'             else address end,
        capacity    = case when p_patch ? 'capacity'    then p_patch->>'capacity'            else capacity end,
        description = case when p_patch ? 'description' then p_patch->>'description'         else description end
    where id = p_id;
end; $$;

create or replace function public.admin_delete_service(p_id bigint) returns void
language plpgsql security definer set search_path = public as $$
begin
    perform admin_guard();
    delete from service where id = p_id;
end; $$;

create or replace function public.admin_set_story_hidden(p_id bigint, p_hidden boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
    perform admin_guard();
    if p_hidden then
        insert into story_exclusions (service_id) values (p_id) on conflict do nothing;
    else
        delete from story_exclusions where service_id = p_id;
    end if;
end; $$;

-- Recent sign-ups (last p_days days, Baku time).
create or replace function public.admin_users(p_days int default 1) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
    perform admin_guard();
    return coalesce((
        select jsonb_agg(jsonb_build_object(
                   'created_at', u.created_at,
                   'email', u.email,
                   'provider', u.raw_app_meta_data->>'provider',
                   'role', p.role,
                   'name', p.full_name,
                   'confirmed', u.email_confirmed_at is not null,
                   'platform', (select string_agg(distinct t.platform, ',') from push_tokens t where t.user_id = u.id),
                   'services', (select count(*) from service s where s.owner_id = u.id))
               order by u.created_at desc)
        from auth.users u
        left join profiles p on p.id = u.id
        where (u.created_at at time zone 'Asia/Baku')::date > (now() at time zone 'Asia/Baku')::date - p_days
    ), '[]'::jsonb);
end; $$;

create or replace function public.admin_stats() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare today date := (now() at time zone 'Asia/Baku')::date;
begin
    perform admin_guard();
    return jsonb_build_object(
        'pending',     (select count(*) from service where status = 'pending'),
        'approved',    (select count(*) from service where status = 'approved'),
        'customers',   (select count(*) from profiles where role = 'customer'),
        'partners',    (select count(*) from profiles where role = 'partner'),
        'signups_today', (select count(*) from auth.users where (created_at at time zone 'Asia/Baku')::date = today),
        'signups_7d',  (select count(*) from auth.users where created_at > now() - interval '7 days'),
        'devices',     (select count(distinct token) from push_tokens),
        'unconfirmed', (select count(*) from auth.users u where not exists (select 1 from profiles p where p.id = u.id))
    );
end; $$;

create or replace function public.admin_get_settings() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
    perform admin_guard();
    return (select to_jsonb(s) from app_settings s where id = 1);
end; $$;

-- p_key: 'broadcast_push' | 'all_push'
create or replace function public.admin_set_setting(p_key text, p_value boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
    perform admin_guard();
    if p_key = 'broadcast_push' then
        update app_settings set broadcast_push = p_value, updated_at = now() where id = 1;
    elsif p_key = 'all_push' then
        update app_settings set all_push = p_value, updated_at = now() where id = 1;
    else
        raise exception 'bad key';
    end if;
end; $$;

-- Only signed-in users may call these (each still checks admin itself).
revoke all on function public.admin_guard(), public.admin_services(text), public.admin_set_status(bigint, text, text),
    public.admin_update_service(bigint, jsonb), public.admin_delete_service(bigint),
    public.admin_set_story_hidden(bigint, boolean), public.admin_users(int), public.admin_stats(), public.is_admin(),
    public.admin_get_settings(), public.admin_set_setting(text, boolean)
    from public, anon;
grant execute on function public.admin_services(text), public.admin_set_status(bigint, text, text),
    public.admin_update_service(bigint, jsonb), public.admin_delete_service(bigint),
    public.admin_set_story_hidden(bigint, boolean), public.admin_users(int), public.admin_stats(), public.is_admin(),
    public.admin_get_settings(), public.admin_set_setting(text, boolean)
    to authenticated;
