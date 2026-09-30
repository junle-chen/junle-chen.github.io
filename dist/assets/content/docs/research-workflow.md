# Research Website Workflow

This site is a static Jekyll site. Zotero, Obsidian, Codex, and GitHub Actions
connect to it by updating files that Jekyll can render.

## Paper Radar

The rendered page is `papers.md`. It reads:

- `_data/papers.json` for paper records.
- `_data/paper_topics.json` for daily arXiv search topics.

Run a daily-style local update:

```bash
python3 scripts/update_papers.py --days-back 3
```

Preview without writing:

```bash
python3 scripts/update_papers.py --days-back 3 --dry-run
```

Backfill more results:

```bash
python3 scripts/update_papers.py --include-all --max-results 20
```

The GitHub Action `.github/workflows/update-papers.yml` runs every day at
09:17 Asia/Hong_Kong and commits only when `_data/papers.json` changes.

## Zotero

Recommended path:

1. Export selected Zotero items as CSL JSON. Better BibTeX works well for this.
2. Merge the export into the paper feed.

```bash
python3 scripts/import_zotero_csl.py ~/Downloads/zotero-export.json --topic "Agent planning"
```

The importer keeps `citation_key`, DOI, URL, abstract, authors, and a
`zotero://select/items/@...` link when a citation key is available.

## Obsidian

This repository already has `.obsidian/` settings, so it can be opened as an
Obsidian vault:

```bash
open -a Obsidian /Users/junle/Code/junle-cc-website
```

Public long-form notes belong in `_posts/` with Jekyll front matter. Images and
attachments should stay under `assets/` so GitHub Pages can serve them.

## Codex

Codex can use the same scripts:

```bash
python3 scripts/update_papers.py --days-back 3
python3 scripts/import_zotero_csl.py path/to/export.json --topic "Agent planning"
```

For a curated daily run, ask Codex to:

1. Inspect `_data/paper_topics.json`.
2. Run `scripts/update_papers.py --dry-run`.
3. Review new paper relevance.
4. Run the script without `--dry-run`.
5. Build the Jekyll site and commit the data update.
