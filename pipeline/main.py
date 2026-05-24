from __future__ import annotations

import argparse
import logging
import os
import sys
from datetime import date, timedelta
from typing import Any

from pipeline.analyzer.dedupe import content_hash
from pipeline.analyzer.impact import analyze_news_impact, apply_filing_impact
from pipeline.analyzer.relevance import analyze_relevance
from pipeline.collectors.prices import fetch_prices
from pipeline.collectors.rss_news import fetch_rss_news
from pipeline.collectors.sec_filings import fetch_sec_filings
from pipeline.config import (
    AppConfig,
    ConfigError,
    build_holding_records,
    build_related_asset_records,
    get_all_tickers,
    load_config,
)
from pipeline.db import DatabaseClient
from pipeline.models import NewsItem, RawNewsItem, SecFiling
from pipeline.reports.markdown_report import generate_markdown_report

logger = logging.getLogger(__name__)


def configure_logging() -> None:
    logging.basicConfig(
        level=os.getenv("LOG_LEVEL", "INFO"),
        format="%(asctime)s %(levelname)s %(name)s - %(message)s",
    )


def sync_watchlist(config: AppConfig, db: DatabaseClient) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    holdings = build_holding_records(config.watchlist)
    related_assets = build_related_asset_records(config.watchlist)
    db.upsert_holdings(holdings)
    db.upsert_related_assets(related_assets)
    logger.info("Synced watchlist from %s", config.watchlist_path)
    return holdings, related_assets


def fetch_and_store_prices(config: AppConfig, db: DatabaseClient) -> list[dict[str, Any]]:
    tickers = get_all_tickers(config.watchlist)
    snapshots = fetch_prices(tickers, config.report_date)
    records = [snapshot.to_record() for snapshot in snapshots]
    db.upsert_price_snapshots(records)
    return records


def fetch_and_store_news(config: AppConfig, db: DatabaseClient) -> list[dict[str, Any]]:
    raw_items = fetch_rss_news(config.watchlist)
    recent_items = [item for item in raw_items if is_recent_news_item(item, config.report_date)]
    logger.info("Keeping %d RSS news items from the latest 3 report days", len(recent_items))
    analyzed = analyze_news_items(recent_items, config.watchlist)
    records = [item.to_record() for item in analyzed]
    db.upsert_news_items(records)
    return records


def fetch_and_store_sec(config: AppConfig, db: DatabaseClient) -> list[dict[str, Any]]:
    tickers = get_all_tickers(config.watchlist)
    filings = fetch_sec_filings(tickers, config.report_date, user_agent=config.sec_user_agent)
    filings = apply_filing_impact(filings)
    records = [filing.to_record() for filing in filings]
    db.upsert_sec_filings(records)
    return records


def analyze_news_items(raw_items: list[RawNewsItem], watchlist: dict[str, Any]) -> list[NewsItem]:
    analyzed: list[NewsItem] = []
    for raw_item in raw_items:
        relevance = analyze_relevance(raw_item, watchlist)
        if relevance.relevance_score <= 0:
            logger.debug("Skipping unrelated news: %s", raw_item.title)
            continue

        impact = analyze_news_impact(raw_item, relevance, watchlist)
        analyzed.append(
            NewsItem(
                title=raw_item.title,
                url=raw_item.url,
                source=raw_item.source,
                published_at=raw_item.published_at or raw_item.fetched_at,
                fetched_at=raw_item.fetched_at,
                content_hash=content_hash(raw_item.title, raw_item.url),
                summary=_short_summary(raw_item),
                raw_excerpt=raw_item.raw_excerpt,
                tickers=relevance.tickers,
                related_holdings=relevance.related_holdings,
                themes=relevance.themes,
                impact_direction=impact.impact_direction,
                impact_level=impact.impact_level,
                confidence=impact.confidence,
                reason=impact.reason,
            )
        )
    logger.info("Analyzed %d relevant news items", len(analyzed))
    return analyzed


def is_recent_news_item(raw_item: RawNewsItem, report_date: date) -> bool:
    published_at = raw_item.published_at or raw_item.fetched_at
    start_date = report_date - timedelta(days=2)
    return start_date <= published_at.date() <= report_date


def generate_and_store_report(
    config: AppConfig,
    db: DatabaseClient,
    holdings: list[dict[str, Any]] | None = None,
    prices: list[dict[str, Any]] | None = None,
    news: list[dict[str, Any]] | None = None,
    filings: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    if holdings is None or prices is None or news is None or filings is None:
        context = db.fetch_report_context(config.report_date)
        holdings = holdings if holdings is not None else context["holdings"]
        prices = prices if prices is not None else context["prices"]
        news = news if news is not None else context["news"]
        filings = filings if filings is not None else context["filings"]

    if not holdings:
        holdings = build_holding_records(config.watchlist)

    markdown, counts = generate_markdown_report(config.report_date, holdings, prices or [], news or [], filings or [])
    record = {
        "report_date": config.report_date,
        "title": f"每日持仓情报日报 - {config.report_date.isoformat()}",
        "content_markdown": markdown,
        "high_impact_count": counts["high"],
        "medium_impact_count": counts["medium"],
        "low_impact_count": counts["low"],
    }
    db.upsert_daily_report(record)
    logger.info("Generated daily report for %s", config.report_date)
    return record


def run_daily(config: AppConfig, db: DatabaseClient) -> None:
    holdings, _ = sync_watchlist(config, db)

    prices: list[dict[str, Any]] = []
    news: list[dict[str, Any]] = []
    filings: list[dict[str, Any]] = []

    try:
        prices = fetch_and_store_prices(config, db)
    except Exception as exc:  # noqa: BLE001 - pipeline should continue if a data source fails.
        logger.exception("Price collection failed: %s", exc)

    try:
        news = fetch_and_store_news(config, db)
    except Exception as exc:  # noqa: BLE001
        logger.exception("RSS news collection failed: %s", exc)

    try:
        filings = fetch_and_store_sec(config, db)
    except Exception as exc:  # noqa: BLE001
        logger.exception("SEC filings collection failed: %s", exc)

    generate_and_store_report(config, db, holdings=holdings, prices=prices, news=news, filings=filings)


def _short_summary(item: RawNewsItem) -> str | None:
    text = item.raw_excerpt or item.title
    text = " ".join(text.split())
    return text[:500] if text else None


def main(argv: list[str] | None = None) -> int:
    configure_logging()
    parser = argparse.ArgumentParser(description="Personal investment intelligence pipeline")
    parser.add_argument(
        "command",
        choices=[
            "run-daily",
            "sync-watchlist",
            "fetch-news",
            "fetch-prices",
            "fetch-sec",
            "generate-report",
        ],
    )
    args = parser.parse_args(argv)

    try:
        config = load_config()
        db = DatabaseClient.from_config(config)

        if args.command == "run-daily":
            run_daily(config, db)
        elif args.command == "sync-watchlist":
            sync_watchlist(config, db)
        elif args.command == "fetch-news":
            fetch_and_store_news(config, db)
        elif args.command == "fetch-prices":
            fetch_and_store_prices(config, db)
        elif args.command == "fetch-sec":
            fetch_and_store_sec(config, db)
        elif args.command == "generate-report":
            generate_and_store_report(config, db)
    except ConfigError as exc:
        logger.error("Configuration error: %s", exc)
        return 2
    except Exception as exc:  # noqa: BLE001
        logger.exception("Pipeline failed: %s", exc)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
