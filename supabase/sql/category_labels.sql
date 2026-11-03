-- Adds the DJ and Dekor categories to the "Yeni partnyor" announcement text.
-- Apply together with the 1.1.7 release (until then an unknown category just
-- says "Kataloqda", so nothing breaks).
-- Roll back: re-run service_push_trigger from auto_push_notifications.sql.

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
        when 'dj' then 'DJ'
        when 'media' then 'Foto & Video'
        when 'cars' then 'VIP Kortej'
        when 'wedding_dress' then 'Gəlinlik'
        when 'flowers' then 'Gül Dükanı'
        when 'decor' then 'Dekor'
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

revoke all on function public.service_push_trigger() from public, anon, authenticated;
