# Memo Auth Guide

This page used to describe storing a GitHub personal access token in browser `localStorage`.

That flow is now deprecated for this site. Browser-stored repository tokens are too powerful for a public static page.

Use the new Supabase-backed GitHub login instead:

1. Run `supabase/homepage-realtime.sql` in Supabase.
2. Enable GitHub Auth in Supabase.
3. Fill `src/js/realtime-config.js` with the public Supabase URL, public anon key, and your GitHub owner id/login.
4. Build and deploy the site.

See `src/assets/content/pages/REALTIME_SETUP.md` for the full setup.
