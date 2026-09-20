-- Promo code feature (additive only; safe for older app versions).

alter table public.service add column if not exists promo_active boolean not null default false;
alter table public.orders  add column if not exists promo_code text;
alter table public.orders  add column if not exists discount_percent integer not null default 0;

create table if not exists public.promo_codes (
  code       text primary key,
  percent    integer not null check (percent between 1 and 90),
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

-- RLS on with NO policies: the app can never list or read the codes table.
alter table public.promo_codes enable row level security;
revoke all on public.promo_codes from anon, authenticated;

insert into public.promo_codes (code, percent) values ('TOY24', 5)
  on conflict (code) do nothing;

-- Only way for the app to check a code: returns the discount percent, or 0.
create or replace function public.validate_promo(p_code text)
returns integer
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    (select percent from public.promo_codes
      where upper(code) = upper(trim(p_code)) and active limit 1),
    0);
$$;

revoke all on function public.validate_promo(text) from public;
grant execute on function public.validate_promo(text) to anon, authenticated, service_role;
