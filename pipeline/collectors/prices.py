from __future__ import annotations

import logging
from datetime import date
from typing import Protocol

import pandas as pd
import yfinance as yf

from pipeline.models import PriceSnapshot

logger = logging.getLogger(__name__)


class PriceProvider(Protocol):
    def fetch_price(self, ticker: str, report_date: date) -> PriceSnapshot | None:
        ...


class YFinancePriceProvider:
    source = "yfinance"

    def __init__(self, timeout: int = 20) -> None:
        self.timeout = timeout

    def fetch_price(self, ticker: str, report_date: date) -> PriceSnapshot | None:
        try:
            history = yf.download(
                tickers=ticker,
                period="7d",
                interval="1d",
                auto_adjust=False,
                progress=False,
                threads=False,
                timeout=self.timeout,
            )
        except Exception as exc:  # noqa: BLE001 - yfinance raises several exception types.
            logger.warning("Failed to fetch price for %s from yfinance: %s", ticker, exc)
            return None

        if history.empty:
            logger.warning("No price history returned for %s", ticker)
            return None

        if isinstance(history.columns, pd.MultiIndex):
            if ticker in history.columns.get_level_values(-1):
                history = history.xs(ticker, axis=1, level=-1, drop_level=True)
            elif ticker in history.columns.get_level_values(0):
                history = history.xs(ticker, axis=1, level=0, drop_level=True)
            else:
                history.columns = history.columns.get_level_values(0)

        history = history.dropna(subset=["Close"])
        if history.empty:
            logger.warning("No usable close price returned for %s", ticker)
            return None

        latest = history.iloc[-1]
        previous_close = None
        if len(history) >= 2:
            previous_close = _safe_float(history.iloc[-2].get("Close"))
        else:
            previous_close = _safe_float(latest.get("Close"))

        close = _safe_float(latest.get("Close"))
        change_pct = None
        if close is not None and previous_close not in (None, 0):
            change_pct = ((close - previous_close) / previous_close) * 100

        index_value = history.index[-1]
        snapshot_date = index_value.date() if hasattr(index_value, "date") else report_date

        return PriceSnapshot(
            ticker=ticker,
            snapshot_date=snapshot_date,
            open=_safe_float(latest.get("Open")),
            high=_safe_float(latest.get("High")),
            low=_safe_float(latest.get("Low")),
            close=close,
            previous_close=previous_close,
            change_pct=change_pct,
            volume=_safe_float(latest.get("Volume")),
            source=self.source,
        )


def _safe_float(value: object) -> float | None:
    if value is None or pd.isna(value):
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def fetch_prices(
    tickers: list[str],
    report_date: date,
    provider: PriceProvider | None = None,
) -> list[PriceSnapshot]:
    price_provider = provider or YFinancePriceProvider()
    snapshots: list[PriceSnapshot] = []
    for ticker in sorted(set(tickers)):
        snapshot = price_provider.fetch_price(ticker, report_date)
        if snapshot is not None:
            snapshots.append(snapshot)
    logger.info("Fetched %d price snapshots", len(snapshots))
    return snapshots
