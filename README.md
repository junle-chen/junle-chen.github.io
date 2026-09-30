# ⭐ Academic Homepage Template

> A static academic homepage and research workspace for notes, memos, paper reading, and lightweight realtime interactions.

If you like this template or wish to use it, please consider giving this repository a ⭐ star.

[![GitHub Pages](https://img.shields.io/badge/Deploy-GitHub%20Pages-222?logo=github)](https://pages.github.com/)
[![Supabase](https://img.shields.io/badge/Realtime-Supabase-3FCF8E?logo=supabase&logoColor=white)](https://supabase.com/)
[![Giscus](https://img.shields.io/badge/Comments-Giscus-7C3AED)](https://giscus.app/)
[![License: LGPL-3.0](https://img.shields.io/badge/License-LGPL--3.0-blue.svg)](LICENSE)

- 🌐 Live demo: [https://junle-chen.github.io](https://junle-chen.github.io)
- 🧩 Repository: [junle-chen/junle-chen.github.io](https://github.com/junle-chen/junle-chen.github.io)
- ⭐ Like it? Star the repo and adapt it for your own academic homepage.

## ✨ What You Get

| Area | What it provides |
| --- | --- |
| 👤 `About` | Profile, research interests, selected publications, contact links, and workspace entry points. |
| 📝 `Notes` | In-site Markdown reader with search, categories, archive state, outline, images, and MathJax. |
| 💬 `Memos` | Timeline-style notes with owner-only realtime writes. |
| 📚 `Academic` | Daily Paper, paper list, stars, paper details, reading summaries, and text export. |
| ⚡ `Realtime` | Shared memo, paper-star, Zotero-star, and note-archive state through Supabase. |
| 💭 `Comments` | Giscus comments backed by GitHub Discussions. |
| 🚀 `Deploy` | Static build for GitHub Pages and optional custom domain. |

## 🧭 Template Map

Use this repository as a template if you want:

- a homepage that feels like a working research desk instead of a plain CV page
- long-form notes that render inside the site rather than as raw Markdown
- a paper-reading dashboard for daily arXiv tracking and Zotero exports
- optional realtime state for memos, stars, and archived notes
- optional GitHub Discussions comments for notes
- static hosting without maintaining a backend server

## 🖼️ Screenshots

### 👤 About / Profile

![About view](src/assets/screenshots/homepage-about.png)

The About screen works as the entry point for a compact academic profile, research interests, selected publications, contact links, and quick access to the workspace sections.

### 💬 Memos

![Memos view](src/assets/screenshots/homepage-memos.png)

Memos provide a timeline-style writing area. Public visitors can read published memos, while the configured owner can sign in with GitHub to add or delete memos. Supabase realtime keeps open browser sessions synchronized.

### 📚 Academic

![Academic view](src/assets/screenshots/homepage-academic.png)

The Academic section contains two research-reading views:

- `Daily Paper`: curated arXiv paper tracking with stars, short summaries, long reading notes, and exportable text.
- `Paper List`: a longer-term paper list generated from a Zotero or local library export.

### 📝 Notes Reader

![Notes reader](src/assets/screenshots/homepage-note-reader.png)

Notes open inside the site reader instead of jumping to raw Markdown files. The reader supports rendered Markdown, images, MathJax, a right-side outline, archive state, and Giscus comments.

## ⚡ Quick Start

```bash
npm install
npm run build
npm run dev
```

`npm run build` generates `dist/`. `npm run dev` starts the gulp watcher and previews from `dist`.

If you use pnpm and see `Ignored build scripts`, approve the dependency build scripts as prompted:

```bash
pnpm install
pnpm approve-builds
pnpm run build
pnpm run dev
```

## 🛠️ Make It Yours

Start with these files when turning the template into your own homepage:

| File or folder | What to change |
| --- | --- |
| `config.json` | Page title, description, intro text, avatar, profile links, and WebGL background switch. |
| `src/assets/avatar.png` | Replace with your own avatar. |
| `src/assets/content/pages/aboutme.md` | About page content. |
| `src/assets/content/notes/` | Long-form Markdown notes. |
| `src/assets/content/data/daily-papers.json` | Daily Paper data. |
| `src/assets/content/data/zotero-paper-list.json` | Paper List data. |
| `src/js/realtime-config.js` | Supabase public config and owner GitHub identity. |
| `supabase/homepage-realtime.sql` | Supabase tables, RLS policies, owner checks, and realtime publication. |
| `src/js/main.js` | Giscus config and frontend interaction logic. |

## 🔌 Optional Integrations

| Integration | Required? | Purpose |
| --- | --- | --- |
| Supabase | Optional | Shared realtime memos, paper stars, Zotero stars, and note archive state. |
| GitHub OAuth | Optional | Owner login for write permissions through Supabase Auth. |
| Giscus | Optional | GitHub Discussions comments for notes. |
| GitHub Pages | Recommended | Static hosting and custom domain deployment. |
| Zotero export | Optional | Populate the long-term Paper List view. |

## 🧱 Realtime Architecture

The site is statically hosted. Dynamic state is handled by Supabase Auth, Supabase Postgres, and Supabase Realtime:

```mermaid
flowchart LR
  Browser["Browser UI"] --> Store["Realtime store in src/js/main.js"]
  Store --> Auth["Supabase Auth with GitHub OAuth"]
  Store --> DB["Supabase Postgres"]
  DB --> RT["Supabase Realtime postgres_changes"]
  RT --> Store
  Store --> UI["Memos, stars, archive state"]
```

### Frontend Entry Points

| File | Role |
| --- | --- |
| `src/components/scripts.pug` | Loads `@supabase/supabase-js@2`, `js/realtime-config.js`, and `js/main.js`. |
| `src/js/realtime-config.js` | Stores the public Supabase URL, anon key, owner GitHub ids/logins, and OAuth redirect URL. |
| `src/js/main.js` | Creates the realtime store, exposes the frontend realtime API, and updates UI modules through events. |

### Supabase Tables

The full schema is in `supabase/homepage-realtime.sql`.

| Table | Purpose |
| --- | --- |
| `site_memos` | Stores timeline memos with title, content, category, priority, source, owner id, timestamps, and a soft-delete field. |
| `site_reactions` | Stores shared state for `daily_paper`, `zotero_paper`, and `note_archive` items. |

`site_reactions` uses `unique (item_type, item_key)`, so each paper or note has one stable state row.

### Auth And RLS

Supabase uses GitHub OAuth for owner login. The SQL helper `public.is_homepage_owner()` checks GitHub identity values from the Supabase JWT. Configure your own owner ids and logins in both:

- `src/js/realtime-config.js`
- `supabase/homepage-realtime.sql`

The intended Row Level Security behavior is:

- visitors can read published memos and reactions
- only configured owners can insert, update, or delete memos
- only configured owners can insert, update, or delete reactions

The Supabase anon key can be public in frontend code because writes are controlled by Auth and RLS. Keep GitHub OAuth client secrets, deployment tokens, and other private credentials outside the repository.

### Realtime Subscriptions

The frontend subscribes to Supabase `postgres_changes` events:

| Channel target | UI behavior |
| --- | --- |
| `site_memos` | Reloads the memo timeline after insert, update, or delete events. |
| `site_reactions` + `daily_paper` | Syncs Daily Paper stars. |
| `site_reactions` + `zotero_paper` | Syncs Paper List stars. |
| `site_reactions` + `note_archive` | Syncs archived note state. |

When one signed-in owner updates a memo or star, other open browser sessions receive a realtime event and reload the current state.

### Local Fallback

If Supabase is not configured, the network is unavailable, or the visitor is not signed in:

- the static site still loads normally
- public content remains readable
- write actions become read-only or fall back to local `localStorage` state
- the UI can show `Local mode`, `Live read-only`, `Signed in read-only`, or `Live owner`

## 🧩 Configure Supabase

1. Create a Supabase project.
2. Copy the Project URL and publishable anon key.
3. Run `supabase/homepage-realtime.sql` in the Supabase SQL Editor.
4. Enable GitHub in Supabase Authentication Providers.
5. Create a GitHub OAuth App with this callback URL:

```text
https://<project-ref>.supabase.co/auth/v1/callback
```

6. Put the GitHub Client ID and Client Secret into the Supabase GitHub provider settings.
7. Update `src/js/realtime-config.js`:

```js
window.JUNLE_REALTIME_CONFIG = {
	supabaseUrl: "https://<project-ref>.supabase.co",
	supabaseAnonKey: "<publishable-anon-key>",
	ownerGithubIds: ["<github-numeric-id>"],
	ownerGithubLogins: ["<github-login>"],
	redirectTo: window.location.origin + window.location.pathname,
};
```

8. Update the allowed owner ids/logins in `supabase/homepage-realtime.sql` before running it.

## 💭 Configure Giscus

Giscus uses GitHub Discussions as the comment backend. The config lives in `GISCUS_CONFIG` inside `src/js/main.js`.

Required setup:

1. Enable GitHub Discussions for your repository.
2. Install and authorize the Giscus GitHub App for your repository.
3. Use [giscus.app](https://giscus.app/) to generate:
   - `data-repo`
   - `data-repo-id`
   - `data-category`
   - `data-category-id`
4. Paste those values into `GISCUS_CONFIG`.

Each note uses its own `data-comment-term`, so every note gets a separate discussion thread.
The current site keeps its existing Giscus discussions in `junle-chen/ac-homepage` so
existing comment threads remain available; changing that backend is a separate migration.

## 🚀 Deploy

This repository is the primary source for [https://junle-chen.github.io](https://junle-chen.github.io).
Its [GitHub Actions workflow](.github/workflows/publish-site.yml) builds this repository's
`master` branch and publishes `dist/` directly to the root GitHub Pages URL.
The former Academic Pages website is preserved under [archive/academic-pages](archive/academic-pages/)
and is not included in the deployed artifact.

```bash
npm run build
# Commit and push the intended website changes to master to publish them.
```

The workflow rebuilds from committed source after each push to `master` and records the
deployed commit in `deployment-source.json`. Keep Daily Paper source and generated `dist`
data consistent before committing; the Daily Paper automation now runs from this repository.
Local uncommitted files are not included in the deployment.

The GitHub root website must have no custom domain configured, and `dist/CNAME` must not exist.
The former [ac-homepage](https://github.com/junle-chen/ac-homepage) repository retains only
the `junle.cc` GitHub Pages redirect on its `gh-pages` branch. Do not publish this site's
full `dist/` to that branch: it would replace the redirect.

Supabase Authentication URL Configuration:

- Site URL: `https://junle-chen.github.io`
- Redirect URL: `https://junle-chen.github.io/`

## 📁 Project Structure

| Path | Description |
| --- | --- |
| `config.json` | Homepage config and profile links. |
| `src/components/` | Pug templates. |
| `src/css/` | LESS styles. |
| `src/js/main.js` | Page interactions, note reader, Giscus, and realtime store. |
| `src/js/realtime-config.js` | Public Supabase config. |
| `src/assets/content/notes/` | Long-form Markdown notes. |
| `src/assets/content/pages/` | In-site Markdown pages. |
| `src/assets/content/data/daily-papers.json` | Daily Paper data. |
| `src/assets/content/data/zotero-paper-list.json` | Paper List data. |
| `supabase/homepage-realtime.sql` | Supabase schema, RLS policies, and realtime publication. |
| `dist/` | Generated static site. |

## 🌐 Websites And Services Used

| Website or project | Use |
| --- | --- |
| [GitHub Pages](https://pages.github.com/) | Static hosting and custom domain deployment. |
| [GitHub](https://github.com/) | Source hosting, Discussions, and OAuth App setup. |
| [Giscus](https://giscus.app/) | Comment widget powered by GitHub Discussions. |
| [Supabase](https://supabase.com/) | Realtime database, Auth, and owner-only writes. |
| [arXiv](https://arxiv.org/) | Paper metadata and paper links for Daily Paper and Paper List content. |
| [Zotero](https://www.zotero.org/) | Local paper-library export source. |
| [jsDelivr](https://www.jsdelivr.com/) | Runtime CDN for frontend libraries. |
| [Shields.io](https://shields.io/) | README badges. |
| [anime.js](https://animejs.com/) | Animation timing and transitions. |
| [MathJax](https://www.mathjax.org/) | LaTeX rendering for notes and paper details. |
| [Supabase JS](https://supabase.com/docs/reference/javascript/introduction) | Browser client for Auth and Realtime. |
| [Alibaba Iconfont](https://www.iconfont.cn/) | Icon font for link buttons. |
| [SimonAKing/HomePage](https://github.com/SimonAKing/HomePage) | Original homepage structure and intro style. |
| [WebGL Fluid Simulation](https://github.com/PavelDoGreat/WebGL-Fluid-Simulation/) | WebGL fluid background implementation. |
| [Beautiful Jekyll](https://github.com/daattali/beautiful-jekyll) | Historical imported notes-site assets. |
| [bootstrap-social](https://github.com/lipis/bootstrap-social) | Historical imported social-button CSS asset. |

## 📄 License And Attribution

The reusable website source code keeps the upstream `LGPL-3.0-only` license from [SimonAKing/HomePage](https://github.com/SimonAKing/HomePage). Keep `LICENSE`, `NOTICE.md`, and `ATTRIBUTION.md` when redistributing the code.
