# Contributing

This repository is the source of [junle-chen.github.io](https://junle-chen.github.io/).
Use this repository for website fixes and Daily Paper corrections; the older
`ac-homepage` repository is not the editing source. Pushing a reviewed change to
`master` triggers the GitHub Pages build and deployment.

Private Saved Blogs entries belong in the Supabase table, not in Git, public
JSON, issues, or pull requests. The frontend and SQL policies may be reviewed
here, but do not commit anyone's private collection data. New URL-only entries
use the `待整理` category as the daily curation queue; a manually chosen
category is outside that queue.

For Daily Paper additions, include only papers strongly related to long-horizon
agents, multi-turn interaction, agent planning, agent memory, or agentic RL.
Check the paper text before making claims about methods or results, keep the card
summary short, and describe evidence and limitations in the details. Build the
site and confirm that `src/assets/content/data/daily-papers.json` matches the
generated `dist/assets/content/data/daily-papers.json` before publishing.

The prior Academic Pages site is preserved under `archive/academic-pages/`.
The previous default-branch commit history is preserved on
[`archive/master-history-before-cleanup`](https://github.com/junle-chen/junle-chen.github.io/tree/archive/master-history-before-cleanup).
Keep both archives intact. The `junle.cc` redirect is served by the separate
`ac-homepage/gh-pages` branch.
