from __future__ import annotations

import logging
from datetime import date, timedelta
from typing import Any

from supabase import Client, create_client

from pipeline.config import AppConfig
from pipeline.models import serialize_value

logger = logging.getLogger(__name__)


class DatabaseClient:
    def __init__(self, client: Client | None, user_id: str, dry_run: bool = False) -> None:
        self.client = client
        self.user_id = user_id
        self.dry_run = dry_run

    @classmethod
    def from_config(cls, config: AppConfig) -> "DatabaseClient":
        if config.dry_run:
            logger.info("DRY_RUN=true; Supabase writes will be logged and skipped")
            return cls(client=None, user_id=config.user_id, dry_run=True)
        if not config.supabase_url or not config.supabase_service_role_key:
            raise RuntimeError("Supabase URL and service role key are required")
        return cls(
            client=create_client(config.supabase_url, config.supabase_service_role_key),
            user_id=config.user_id,
            dry_run=False,
        )

    def _require_client(self) -> Client:
        if self.client is None:
            raise RuntimeError("Supabase client is unavailable in DRY_RUN mode")
        return self.client

    def _with_user_id(self, records: list[dict[str, Any]]) -> list[dict[str, Any]]:
        return [serialize_value({**record, "user_id": self.user_id}) for record in records]

    def _upsert(self, table: str, records: list[dict[str, Any]], on_conflict: str) -> list[dict[str, Any]]:
        if not records:
            logger.info("No records to upsert into %s", table)
            return []

        payload = self._with_user_id(records)
        if self.dry_run:
            logger.info("DRY_RUN: would upsert %d records into %s", len(payload), table)
            return payload

        response = (
            self._require_client()
            .table(table)
            .upsert(payload, on_conflict=on_conflict)
            .execute()
        )
        logger.info("Upserted %d records into %s", len(payload), table)
        return response.data or []

    def upsert_holdings(self, records: list[dict[str, Any]]) -> list[dict[str, Any]]:
        return self._upsert("holdings", records, on_conflict="user_id,ticker")

    def upsert_related_assets(self, records: list[dict[str, Any]]) -> list[dict[str, Any]]:
        if not records:
            logger.info("No related assets to sync")
            return []

        payload = self._with_user_id(records)
        holding_tickers = sorted({record["holding_ticker"] for record in payload})

        if self.dry_run:
            logger.info(
                "DRY_RUN: would replace related_assets for %d holdings with %d records",
                len(holding_tickers),
                len(payload),
            )
            return payload

        client = self._require_client()
        client.table("related_assets").delete().eq("user_id", self.user_id).in_(
            "holding_ticker", holding_tickers
        ).execute()
        response = client.table("related_assets").insert(payload).execute()
        logger.info("Synced %d related_assets records", len(payload))
        return response.data or []

    def upsert_news_items(self, records: list[dict[str, Any]]) -> list[dict[str, Any]]:
        return self._upsert("news_items", records, on_conflict="user_id,content_hash")

    def upsert_sec_filings(self, records: list[dict[str, Any]]) -> list[dict[str, Any]]:
        return self._upsert("sec_filings", records, on_conflict="user_id,ticker,accession_number")

    def upsert_daily_report(self, record: dict[str, Any]) -> list[dict[str, Any]]:
        return self._upsert("daily_reports", [record], on_conflict="user_id,report_date")

    def upsert_price_snapshots(self, records: list[dict[str, Any]]) -> list[dict[str, Any]]:
        return self._upsert("price_snapshots", records, on_conflict="user_id,ticker,snapshot_date")

    def fetch_report_context(self, report_date: date) -> dict[str, list[dict[str, Any]]]:
        if self.dry_run:
            return {"holdings": [], "prices": [], "news": [], "filings": []}

        client = self._require_client()
        news_start = (report_date - timedelta(days=2)).isoformat()
        start = report_date.isoformat()
        end = (report_date + timedelta(days=1)).isoformat()

        holdings = (
            client.table("holdings")
            .select("*")
            .eq("user_id", self.user_id)
            .eq("is_active", True)
            .order("ticker")
            .execute()
            .data
            or []
        )
        prices = (
            client.table("price_snapshots")
            .select("*")
            .eq("user_id", self.user_id)
            .eq("snapshot_date", start)
            .order("ticker")
            .execute()
            .data
            or []
        )
        news = (
            client.table("news_items")
            .select("*")
            .eq("user_id", self.user_id)
            .gte("published_at", f"{news_start}T00:00:00+00:00")
            .lt("published_at", f"{end}T00:00:00+00:00")
            .order("published_at", desc=True)
            .execute()
            .data
            or []
        )
        filings = (
            client.table("sec_filings")
            .select("*")
            .eq("user_id", self.user_id)
            .gte("filed_at", start)
            .lt("filed_at", end)
            .order("filed_at", desc=True)
            .execute()
            .data
            or []
        )
        return {"holdings": holdings, "prices": prices, "news": news, "filings": filings}
