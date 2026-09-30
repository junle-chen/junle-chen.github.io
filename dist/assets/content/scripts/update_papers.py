#!/usr/bin/env python3
"""Update _data/papers.json from arXiv topic queries.

The script is dependency-free so it can run in GitHub Actions, local shells,
or Codex automations. It appends only new papers by default.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import time
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_TOPICS = ROOT / "_data" / "paper_topics.json"
DEFAULT_PAPERS = ROOT / "_data" / "papers.json"
ARXIV_API = "https://export.arxiv.org/api/query"
ATOM = "{http://www.w3.org/2005/Atom}"
ARXIV = "{http://arxiv.org/schemas/atom}"
VERSION_SUFFIX = re.compile(r"v\d+$")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Append new arXiv papers to Jekyll data.")
    parser.add_argument("--topics-file", type=Path, default=DEFAULT_TOPICS)
    parser.add_argument("--papers-file", type=Path, default=DEFAULT_PAPERS)
    parser.add_argument("--days-back", type=int, default=None)
    parser.add_argument("--max-results", type=int, default=None)
    parser.add_argument("--include-all", action="store_true", help="Ignore the date cutoff.")
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


def compact_text(value: str | None) -> str:
    return re.sub(r"\s+", " ", value or "").strip()


def parse_datetime(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        try:
            return datetime.strptime(value[:10], "%Y-%m-%d").replace(tzinfo=timezone.utc)
        except ValueError:
            return None


def canonical_title(title: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", title.lower()).strip()


def stable_arxiv_id(id_url: str) -> str:
    tail = id_url.rstrip("/").split("/")[-1]
    return VERSION_SUFFIX.sub("", tail)


def query_arxiv(search_query: str, max_results: int) -> list[ET.Element]:
    params = {
        "search_query": search_query,
        "start": 0,
        "max_results": max_results,
        "sortBy": "lastUpdatedDate",
        "sortOrder": "descending",
    }
    url = f"{ARXIV_API}?{urllib.parse.urlencode(params)}"
    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": "junle-cc-website-paper-radar/1.0 (GitHub Pages research feed)"
        },
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        payload = response.read()
    root = ET.fromstring(payload)
    return root.findall(f"{ATOM}entry")


def entry_to_paper(entry: ET.Element, topic: dict[str, Any]) -> dict[str, Any]:
    id_url = compact_text(entry.findtext(f"{ATOM}id")).replace("http://", "https://")
    title = compact_text(entry.findtext(f"{ATOM}title"))
    summary = compact_text(entry.findtext(f"{ATOM}summary"))
    published = parse_datetime(entry.findtext(f"{ATOM}published"))
    updated = parse_datetime(entry.findtext(f"{ATOM}updated"))
    authors = [
        compact_text(author.findtext(f"{ATOM}name"))
        for author in entry.findall(f"{ATOM}author")
        if compact_text(author.findtext(f"{ATOM}name"))
    ]

    pdf_url = ""
    for link in entry.findall(f"{ATOM}link"):
        attrs = link.attrib
        if attrs.get("title") == "pdf" or attrs.get("type") == "application/pdf":
            pdf_url = attrs.get("href", "").replace("http://", "https://")
            break

    primary = entry.find(f"{ARXIV}primary_category")
    primary_category = primary.attrib.get("term", "") if primary is not None else ""
    categories = [
        category.attrib.get("term", "")
        for category in entry.findall(f"{ATOM}category")
        if category.attrib.get("term")
    ]
    arxiv_id = stable_arxiv_id(id_url)
    date_value = (published or updated or datetime.now(timezone.utc)).date().isoformat()
    updated_value = (updated or published or datetime.now(timezone.utc)).date().isoformat()

    return {
        "id": f"arxiv-{arxiv_id}",
        "arxiv_id": arxiv_id,
        "title": title,
        "authors": authors,
        "date": date_value,
        "updated": updated_value,
        "topic": topic.get("name", "arXiv"),
        "tags": topic.get("tags", []) + categories[:3],
        "summary": summary[:700],
        "source": "arXiv",
        "status": "preprint",
        "url": id_url,
        "pdf_url": pdf_url,
        "code_url": "",
        "note_url": "",
        "zotero_url": "",
        "primary_category": primary_category,
        "added_at": datetime.now(timezone.utc).date().isoformat(),
    }


def existing_keys(items: list[dict[str, Any]]) -> tuple[set[str], set[str]]:
    ids: set[str] = set()
    titles: set[str] = set()
    for item in items:
        if item.get("arxiv_id"):
            ids.add(str(item["arxiv_id"]).lower())
        if item.get("id"):
            ids.add(str(item["id"]).lower().replace("arxiv-", ""))
        if item.get("doi"):
            ids.add(str(item["doi"]).lower())
        if item.get("title"):
            titles.add(canonical_title(str(item["title"])))
    return ids, titles


def sort_key(item: dict[str, Any]) -> tuple[str, str]:
    return (str(item.get("date") or ""), str(item.get("title") or ""))


def main() -> int:
    args = parse_args()
    topics = load_json(args.topics_file, {"queries": []})
    papers = load_json(args.papers_file, {"updated_at": "", "topics": [], "items": []})
    items = list(papers.get("items", []))
    seen_ids, seen_titles = existing_keys(items)

    days_back = args.days_back if args.days_back is not None else int(topics.get("days_back", 3))
    max_results = args.max_results if args.max_results is not None else int(topics.get("max_results_per_query", 8))
    cutoff = datetime.now(timezone.utc) - timedelta(days=days_back)
    new_items: list[dict[str, Any]] = []
    successful_queries = 0

    for index, topic in enumerate(topics.get("queries", [])):
        if index > 0:
            time.sleep(3)
        name = topic.get("name", "unnamed topic")
        query = topic.get("query")
        if not query:
            print(f"Skipping {name}: missing query", file=sys.stderr)
            continue

        try:
            entries = query_arxiv(query, max_results)
            successful_queries += 1
        except Exception as exc:  # noqa: BLE001 - keep action logs useful.
            print(f"Failed to query {name}: {exc}", file=sys.stderr)
            continue

        for entry in entries:
            paper = entry_to_paper(entry, topic)
            arxiv_id = str(paper.get("arxiv_id", "")).lower()
            title_key = canonical_title(str(paper.get("title", "")))
            updated = parse_datetime(str(paper.get("updated", "")))
            published = parse_datetime(str(paper.get("date", "")))
            is_recent = args.include_all or any(dt and dt >= cutoff for dt in (updated, published))

            if not is_recent:
                continue
            if arxiv_id in seen_ids or title_key in seen_titles:
                continue

            seen_ids.add(arxiv_id)
            seen_titles.add(title_key)
            new_items.append(paper)

    if successful_queries == 0 and topics.get("queries"):
        print("No arXiv queries succeeded.", file=sys.stderr)
        return 2

    if not new_items:
        print("No new matching papers.")
        return 0

    merged = sorted(new_items + items, key=sort_key, reverse=True)
    papers["items"] = merged
    papers["updated_at"] = datetime.now(timezone.utc).date().isoformat()
    if topics.get("queries"):
        papers["topics"] = sorted({tag for query in topics["queries"] for tag in query.get("tags", [])})

    print(f"Found {len(new_items)} new paper(s):")
    for paper in new_items:
        print(f"- {paper['date']} | {paper['topic']} | {paper['title']}")

    if args.dry_run:
        print("Dry run: not writing _data/papers.json.")
        return 0

    save_json(args.papers_file, papers)
    print(f"Updated {args.papers_file}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
