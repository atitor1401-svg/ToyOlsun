-- Account deletion failed with "violates foreign key constraint":
-- some tables pointed at the user (or their services) without ON DELETE,
-- so Postgres refused to delete a user who had orders, reviews or likes.
-- Now everything that belongs to a user (or to a deleted service) goes with it.

alter table public.orders drop constraint if exists orders_customer_id_fkey;
alter table public.orders add constraint orders_customer_id_fkey
    foreign key (customer_id) references auth.users(id) on delete cascade;

alter table public.customer_reviews drop constraint if exists customer_reviews_customer_id_fkey;
alter table public.customer_reviews add constraint customer_reviews_customer_id_fkey
    foreign key (customer_id) references auth.users(id) on delete cascade;

alter table public.review_likes drop constraint if exists review_likes_customer_id_fkey;
alter table public.review_likes add constraint review_likes_customer_id_fkey
    foreign key (customer_id) references auth.users(id) on delete cascade;

alter table public.service drop constraint if exists service_owner_id_fkey;
alter table public.service add constraint service_owner_id_fkey
    foreign key (owner_id) references auth.users(id) on delete cascade;

-- Partner deletion: their services are removed, so reviews of those services go too.
alter table public.reviews drop constraint if exists reviews_service_id_fkey;
alter table public.reviews add constraint reviews_service_id_fkey
    foreign key (service_id) references public.service(id) on delete cascade;

alter table public.customer_reviews drop constraint if exists customer_reviews_service_id_fkey;
alter table public.customer_reviews add constraint customer_reviews_service_id_fkey
    foreign key (service_id) references public.service(id) on delete cascade;
