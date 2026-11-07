-- Welcome-screen cover photos managed by the team.
-- Adds the 'cover' style to app_announcements: one row per event,
-- action_value = 'wedding' | 'khyna' | 'birthday', image_url = the photo.
-- Older app versions only read 'popup' and 'strip' rows, so they ignore these.
alter table public.app_announcements drop constraint app_announcements_style_check;
alter table public.app_announcements add constraint app_announcements_style_check
    check (style = any (array['popup'::text, 'strip'::text, 'cover'::text]));
