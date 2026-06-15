#!/usr/bin/env python3
"""
sync_salto.py — Pulls activities from the SALTO-YOUTH European Training Calendar
and merges new entries into data/projects.json.

Why this source: the Training Calendar lists concrete activities (Training
Courses, Seminars, Youth Exchanges, …) that young people / youth workers can
actually apply to — unlike the Otlas partner-finding tool, which is for
organisations seeking partner organisations. Every activity carries a venue,
start/end dates, an application deadline and a list of eligible participant
countries, which maps directly onto this platform's data model.

How the extraction works (see each parse_* function for the details):
  - We query the calendar's HTML search with the same filters as the website:
    only activities that start in the future AND whose application deadline is
    still open, ordered by deadline. We page through the whole result set.
  - Each result tile already carries category, title, dates, venue, a blurb,
    the application deadline and the eligible countries — we read those straight
    from the tile's markup.
  - We open each activity's own page once to read the organiser name and to find
    a real external application form / infopack link the organiser may have
    pasted into the description.

Fields populated automatically:
  id, salto_id, salto_url, title, ka_action (mapped from the activity type),
  start_date, end_date, application_deadline, destination_country,
  location_city, hosting_ngo, summary, infopack_url, application_forms

application_forms maps every eligible residence country to the application URL
(the organiser's external form when present, otherwise the SALTO activity page).
"""

from __future__ import annotations

import json
import re
import sys
import time
from datetime import date
from pathlib import Path

import requests
from bs4 import BeautifulSoup

BROWSE_URL = "https://www.salto-youth.net/tools/european-training-calendar/browse/"
SITE_ROOT = "https://www.salto-youth.net"
DATA_FILE = Path(__file__).parent.parent / "data" / "projects.json"

PAGE_SIZE = 10           # the calendar returns 10 activities per page
MAX_PAGES = 200          # safety cap so a layout change can't loop forever

HEADERS = {
    "User-Agent": "ErasmusPlatformSync/1.0 (github.com/IliasPa/ErasmusKA15xPlatform)"
}

# The platform's residence dropdown only offers these countries, so eligibility
# is reduced to this set. (Kept in sync with COUNTRIES in js/filters.js.)
PROGRAMME_COUNTRIES = [
    "Austria", "Belgium", "Bulgaria", "Croatia", "Cyprus", "Czech Republic",
    "Denmark", "Estonia", "Finland", "France", "Germany", "Greece", "Hungary",
    "Ireland", "Italy", "Latvia", "Lithuania", "Netherlands", "Poland",
    "Portugal", "Romania", "Slovakia", "Slovenia", "Spain", "Sweden", "Turkey",
]
PROGRAMME_COUNTRY_SET = set(PROGRAMME_COUNTRIES)

# SALTO sometimes names countries differently than the platform does.
COUNTRY_ALIASES = {
    "Czechia": "Czech Republic",
    "Türkiye": "Turkey",
    "Turkiye": "Turkey",
    "The Netherlands": "Netherlands",
    "Republic of North Macedonia": None,   # not a platform residence country
}

# Group labels in the eligibility line that mean "all programme countries".
PROGRAMME_GROUP_LABELS = [
    "erasmus+ youth programme countries",
    "erasmus+ programme countries",
    "programme countries",
]

# The calendar's activity types → this platform's KA action labels. Anything
# that isn't a youth exchange is treated as youth-worker mobility (KA153), which
# keeps the project-type filter on the site working.
def guess_ka_action(category: str) -> str:
    c = category.lower()
    if "youth exchange" in c:
        return "KA152 – Youth Exchange"
    return "KA153 – Youth Workers Mobility"

MONTHS = {
    "jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6,
    "jul": 7, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12,
}


def search_params(offset: int) -> dict:
    """Filter exactly like the website: future start, open deadline, by deadline."""
    today = date.today()
    return {
        "b_order": "applicationDeadline",
        # only activities that begin from today onwards
        "b_begin_date_after_day": today.day,
        "b_begin_date_after_month": today.month,
        "b_begin_date_after_year": today.year,
        # only activities whose application deadline has not passed
        "b_application_deadline_after_day": today.day,
        "b_application_deadline_after_month": today.month,
        "b_application_deadline_after_year": today.year,
        "b_offset": offset,
    }


def load_existing() -> list[dict]:
    if DATA_FILE.exists():
        return json.loads(DATA_FILE.read_text(encoding="utf-8"))
    return []


def existing_salto_ids(projects: list[dict]) -> set[str]:
    return {p["salto_id"] for p in projects if p.get("salto_id")}


def _text(node, selector: str) -> str:
    el = node.select_one(selector)
    return el.get_text(" ", strip=True) if el else ""


