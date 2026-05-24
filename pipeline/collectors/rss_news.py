from __future__ import annotations

import calendar
import logging
from datetime import datetime, timezone
from typing import Any

import feedparser
import requests
from bs4 import BeautifulSoup

from pipeline.models import RawNewsItem

logger = logging.getLogger(__name__)


def fetch_rss_news(watchlist: dict[str, Any], timeout: int = 20) -> list[RawNewsItem]:
    sources = watchlist.get("news_sources", {}).get("rss", [])
    if not isinstance(sources, list):
        logger.warning("news_sources.rss is not a list; skipping RSS fetch")
        return []

    items: list[RawNewsItem] = []
    for source in sources:
        if not isinstance(source, dict) or not source.get("url"):
            continue
        source_name = source.get("name") or source["url"]
        url = source["url"]
        try:
            response = requests.get(url, timeout=timeout, headers={"User-Agent": "InvestmentIntel/0.1"})
            response.raise_for_status()
        except requests.RequestException as exc:
            logger.warning("Failed to fetch RSS source %s: %s", source_name, exc)
            continue

        parsed = feedparser.parse(response.content)
        if parsed.bozo:
            logger.warning("RSS parser reported a problem for %s: %s", source_name, parsed.bozo_exception)

        fetched_at = datetime.now(timezone.utc)
        for entry in parsed.entries:
            title = (entry.get("title") or "").strip()
            link = (entry.get("link") or "").strip()
            if not title or not link:
                continue
            excerpt = _clean_html(entry.get("summary") or entry.get("description") or "")
            items.append(
                RawNewsItem(
                    title=title,
                    url=link,
                    source=source_name,
                    published_at=_entry_datetime(entry),
                    fetched_at=fetched_at,
                    raw_excerpt=excerpt,
                )
            )

    logger.info("Fetched %d RSS news items", len(items))
    return items


def _entry_datetime(entry: Any) -> datetime | None:
    parsed_time = entry.get("published_parsed") or entry.get("updated_parsed")
    if not parsed_time:
        return None
    return datetime.fromtimestamp(calendar.timegm(parsed_time), tz=timezone.utc)


def _clean_html(value: str) -> str | None:
    if not value:
        return None
    text = BeautifulSoup(value, "html.parser").get_text(" ", strip=True)
    return " ".join(text.split())[:1000] or None

