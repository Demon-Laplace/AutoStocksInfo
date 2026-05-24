from __future__ import annotations

import re
from typing import Any

from pipeline.config import get_holdings, normalize_ticker
from pipeline.models import RawNewsItem, RelevanceResult


def analyze_relevance(item: RawNewsItem, watchlist: dict[str, Any]) -> RelevanceResult:
    text = _combined_text(item)
    related_holdings: set[str] = set()
    tickers: set[str] = set()
    themes: set[str] = set()
    score = 0

    for holding_ticker, holding_cfg in get_holdings(watchlist).items():
        ticker = normalize_ticker(holding_ticker)
        name = str(holding_cfg.get("name") or "")
        direct_hit = _contains_ticker(text, ticker) or _contains_phrase(text, name)
        if direct_hit:
            related_holdings.add(ticker)
            tickers.add(ticker)
            score += 35

        for related_ticker in holding_cfg.get("related_tickers", []) or []:
            normalized_related = normalize_ticker(str(related_ticker))
            if _contains_ticker(text, normalized_related):
                related_holdings.add(ticker)
                tickers.add(normalized_related)
                score += 20

        for entity in holding_cfg.get("related_entities", []) or []:
            if isinstance(entity, dict) and _contains_phrase(text, str(entity.get("name") or "")):
                related_holdings.add(ticker)
                score += min(25, 5 * int(entity.get("importance", 3) or 3))

        for theme in holding_cfg.get("themes", []) or []:
            theme_text = str(theme)
            if _contains_phrase(text, theme_text):
                related_holdings.add(ticker)
                themes.add(theme_text)
                score += 12

        keywords = (holding_cfg.get("positive_keywords", []) or []) + (
            holding_cfg.get("negative_keywords", []) or []
        )
        for keyword in keywords:
            if _contains_phrase(text, str(keyword)):
                related_holdings.add(ticker)
                score += 10

    return RelevanceResult(
        related_holdings=sorted(related_holdings),
        tickers=sorted(tickers),
        themes=sorted(themes),
        relevance_score=min(score, 100),
    )


def _combined_text(item: RawNewsItem) -> str:
    return " ".join(
        part
        for part in [item.title, item.raw_excerpt or "", item.source or "", item.url]
        if part
    ).lower()


def _contains_ticker(text: str, ticker: str) -> bool:
    return re.search(rf"(?<![A-Za-z0-9]){re.escape(ticker.lower())}(?![A-Za-z0-9])", text) is not None


def _contains_phrase(text: str, phrase: str) -> bool:
    phrase = " ".join((phrase or "").lower().split())
    if not phrase:
        return False
    return phrase in text