def _iso(day: str, month_name: str, year: str) -> str:
    """Turn ("5", "September", "2026") into "2026-09-05"; "" if the month is odd."""
    month = MONTHS.get(month_name.strip().lower()[:3])
    if not month:
        return ""
    return f"{int(year):04d}-{month:02d}-{int(day):02d}"


def parse_dates(text: str) -> tuple[str, str]:
    """Parse the calendar's human date line into ISO start/end dates.

    Handles the three shapes the calendar prints:
      "31 August - 5 September 2026"  → cross-month range (start year inherited)
      "15-20 August 2026"             → same-month range
      "18 June 2026"                  → single day (start == end)
    """
    text = re.sub(r"\s+", " ", text).strip()

    # Cross-month / cross-year: a month sits on both sides of the dash.
    m = re.search(
        r"(\d{1,2})\s+([A-Za-z]+)\s*(\d{4})?\s*[–-]\s*(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})",
        text,
    )
    if m:
        sd, smon, syr, ed, emon, eyr = m.groups()
        return _iso(sd, smon, syr or eyr), _iso(ed, emon, eyr)

    # Same-month range: one month name shared by both days ("15-20 August 2026").
    m = re.search(r"(\d{1,2})\s*[–-]\s*(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})", text)
    if m:
        sd, ed, mon, yr = m.groups()
        return _iso(sd, mon, yr), _iso(ed, mon, yr)

    # Single day.
    m = re.search(r"(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})", text)
    if m:
        sd, mon, yr = m.groups()
        return _iso(sd, mon, yr), _iso(sd, mon, yr)

    return "", ""


def parse_deadline(text: str) -> str:
    """Extract the deadline date from "Application deadline (24h UTC) : 15 June 2026"."""
    m = re.search(r"(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})", text)
    return _iso(*m.groups()) if m else ""


def parse_venue(text: str) -> tuple[str, str]:
    """"Sofia, Bulgaria" or "Trebnitz (near Berlin), Germany" → (city, country).

    The country is always the part after the LAST comma, so a city that itself
    contains a comma/brackets stays intact.
    """
    text = text.strip()
    if "," in text:
        city, country = text.rsplit(",", 1)
        return city.strip(), country.strip()
    return "", text


def normalize_country(name: str) -> str | None:
    """Map a SALTO country name to a platform residence country, or None.

    Drops regional suffixes ("Belgium - FL" → "Belgium"), applies known aliases,
    and keeps only countries the platform actually offers.
    """
    name = re.sub(r"\s*-\s*[A-Z]{2,3}$", "", name.strip())  # "Belgium - FL"
    if name in COUNTRY_ALIASES:
        name = COUNTRY_ALIASES[name]
    return name if name in PROGRAMME_COUNTRY_SET else None


def parse_eligibility(text: str) -> list[str]:
    """Turn the "participants from …" line into a list of residence countries.

    Concrete country names are normalised and kept; a "programme countries"
    group label expands to every programme country; partner-region labels
    (Eastern Partnership, Western Balkans, Other countries, …) are dropped
    because those residents can't use this platform.
    """
    text = re.sub(r"(?i)this activity is for participants from", "", text).strip()
    countries: set[str] = set()
    for token in text.split(","):
        token = token.strip()
        if not token:
            continue
        if any(label in token.lower() for label in PROGRAMME_GROUP_LABELS):
            countries.update(PROGRAMME_COUNTRIES)
            continue
        mapped = normalize_country(token)
        if mapped:
            countries.add(mapped)
    return sorted(countries)


def total_results(soup) -> int | None:
    m = re.search(r"found\s+(\d+)\s+training", soup.get_text(" ", strip=True), re.I)
    return int(m.group(1)) if m else None


def parse_card(card) -> dict | None:
    """Read one search-result tile into an item dict (None if unusable)."""
    link = card.find("a", href=re.compile(r"/training/.+\.\d+/"))
    if not link:
        return None
    href = link["href"]
    id_match = re.search(r"\.(\d+)/?$", href)
    if not id_match:
        return None

    # Category drives the KA-action label; title is the activity name.
    category = _text(card, ".tool-item-category")
    title = _text(card, ".tool-item-name") or link.get_text(strip=True)

    # Dates: there are several <p class="h5"> on a tile; pick the one that
    # actually looks like a date so we don't grab the blurb by accident.
    start_date = end_date = ""
    for p in card.select("p.h5"):
        s, e = parse_dates(p.get_text(" ", strip=True))
        if s:
            start_date, end_date = s, e
            break

    # Venue (city + country), deadline and eligibility each have their own block.
    city, country = parse_venue(_text(card, "p.microcopy.mrgn-btm-17"))
    application_deadline = parse_deadline(_text(card, ".callout-module"))
    eligible_countries = parse_eligibility(_text(card, ".tool-item-short-overview"))
    summary = _text(card, "p.mrgn-btm-22")

    return {
        "salto_id": f"salto-training-{id_match.group(1)}",
        "url": href if href.startswith("http") else SITE_ROOT + href,
        "title": title,
        "ka_action": guess_ka_action(category),
        "start_date": start_date,
        "end_date": end_date,
        "application_deadline": application_deadline,
        "location_city": city,
        "destination_country": country,
        "summary": summary,
        "eligible_countries": eligible_countries,
    }


