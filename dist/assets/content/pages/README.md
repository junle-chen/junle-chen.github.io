# Junle Chen HomePage Guide

This page documents the current website, not the old template that originally seeded parts of the codebase.

## What This Site Contains

- `Notes`: long-form Markdown notes opened inside the site reader.
- `Memos`: short owner-editable updates backed by Supabase realtime state.
- `Daily Paper`: daily arXiv-based paper recommendations and reading notes.
- `Paper List`: Zotero/exported paper records with search and filters.
- `Academic`: page-local navigation for paper views.
- `Giscus`: article comments through GitHub Discussions.

## Configure The Homepage

Edit `config.json`:

- `head.title`: browser title.
- `head.description`: SEO description.
- `intro.title`: first-screen project title.
- `intro.subtitle`: first-screen subtitle.
- `intro.background`: WebGL fluid background on/off.
- `intro.supportAuthor`: support-author corner/log switch.
- `main.name`: displayed profile name.
- `main.signature`: short description under the name.
- `main.ul`: homepage link buttons.

## Configure Content

- Add notes in `src/assets/content/notes/`.
- Add internal pages in `src/assets/content/pages/`.
- Update homepage indexes in `src/data/homepage-content.json` and `src/assets/content/homepage-content.json`.
- Update daily paper data in `src/assets/content/data/daily-papers.json`.
- Update Zotero/paper-list data in `src/assets/content/data/zotero-paper-list.json`.

## Configure Realtime

Run `supabase/homepage-realtime.sql` in Supabase, enable GitHub Auth, and then edit `src/js/realtime-config.js`:

```js
window.JUNLE_REALTIME_CONFIG = {
	supabaseUrl: "https://<project-ref>.supabase.co",
	supabaseAnonKey: "<publishable-anon-key>",
	ownerGithubIds: ["108796659"],
	ownerGithubLogins: ["junle-chen"],
	redirectTo: window.location.origin + window.location.pathname,
};
```

The anon key is public. OAuth client secrets must stay in Supabase/GitHub settings, not in this repository.

## Configure Comments

Giscus is configured in `src/js/main.js` through `GISCUS_CONFIG`. The repository must have GitHub Discussions enabled and the Giscus GitHub App installed.

## Build And Deploy

```bash
npm install
npm run build
npm run dev
```

The generated site is in `dist/`. Commit and push changes to `master` in `junle-chen.github.io`; GitHub Actions builds and deploys that repository. The primary build must not contain a `CNAME` file. The separate `ac-homepage/gh-pages` deployment serves the `junle.cc` HTTPS redirect.

## Citation And References

Use the repository `CITATION.cff` file or GitHub's "Cite this repository" button to cite this website project.

External services and upstream references are listed in the repository-level `ATTRIBUTION.md`, including GitHub Pages, Supabase, Giscus, arXiv, Zotero, WebGL Fluid Simulation, MathJax, anime.js, jsDelivr, Alibaba Iconfont, SimonAKing/HomePage, and migrated Beautiful Jekyll assets.
