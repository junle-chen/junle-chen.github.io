# Contributing

This repository is the source of [junle-chen.github.io](https://junle-chen.github.io/).
Use this repository for website fixes and Daily Paper corrections; the older
`ac-homepage` repository is not the editing source. Pushing a reviewed change to
`master` triggers the GitHub Pages build and deployment.

For Daily Paper additions, include only papers strongly related to long-horizon
agents, multi-turn interaction, agent planning, agent memory, or agentic RL.
Check the paper text before making claims about methods or results, keep the card
summary short, and describe evidence and limitations in the details. Build the
site and confirm that `src/assets/content/data/daily-papers.json` matches the
generated `dist/assets/content/data/daily-papers.json` before publishing.

The prior Academic Pages site is preserved under `archive/academic-pages/`.
Keep its files and Git history intact. The `junle.cc` redirect is served by the
separate `ac-homepage/gh-pages` branch.
