-- Automatic push notifications, sent from the database via Expo's push API.
--   * new order                 -> the partner who owns the service
--   * order becomes "contacted" -> the customer (in the language they ordered in)
--   * admin approves a service  -> the partner ("your service is live")
--                                  + everyone else ("new partner joined"), once per service
-- Every trigger swallows its own errors, so a failed push can never block an
-- order or a service save. pg_net sends the requests after the transaction
-- commits, so it never slows the app down.
--
-- Roll back: run supabase/sql/auto_push_notifications_rollback.sql

-- Remembers which services were already announced to everyone, so editing
-- and re-approving a service never sends a second "new partner" push.
create table if not exists public.service_push_announced (
  service_id bigint primary key,
  announced_at timestamptz not null default now()
);
alter table public.service_push_announced enable row level security;
revoke all on public.service_push_announced from anon, authenticated;
-- Services approved before this feature existed count as already announced.
insert into public.service_push_announced (service_id)
select id from public.service where status = 'approved'
on conflict do nothing;

-- Sends one push to the given tokens, in Expo-sized batches of 100.
create or replace function public.push_send(p_tokens text[], p_title text, p_body text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  i int := 1;
  v_messages jsonb;
begin
  if p_tokens is null then
    return;
  end if;
  while i <= coalesce(array_length(p_tokens, 1), 0) loop
    select jsonb_agg(jsonb_build_object('to', tok, 'title', p_title, 'body', p_body, 'sound', 'default'))
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
end;
$$;

-- Orders: new order -> partner; status becomes 'contacted' -> customer.
create or replace function public.orders_push_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.service_owner_id is not null then
      perform push_send(
        (select array_agg(distinct token) from push_tokens where user_id = new.service_owner_id),
        '🎊 Yeni sifariş!',
        concat_ws(' · ',
          nullif(new.customer_name, ''),
          new.service_title,
          nullif(new.event_date, ''),
          case when new.guests_count is not null then new.guests_count || ' qonaq' end)
      );
    end if;
  elsif tg_op = 'UPDATE'
        and new.status = 'contacted'
        and old.status is distinct from 'contacted'
        and new.customer_id is not null then
    perform push_send(
      (select array_agg(distinct token) from push_tokens where user_id = new.customer_id),
      case new.lang when 'ru' then '✅ Ваша заявка принята'
                    when 'en' then '✅ Your request was accepted'
                    else '✅ Sifarişiniz qəbul olundu' end,
      case new.lang when 'ru' then coalesce(new.service_title, 'Партнёр') || ' скоро свяжется с вами.'
                    when 'en' then coalesce(new.service_title, 'The partner') || ' will contact you soon.'
                    else coalesce(new.service_title, 'Partnyor') || ' tezliklə sizinlə əlaqə saxlayacaq.' end
    );
  end if;
  return null;
exception when others then
  raise warning 'orders_push_trigger failed: %', sqlerrm;
  return null;
end;
$$;

-- Services: first approval -> partner + announcement to everyone else.
create or replace function public.service_push_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_category text;
begin
  if new.status = 'approved' and old.status is distinct from 'approved' then
    if new.owner_id is not null then
      perform push_send(
        (select array_agg(distinct token) from push_tokens where user_id = new.owner_id),
        '🎉 Xidmətiniz təsdiqləndi',
        coalesce(new.title, 'Xidmətiniz') || ' artıq kataloqda görünür.'
      );
    end if;

    insert into service_push_announced (service_id) values (new.id)
    on conflict do nothing;
    if found then
      v_category := case new.category
        when 'venues' then 'Zallar'
        when 'artists' then 'Artistlər'
        when 'media' then 'Foto & Video'
        when 'cars' then 'VIP Kortej'
        when 'wedding_dress' then 'Gəlinlik'
        when 'flowers' then 'Gül Dükanı'
        when 'tourism' then 'Bal Ayı'
        else null end;
      perform push_send(
        (select array_agg(distinct token) from push_tokens
          where user_id is distinct from new.owner_id),
        '🆕 Yeni partnyor: ' || coalesce(new.title, 'Toy Olsun'),
        coalesce(v_category || ' bölməsində', 'Kataloqda') || ' yeni xidmət əlavə olundu. Baxmaq üçün toxunun.'
      );
    end if;
  end if;
  return null;
exception when others then
  raise warning 'service_push_trigger failed: %', sqlerrm;
  return null;
end;
$$;

-- Nobody can call these from the app (RPC); only the triggers use them.
revoke all on function public.push_send(text[], text, text) from public, anon, authenticated;
revoke all on function public.orders_push_trigger() from public, anon, authenticated;
revoke all on function public.service_push_trigger() from public, anon, authenticated;

drop trigger if exists orders_push on public.orders;
create trigger orders_push
  after insert or update of status on public.orders
  for each row execute function public.orders_push_trigger();

drop trigger if exists service_push on public.service;
create trigger service_push
  after update of status on public.service
  for each row execute function public.service_push_trigger();
