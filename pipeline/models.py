from __future__ import annotations

from dataclasses import asdict, dataclass
from datetime import date, datetime
from typing import Any


def serialize_value(value: Any) -> Any:
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    if isinstance(value, list):
        return [serialize_value(item) for item in value]
    if isinstance(value, dict):
        return {key: serialize_value(item) for key, item in value.items()}
    return value


def dataclass_to_record(instance: Any) -> dict[str, Any]:
    return serialize_value(asdict(instance))


@dataclass(slots=True)
class PriceSnapshot:
    ticker: str
    snapshot_date: date
    open: float | None
    high: float | None
    low: float | None
    close: float | None
    previous_close: float | None
    change_pct: float | None
    volume: float | None
    source: str

    def to_record(self) -> dict[str, Any]:
        return dataclass_to_record(self)


@dataclass(slots=True)
class NewsItem:
    title: str
    url: str
    source: str | None
    published_at: datetime | None
    fetched_at: datetime
    content_hash: str
    summary: str | None
    raw_excerpt: str | None
    tickers: list[str]
    related_holdings: list[str]
    themes: list[str]
    impact_direction: str
    impact_level: str
    confidence: str
    reason: str | None

    def to_record(self) -> dict[str, Any]:
        return dataclass_to_record(self)


@dataclass(slots=True)
class RawNewsItem:
    title: str
    url: str
    source: str | None
    published_at: datetime | None
    fetched_at: datetime
    raw_excerpt: str | None


@dataclass(slots=True)
class RelevanceResult:
    related_holdings: list[str]
    tickers: list[str]
    themes: list[str]
    relevance_score: int


@dataclass(slots=True)
class ImpactResult:
    impact_direction: str
    impact_level: str
    confidence: str
    reason: str


@dataclass(slots=True)
class SecFiling:
    ticker: str
    company_name: str | None
    cik: str | None
    filing_type: str
    accession_number: str | None
    filed_at: date | None
    report_url: str | None
    summary: str | None
    impact_direction: str = "unknown"
    impact_level: str = "low"
    reason: str | None = None

    def to_record(self) -> dict[str, Any]:
        return dataclass_to_record(self)

