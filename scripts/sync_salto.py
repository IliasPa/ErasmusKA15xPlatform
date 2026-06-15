#!/usr/bin/env python3
"""
sync_salto.py — Pulls project listings from the Salto Youth Otlas project
search and merges new entries into data/projects.json.

Only projects that are *ready to find participants* are imported, i.e. those
that still need partners AND whose partner-request deadline is still in the
future (Otlas filters ``b_partners_needed`` + ``b_future_deadline``). Expired
or already-filled listings are skipped.

The whole result set is paged through (``b_offset``), not just the first page.

Fields populated automatically:
  id, salto_id, salto_url, title, hosting_ngo, summary,
  ka_action (best-guess), start_date, end_date,
  destination_country, location_city, infopack_url

Fields requiring manual completion (left empty):
  application_forms
"""

from __future__ import annotations

import json
import re
import sys
import time
from pathlib import Path

import requests
from bs4 import BeautifulSoup

LISTING_URL = "https://www.salto-youth.net/tools/otlas-partner-finding/projects/"
SITE_ROOT = "https://www.salto-youth.net"
DATA_FILE = Path(__file__).parent.parent / "data" / "projects.json"

PAGE_SIZE = 10           # Otlas fixes the listing page size at 10
MAX_PAGES = 200          # safety cap so a layout change can't loop forever

# Search filters: only projects still recruiting partners with a future
# deadline — the ones actually ready to take on participants.
SEARCH_PARAMS = {
    "b_browse": "Search projects",
    "b_partners_needed": "1",
    "b_future_deadline": "1",
    "b_order": "lastmod",
    "b_limit": str(PAGE_SIZE),
}

# Map known KA codes / keywords → schema values
KA_MAP = [
    ("KA151", "KA151 – Youth Exchange"),
    ("KA152", "KA152 – Youth Exchange"),
    ("KA153", "KA153 – Youth Workers Mobility"),
    ("youth exchange", "KA152 – Youth Exchange"),
    ("youth workers", "KA153 – Youth Workers Mobility"),
    ("training course", "KA153 – Youth Workers Mobility"),
    ("training and networking", "KA153 – Youth Workers Mobility"),
    ("mobility of youth workers", "KA153 – Youth Workers Mobility"),
]

HEADERS = {
    "User-Agent": "ErasmusPlatformSync/1.0 (github.com/IliasPa/ErasmusKA15xPlatform)"
}

# An infopack can be advertised in many ways. We treat a link as an infopack if
# its URL or its visible text mentions any of these words…
INFOPACK_KEYWORDS = [
    "infopack", "info-pack", "info pack",
    "infosheet", "info-sheet", "info sheet",
    "information", "factsheet", "fact sheet",
]
# …or if the link points at a file-sharing host that orgs use for documents…
INFOPACK_HOSTS = [
    "drive.google", "docs.google", "dropbox.com",
    "onedrive", "1drv.ms", "wetransfer", "we.tl",
]
# …or if it is a downloadable document.
INFOPACK_EXTS = (".pdf", ".doc", ".docx")


def guess_ka_action(text: str) -> str:
    # Otlas doesn't expose a clean KA code, so we infer one: scan the activity
    # text for the first known code/keyword and map it to a schema value.
    # Youth Exchange (KA152) is the most common type, so it's the fallback.
    t = text.lower()
    for keyword, value in KA_MAP:
        if keyword.lower() in t:
            return value
    return "KA152 – Youth Exchange"


def load_existing() -> list[dict]:
    if DATA_FILE.exists():
        return json.loads(DATA_FILE.read_text(encoding="utf-8"))
    return []


def existing_salto_ids(projects: list[dict]) -> set[str]:
    return {p["salto_id"] for p in projects if p.get("salto_id")}


def _text(node, selector: str) -> str:
    el = node.select_one(selector)
    return el.get_text(" ", strip=True) if el else ""


def parse_card(card) -> dict | None:
    """Turn one search-result tile into an item dict, or None if unparseable.

    Every field is read straight from the card's own markup — each chunk of the
    tile has a dedicated CSS class, so we just pick the right element and tidy
    its text. The per-field comments below say what we read and why.
    """
    # Link + id: the title is a link to the project page, ending in ".<number>/".
    # That trailing number is the project's stable Otlas id, which we reuse as
    # the dedup key. No link or no id → the tile is unusable, so bail out.
    link = card.select_one("h2.project-title a") or card.find(
        "a", href=re.compile(r"/project/.+\.\d+/")
    )
    if not link:
        return None
    href = link.get("href", "")
    id_match = re.search(r"\.(\d+)/?$", href)
    if not id_match:
        return None
    project_id = id_match.group(1)

    # Title: the heading text (fall back to the link text if the heading is bare).
    title = _text(card, "h2.project-title") or link.get_text(strip=True)
    # Summary: the project blurb the org wrote, shown on the tile.
    summary = _text(card, ".project-summary") or _text(card, ".project-description")
    # Hosting org: the organisation name, which on the tile is its own link.
    org = _text(card, ".organisation-name-haslogo a") or ""

    # Country + city: the tile prints the org line as
    # "a Non-profit/… based in <Country> (<City>)". We grab the country after
    # "based in" and the optional city from the parentheses.
    based = _text(card, ".based-in")
    based_match = re.search(r"based in\s+([A-Za-z .'-]+?)\s*(?:\(([^)]+)\))?$", based)
    country = based_match.group(1).strip() if based_match else ""
    city = based_match.group(2).strip() if based_match and based_match.group(2) else ""

    # Dates: the tile prints "This project takes place: from <start> till <end>".
    # Dates can be month-only (YYYY-MM) or full (YYYY-MM-DD); we accept both.
    dates = _text(card, ".project-dates")
    date_match = re.search(
        r"from\s+(\d{4}-\d{2}(?:-\d{2})?)\s+till\s+(\d{4}-\d{2}(?:-\d{2})?)", dates
    )
    start_date = date_match.group(1) if date_match else ""
    end_date = date_match.group(2) if date_match else ""

    # Activity type: printed as "and relates to: <activity>"; we drop the prefix
    # and later map it to a KA action with guess_ka_action().
    action = _text(card, ".project-action").replace("and relates to:", "").strip()

    return {
        "guid": f"salto-otlas-project-{project_id}",
        "title": title,
        "link": href if href.startswith("http") else SITE_ROOT + href,
        "summary": summary,
        "author": org,
        "destination_country": country,
        "location_city": city,
        "start_date": start_date,
        "end_date": end_date,
        "action": action,
    }


