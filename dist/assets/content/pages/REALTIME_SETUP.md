# HomePage Realtime Setup

This site supports GitHub sign-in, live memos, shared paper stars, shared note archive state, and private Saved Blogs through Supabase.

## 1. Create the Supabase project

Create a Supabase project and copy:

- Project URL
- Publishable anon key

The anon key is public by design. Do not put the GitHub OAuth client secret in this repository.

## 2. Run the database SQL

Open Supabase SQL Editor and run:

```sql
-- supabase/homepage-realtime.sql
-- supabase/blog-bookmarks.sql (run second)
```

The SQL is already configured for:

- GitHub login: `junle-chen`
- Supabase Auth user id: `9cbda636-f280-4cff-af6c-408e6dd4e59a`

The SQL enables RLS so everyone can read public live state, but only the owner's Supabase Auth user ID can write. Saved Blogs are readable and editable only by that owner; anonymous users have no table grant.

If the SQL fails only around `alter publication supabase_realtime`, the tables and RLS may already be created. Rerun the updated SQL in this repo; if Supabase still blocks that final publication step, enable Realtime for `site_memos` and `site_reactions` from the Supabase dashboard UI.

## 3. Enable GitHub Auth

In GitHub Developer Settings, create an OAuth App.

Use Supabase's callback URL:

```text
https://<project-ref>.supabase.co/auth/v1/callback
```

Then paste the GitHub Client ID and Client Secret into Supabase Authentication Providers -> GitHub.

## 4. Configure the website

Edit `src/js/realtime-config.js`:

```js
window.JUNLE_REALTIME_CONFIG = {
	supabaseUrl: "https://<project-ref>.supabase.co",
	supabaseAnonKey: "<publishable-anon-key>",
	ownerGithubIds: ["108796659"],
	ownerGithubLogins: ["junle-chen"],
	ownerSupabaseUserIds: ["9cbda636-f280-4cff-af6c-408e6dd4e59a"],
	redirectTo: window.location.origin + window.location.pathname,
};
```

The site owner ID must match both SQL files and the `blog-metadata` Edge Function. Deploy that function with JWT verification enabled to import webpage titles and summaries. If metadata access fails, fill those fields manually.

## 5. Build and deploy

```bash
npm run build
```

After deployment:

- Visitors see live memos, stars, and archives.
- You click `GitHub` in Memo, sign in, and get owner write controls.
- New memos, Paper stars, and Blog archives update live across open browsers.