def fetch_listing_items() -> list[dict]:
    """Page through the filtered calendar and return every matching activity."""
    print("Fetching SALTO Training Calendar (future, application open)…")
    items: list[dict] = []
    total = None
    offset = 0

    for page in range(MAX_PAGES):
        resp = requests.get(BROWSE_URL, headers=HEADERS, params=search_params(offset), timeout=25)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "html.parser")

        if total is None:
            total = total_results(soup)
            print(f"  {total if total is not None else '?'} activities match the filter.")

        cards = soup.select(".tool-item.training")
        page_items = [it for c in cards if (it := parse_card(c))]
        if not page_items:
            break
        items.extend(page_items)
        print(f"  page {page + 1}: +{len(page_items)} (running total {len(items)})")

        offset += PAGE_SIZE
        if total is not None and offset >= total:
            break
        time.sleep(0.5)

    # The same activity can surface twice if listings shift between page fetches.
    unique: dict[str, dict] = {}
    for it in items:
        unique.setdefault(it["salto_id"], it)
    print(f"  {len(unique)} unique activities collected.")
    return list(unique.values())


def scrape_detail(url: str) -> dict:
    """Read the activity page for the organiser and any external form/infopack link.

    The organiser sits under an "Organiser:" label. The organiser's free-text
    description (.training-description) is the only place a real external
    application form or infopack link can appear, so we look there and ignore the
    rest of the page (which is all SALTO navigation).
    """
    resp = requests.get(url, headers=HEADERS, timeout=20)
    resp.raise_for_status()
    soup = BeautifulSoup(resp.text, "html.parser")

    organiser = ""
    label = soup.find(string=re.compile(r"^\s*Organiser", re.I))
    if label:
        value = label.parent.find_next(["div", "a", "span"])
        if value:
            organiser = value.get_text(" ", strip=True)

    application_url = ""
    infopack_url = ""
    description = soup.select_one(".training-description") or soup
    for a in description.find_all("a", href=True):
        href = a["href"].strip()
        if not href.startswith("http"):
            continue
        blob = f"{href} {a.get_text(' ', strip=True)}".lower()
        if not application_url and any(k in blob for k in ["application", "apply", "register", "form"]):
            application_url = href
        elif not infopack_url and any(
            k in blob for k in ["infopack", "info pack", "info-pack", "information", "factsheet", ".pdf"]
        ):
            infopack_url = href

    return {
        "hosting_ngo": organiser,
        "application_url": application_url,
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
    items = fetch_listing_items()
    added = 0

    for item in items:
        salto_id = item["salto_id"]
        if salto_id in seen:
            print(f"  skip (exists): {item['title'][:60]}")
            continue

        print(f"  + {item['title'][:60]}")
        try:
            detail = scrape_detail(item["url"])
        except Exception as e:
            print(f"    ⚠ detail fetch failed: {e}", file=sys.stderr)
            detail = {}
        time.sleep(0.5)

        # Apply where the organiser tells us to, otherwise on the SALTO page.
        apply_url = detail.get("application_url") or item["url"]
        application_forms = {country: apply_url for country in item["eligible_countries"]}

        projects.append({
            "id": next_id(projects),
            "salto_id": salto_id,
            "salto_url": item["url"],
            "title": item["title"],
            "ka_action": item["ka_action"],
            "location_city": item["location_city"],
            "destination_country": item["destination_country"],
            "start_date": item["start_date"],
            "end_date": item["end_date"],
            "application_deadline": item["application_deadline"],
            "hosting_ngo": detail.get("hosting_ngo", ""),
            "infopack_url": detail.get("infopack_url", "") or item["url"],
            "summary": item["summary"],
            "application_forms": application_forms,
        })
        seen.add(salto_id)
        added += 1

    DATA_FILE.write_text(
        json.dumps(projects, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    print(f"\nDone — {added} new activity(ies) added. Total: {len(projects)}.")


if __name__ == "__main__":
    main()
