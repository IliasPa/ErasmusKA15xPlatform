#!/usr/bin/env python3
"""
sync_salto.py — Pulls project listings from Salto Youth Otlas RSS feed
and merges new entries into data/projects.json.

Fields populated automatically:
  id, salto_id, salto_url, title, hosting_ngo, summary,
  ka_action (best-guess), start_date, end_date,
  destination_country, location_city, infopack_url

Fields requiring manual completion (left empty):
  application_forms
"""

import json
import re
import sys
import time
from pathlib import Path
from xml.etree import ElementTree as ET

import requests
from bs4 import BeautifulSoup

RSS_BASE = "https://www.salto-youth.net/tools/otlas-partner-finding/projects/?rss=1"
DATA_FILE = Path(__file__).parent.parent / "data" / "projects.json"

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


def guess_ka_action(text: str) -> str:
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


def fetch_rss_items() -> list[dict]:
    print("Fetching Otlas RSS feed…")
    resp = requests.get(RSS_BASE, headers=HEADERS, timeout=20)
    resp.raise_for_status()
    root = ET.fromstring(resp.content)
    items = []
    for item in root.findall(".//item"):
        guid = (item.findtext("guid") or "").strip()
        items.append({
            "guid": guid,
            "title": (item.findtext("title") or "").strip(),
            "link": (item.findtext("link") or "").strip(),
            "description": (item.findtext("description") or "").strip(),
            "author": (item.findtext("author") or "").strip(),
        })
    print(f"  {len(items)} projects in feed.")
    return items


def scrape_detail(url: str) -> dict:
    resp = requests.get(url, headers=HEADERS, timeout=20)
    resp.raise_for_status()
    soup = BeautifulSoup(resp.text, "html.parser")
    text = soup.get_text(" ", strip=True)

    # KA action code
    ka_match = re.search(r"KA1\d+[\w-]*", text)
    ka_raw = ka_match.group(0) if ka_match else ""

    # Date range: "from YYYY-MM till YYYY-MM" or "from YYYY-MM-DD till YYYY-MM-DD"
    date_match = re.search(
        r"from\s+(\d{4}-\d{2}(?:-\d{2})?)\s+till\s+(\d{4}-\d{2}(?:-\d{2})?)", text
    )
    start_date = date_match.group(1) if date_match else ""
    end_date = date_match.group(2) if date_match else ""

    # Venue country and city — Otlas pages have no structured location field without login.
    # Try the project-meta aside text first, then fall back to scanning description text.
    aside = soup.find(class_="aside")
    aside_text = aside.get_text(" ", strip=True) if aside else text

    country_match = re.search(
        r"[Vv]enue\s+country[:\s]+([A-Z][a-zA-Z\s]{2,30}?)(?:\s{2,}|\n|,)", text
    )
    city_match = re.search(
        r"[Vv]enue\s+city[:\s]+([A-Z][a-zA-Z\s]{2,30}?)(?:\s{2,}|\n|,)", text
    )
    country = country_match.group(1).strip() if country_match else ""
    city = city_match.group(1).strip() if city_match else ""

    # Fallback: match against a list of European + common partner countries
    if not country:
        _COUNTRIES = [
            "Albania", "Armenia", "Austria", "Azerbaijan", "Belarus", "Belgium",
            "Bosnia and Herzegovina", "Bulgaria", "Croatia", "Cyprus", "Czech Republic",
            "Denmark", "Estonia", "Finland", "France", "Georgia", "Germany", "Greece",
            "Hungary", "Iceland", "Ireland", "Israel", "Italy", "Jordan", "Kosovo",
            "Latvia", "Liechtenstein", "Lithuania", "Luxembourg", "Malta", "Moldova",
            "Montenegro", "Morocco", "Netherlands", "North Macedonia", "Norway",
            "Poland", "Portugal", "Romania", "Russia", "Serbia", "Slovakia", "Slovenia",
            "Spain", "Sweden", "Switzerland", "Tunisia", "Turkey", "Ukraine",
            "United Kingdom", "Uzbekistan",
        ]
        for name in _COUNTRIES:
            if re.search(r"\b" + re.escape(name) + r"\b", text, re.IGNORECASE):
                country = name
                break

    # Infopack / PDF link
    infopack_url = ""
    for a in soup.find_all("a", href=True):
        href = a["href"]
        if any(x in href.lower() for x in ["infopack", "info-pack", ".pdf", "infosheet"]):
            infopack_url = href
            break

    return {
        "ka_raw": ka_raw,
        "start_date": start_date,
        "end_date": end_date,
        "destination_country": country,
        "location_city": city,
        "infopack_url": infopack_url,
    }


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
    items = fetch_rss_items()
    added = 0

    for item in items:
        guid = item["guid"]
        if guid in seen:
            print(f"  skip (exists): {item['title'][:60]}")
            continue

        print(f"  + {item['title'][:60]}")
        try:
            detail = scrape_detail(item["link"])
        except Exception as e:
            print(f"    ⚠ detail fetch failed: {e}", file=sys.stderr)
            detail = {}
        time.sleep(0.6)

        ka_action = guess_ka_action(
            detail.get("ka_raw", "") + " " + item["description"]
        )

        projects.append({
            "id": next_id(projects),
            "salto_id": guid,
            "salto_url": item["link"],
            "title": item["title"],
            "ka_action": ka_action,
            "location_city": detail.get("location_city", ""),
            "destination_country": detail.get("destination_country", ""),
            "start_date": detail.get("start_date", ""),
            "end_date": detail.get("end_date", ""),
            "hosting_ngo": item["author"],
            "infopack_url": detail.get("infopack_url", ""),
            "summary": item["description"],
            "application_forms": {},
        })
        added += 1

    DATA_FILE.write_text(
        json.dumps(projects, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    print(f"\nDone — {added} new project(s) added. Total: {len(projects)}.")


if __name__ == "__main__":
    main()