def total_results(soup) -> int | None:
    # The results page prints "We found <N> projects matching your search!".
    # We read that N to know how many pages to walk (10 results per page).
    m = re.search(r"found\s+(\d+)\s+projects?", soup.get_text(" ", strip=True), re.I)
    return int(m.group(1)) if m else None


def fetch_listing_items() -> list[dict]:
    """Page through the filtered search and return every matching project."""
    print("Fetching Otlas project search (ready-to-recruit only)…")
    items: list[dict] = []
    total = None
    offset = 0

    for page in range(MAX_PAGES):
        params = {**SEARCH_PARAMS, "b_offset": str(offset)}
        resp = requests.get(LISTING_URL, headers=HEADERS, params=params, timeout=25)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "html.parser")

        if total is None:
            total = total_results(soup)
            print(f"  {total if total is not None else '?'} projects match the filter.")

        cards = soup.select("div.tool-item")
        page_items = [it for c in cards if (it := parse_card(c))]
        if not page_items:
            break
        items.extend(page_items)
        print(f"  page {page + 1}: +{len(page_items)} (running total {len(items)})")

        offset += PAGE_SIZE
        if total is not None and offset >= total:
            break
        time.sleep(0.6)

    # The same project can surface twice if listings shift between page fetches.
    unique: dict[str, dict] = {}
    for it in items:
        unique.setdefault(it["guid"], it)
    print(f"  {len(unique)} unique projects collected.")
    return list(unique.values())


def _looks_like_infopack(url: str, label: str = "") -> bool:
    """An infopack link is recognised by its wording, its host, or its file type."""
    blob = f"{url} {label}".lower()
    return (
        any(kw in blob for kw in INFOPACK_KEYWORDS)      # "infopack", "information", …
        or any(host in url.lower() for host in INFOPACK_HOSTS)  # a Drive/Dropbox/etc. file
        or url.lower().split("?")[0].endswith(INFOPACK_EXTS)   # a .pdf/.doc download
    )


def scrape_infopack(url: str) -> str:
    """Look for an infopack link inside the organisation's own description text.

    Logic: the only place an org can paste an infopack is the free-text
    description (``.running-text``). We deliberately ignore the rest of the page
    so SALTO's own chrome ("Info Centres", "Participation & Information", …) can
    never be mistaken for an infopack. Within that block we accept a link when
    its wording/host/extension looks like an infopack (see _looks_like_infopack).
    Orgs paste links two ways, so we check both.
    """
    resp = requests.get(url, headers=HEADERS, timeout=20)
    resp.raise_for_status()
    soup = BeautifulSoup(resp.text, "html.parser")
    description = soup.select_one(".running-text") or soup

    # 1) Proper <a> links. Only consider absolute (external) URLs — relative
    #    links are internal SALTO navigation, never an infopack.
    for a in description.find_all("a", href=True):
        href = a["href"].strip()
        if href.startswith("http") and _looks_like_infopack(href, a.get_text(" ", strip=True)):
            return href

    # 2) Bare URLs typed into the text (e.g. "Infopack: https://drive.google…").
    #    Match the URL itself or the few words written just before it.
    text = description.get_text(" ", strip=True)
    for m in re.finditer(r"https?://[^\s)<>\"']+", text):
        link = m.group(0).rstrip(".,);")
        preceding_words = text[max(0, m.start() - 40):m.start()]
        if _looks_like_infopack(link, preceding_words):
            return link

    return ""


def next_id(projects: list[dict]) -> str:
    nums = [
        int(m.group(1))
        for p in projects
        if (m := re.match(r"proj-(\d+)", p.get("id", "")))
    ]
    return f"proj-{(max(nums) + 1) if nums else 1:03d}"


def main():
    projects = load_existing()
    seen = existing_salto_ids(projects)
    items = fetch_listing_items()
    added = 0

    for item in items:
        guid = item["guid"]
        if guid in seen:
            print(f"  skip (exists): {item['title'][:60]}")
            continue

        print(f"  + {item['title'][:60]}")
        try:
            infopack_url = scrape_infopack(item["link"])
        except Exception as e:
            print(f"    ⚠ infopack fetch failed: {e}", file=sys.stderr)
            infopack_url = ""
        time.sleep(0.6)

        ka_action = guess_ka_action(f"{item['action']} {item['summary']}")

        projects.append({
            "id": next_id(projects),
            "salto_id": guid,
            "salto_url": item["link"],
            "title": item["title"],
            "ka_action": ka_action,
            "location_city": item["location_city"],
            "destination_country": item["destination_country"],
            "start_date": item["start_date"],
            "end_date": item["end_date"],
            "hosting_ngo": item["author"],
            "infopack_url": infopack_url,
            "summary": item["summary"],
            "application_forms": {},
        })
        seen.add(guid)
        added += 1

    DATA_FILE.write_text(
        json.dumps(projects, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    print(f"\nDone — {added} new project(s) added. Total: {len(projects)}.")


if __name__ == "__main__":
    main()
