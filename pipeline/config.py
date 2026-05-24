from __future__ import annotations

import os
from dataclasses import dataclass
from datetime import date, datetime
from pathlib import Path
from typing import Any

import yaml
from dotenv import load_dotenv


class ConfigError(RuntimeError):
    """Raised when required runtime configuration is missing or invalid."""


@dataclass(frozen=True, slots=True)
class AppConfig:
    supabase_url: str | None
    supabase_service_role_key: str | None
    user_id: str
    watchlist_path: Path
    watchlist: dict[str, Any]
    report_date: date
    dry_run: bool
    sec_user_agent: str


def parse_bool(value: str | None, default: bool = False) -> bool:
    if value is None or value == "":
        return default
    return value.strip().lower() in {"1", "true", "yes", "y", "on"}


def _read_yaml(path: Path) -> dict[str, Any]:
    if not path.exists():
        raise ConfigError(f"Watchlist file not found: {path}")
    with path.open("r", encoding="utf-8") as handle:
        data = yaml.safe_load(handle) or {}
    if not isinstance(data, dict):
        raise ConfigError("watchlist.yaml must contain a YAML mapping at the top level")
    if not isinstance(data.get("holdings"), dict) or not data["holdings"]:
        raise ConfigError("watchlist.yaml must define at least one holding under holdings")
    return data


def _report_date_from_env(value: str | None) -> date:
    if not value:
        return datetime.now().date()
    try:
        return date.fromisoformat(value)
    except ValueError as exc:
        raise ConfigError("REPORT_DATE must use YYYY-MM-DD format") from exc


def load_config() -> AppConfig:
    load_dotenv()

    dry_run = parse_bool(os.getenv("DRY_RUN"), default=False)
    watchlist_path = Path(os.getenv("WATCHLIST_PATH", "watchlist.yaml")).expanduser()
    watchlist = _read_yaml(watchlist_path)

    user_env_name = (
        watchlist.get("user", {}).get("default_user_id_env")
        if isinstance(watchlist.get("user"), dict)
        else None
    ) or "SUPABASE_USER_ID"
    user_id = os.getenv(user_env_name) or os.getenv("SUPABASE_USER_ID")
    if not user_id:
        raise ConfigError(f"Missing required user id env var: {user_env_name}")

    supabase_url = os.getenv("SUPABASE_URL")
    supabase_service_role_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not dry_run and (not supabase_url or not supabase_service_role_key):
        raise ConfigError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required unless DRY_RUN=true")

    return AppConfig(
        supabase_url=supabase_url,
        supabase_service_role_key=supabase_service_role_key,
        user_id=user_id,
        watchlist_path=watchlist_path,
        watchlist=watchlist,
        report_date=_report_date_from_env(os.getenv("REPORT_DATE")),
        dry_run=dry_run,
        sec_user_agent=os.getenv("SEC_USER_AGENT", "InvestmentIntel/0.1 contact@example.com"),
    )


def normalize_ticker(ticker: str) -> str:
    return ticker.strip().upper()


def get_holdings(watchlist: dict[str, Any]) -> dict[str, dict[str, Any]]:
    holdings = watchlist.get("holdings", {})
    return holdings if isinstance(holdings, dict) else {}


def get_primary_tickers(watchlist: dict[str, Any]) -> list[str]:
    return sorted(normalize_ticker(ticker) for ticker in get_holdings(watchlist))


def get_all_tickers(watchlist: dict[str, Any]) -> list[str]:
    tickers: set[str] = set(get_primary_tickers(watchlist))
    for holding_cfg in get_holdings(watchlist).values():
        for ticker in holding_cfg.get("related_tickers", []) or []:
            if isinstance(ticker, str) and ticker.strip():
                tickers.add(normalize_ticker(ticker))
    return sorted(tickers)


def build_holding_records(watchlist: dict[str, Any]) -> list[dict[str, Any]]:
    records_by_ticker: dict[str, dict[str, Any]] = {}
    for ticker, holding_cfg in get_holdings(watchlist).items():
        normalized = normalize_ticker(ticker)
        records_by_ticker[normalized] = {
            "ticker": normalized,
            "name": holding_cfg.get("name"),
            "market": holding_cfg.get("market", "US"),
            "position_type": holding_cfg.get("position_type", "holding"),
            "weight": holding_cfg.get("weight"),
            "note": holding_cfg.get("note"),
            "is_active": holding_cfg.get("is_active", True),
        }

    for ticker, holding_cfg in get_holdings(watchlist).items():
        parent = normalize_ticker(ticker)
        for related_ticker in holding_cfg.get("related_tickers", []) or []:
            normalized_related = normalize_ticker(str(related_ticker))
            records_by_ticker.setdefault(
                normalized_related,
                {
                    "ticker": normalized_related,
                    "name": normalized_related,
                    "market": "US",
                    "position_type": "related",
                    "weight": None,
                    "note": f"Related to {parent}",
                    "is_active": True,
                },
            )

    return sorted(records_by_ticker.values(), key=lambda item: item["ticker"])


def build_related_asset_records(watchlist: dict[str, Any]) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    for ticker, holding_cfg in get_holdings(watchlist).items():
        holding_ticker = normalize_ticker(ticker)
        for related_ticker in holding_cfg.get("related_tickers", []) or []:
            normalized_related = normalize_ticker(str(related_ticker))
            records.append(
                {
                    "holding_ticker": holding_ticker,
                    "related_name": normalized_related,
                    "related_ticker": normalized_related,
                    "relation_type": "related_ticker",
                    "importance": 3,
                    "note": None,
                }
            )

        for entity in holding_cfg.get("related_entities", []) or []:
            if not isinstance(entity, dict) or not entity.get("name"):
                continue
            records.append(
                {
                    "holding_ticker": holding_ticker,
                    "related_name": entity["name"],
                    "related_ticker": entity.get("ticker"),
                    "relation_type": entity.get("type"),
                    "importance": entity.get("importance", 3),
                    "note": entity.get("note"),
                }
            )
    return records

