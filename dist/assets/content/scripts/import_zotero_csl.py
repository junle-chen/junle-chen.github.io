#!/usr/bin/env python3
"""Merge a Zotero or Better BibTeX CSL JSON export into _data/papers.json."""

from __future__ import annotations

import argparse
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_PAPERS = ROOT / "_data" / "papers.json"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Import Zotero CSL JSON into the site paper feed.")
    parser.add_argument("csl_json", type=Path, help="CSL JSON file exported from Zotero or Better BibTeX.")
    parser.add_argument("--papers-file", type=Path, default=DEFAULT_PAPERS)
    parser.add_argument("--topic", default="Zotero")
    parser.add_argument("--dry-run", action="store_true")
    return parser.parse_args()


def load_json(path: Path, fallback: Any) -> Any:
    if not path.exists():
        return fallback
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def save_json(path: Path, data: Any) -> None:
    tmp = path.with_suffix(path.suffix + ".tmp")
    with tmp.open("w", encoding="utf-8") as handle:
        json.dump(data, handle, ensure_ascii=False, indent=2)
        handle.write("\n")
    tmp.replace(path)


def compact_text(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def canonical_title(title: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", title.lower()).strip()


def slug(value: str) -> str:
    cleaned = re.sub(r"[^a-zA-Z0-9_.-]+", "-", value).strip("-")
    return cleaned[:90] or "item"


def person_name(person: dict[str, Any]) -> str:
    if person.get("literal"):
        return compact_text(person["literal"])
    parts = [compact_text(person.get("given")), compact_text(person.get("family"))]
    return " ".join(part for part in parts if part)


def csl_date(item: dict[str, Any]) -> str:
    for field in ("issued", "published", "accessed"):
        date_parts = item.get(field, {}).get("date-parts") if isinstance(item.get(field), dict) else None
        if not date_parts:
            continue
        parts = date_parts[0]
        if not parts:
            continue
        year = int(parts[0])
        month = int(parts[1]) if len(parts) > 1 else 1
        day = int(parts[2]) if len(parts) > 2 else 1
        return f"{year:04d}-{month:02d}-{day:02d}"
    return ""


def keyword_tags(item: dict[str, Any]) -> list[str]:
    raw = item.get("keyword") or item.get("keywords") or []
    if isinstance(raw, str):
        tags = re.split(r"[,;]", raw)
    elif isinstance(raw, list):
        tags = [str(value) for value in raw]
    else:
        tags = []
    return [compact_text(tag) for tag in tags if compact_text(tag)]


def to_paper(item: dict[str, Any], topic: str) -> dict[str, Any]:
    citation_key = compact_text(item.get("citation-key") or item.get("id"))
    doi = compact_text(item.get("DOI") or item.get("doi"))
    url = compact_text(item.get("URL") or item.get("url"))
    if doi and not url:
        url = f"https://doi.org/{doi}"

    date_value = csl_date(item)
    authors = [person_name(person) for person in item.get("author", []) if person_name(person)]
    tags = keyword_tags(item)
    title = compact_text(item.get("title"))
    source_id = slug(citation_key or doi or canonical_title(title))

    return {
        "id": f"zotero-{source_id}",
        "citation_key": citation_key,
        "doi": doi,
        "title": title,
        "authors": authors,
        "date": date_value,
        "updated": datetime.now(timezone.utc).date().isoformat(),
        "topic": topic,
        "tags": tags,
        "summary": compact_text(item.get("abstract") or item.get("abstract-note")),
        "source": "Zotero",
        "status": compact_text(item.get("type") or "library item"),
        "url": url,
        "pdf_url": "",
        "code_url": "",
        "note_url": "",
        "zotero_url": f"zotero://select/items/@{citation_key}" if citation_key else "",
        "added_at": datetime.now(timezone.utc).date().isoformat(),
    }


def paper_key(item: dict[str, Any]) -> str:
    for field in ("doi", "citation_key", "arxiv_id", "id"):
        if item.get(field):
            return str(item[field]).lower()
    return canonical_title(str(item.get("title", "")))


def main() -> int:
    args = parse_args()
    csl = load_json(args.csl_json, [])
    if isinstance(csl, dict):
        csl_items = csl.get("items", [])
    else:
        csl_items = csl

    papers = load_json(args.papers_file, {"updated_at": "", "topics": [], "items": []})
    existing = list(papers.get("items", []))
    index = {paper_key(item): pos for pos, item in enumerate(existing)}
    changed = 0

    for item in csl_items:
        paper = to_paper(item, args.topic)
        if not paper["title"]:
            continue
        key = paper_key(paper)
        if key in index:
            existing[index[key]].update({k: v for k, v in paper.items() if v not in ("", [], None)})
        else:
            index[key] = len(existing)
            existing.append(paper)
        changed += 1

    if changed == 0:
        print("No Zotero items imported.")
        return 0

    existing.sort(key=lambda item: (str(item.get("date") or ""), str(item.get("title") or "")), reverse=True)
    papers["items"] = existing
    papers["updated_at"] = datetime.now(timezone.utc).date().isoformat()
    papers["topics"] = sorted(set(papers.get("topics", []) + [args.topic]))

    print(f"Imported or updated {changed} Zotero item(s).")
    if args.dry_run:
        print("Dry run: not writing _data/papers.json.")
        return 0
    save_json(args.papers_file, papers)
    print(f"Updated {args.papers_file}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
