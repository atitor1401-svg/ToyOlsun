-- Undo supabase/sql/auto_push_notifications.sql (turns automatic pushes off).
drop trigger if exists orders_push on public.orders;
drop trigger if exists service_push on public.service;
drop function if exists public.orders_push_trigger();
drop function if exists public.service_push_trigger();
drop function if exists public.push_send(text[], text, text);
drop table if exists public.service_push_announced;
