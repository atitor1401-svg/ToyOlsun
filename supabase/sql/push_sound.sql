-- Play the Toy Olsun signature sound on pushes.
-- Apply only AFTER app 1.1.7 (which ships assets/sounds/toyolsun.wav and the
-- Android 'toyolsun' notification channel) is live in both stores.
--   iOS:     sound 'toyolsun.wav' (older builds without the file fall back to
--            the default sound).
--   Android: channelId 'toyolsun' (high importance + the sound).
-- Roll back: re-run the push_send definition in auto_push_notifications.sql.

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
end;
$$;

revoke all on function public.push_send(text[], text, text) from public, anon, authenticated;
