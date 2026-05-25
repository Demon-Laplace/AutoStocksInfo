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

    def __init__(self, timeout: int = 20, history_period: str = "1y", interval: str = "1d") -> None:
        self.timeout = timeout
        self.history_period = history_period
        self.interval = interval

    def fetch_price(self, ticker: str, report_date: date) -> PriceSnapshot | None:
        snapshots = self.fetch_price_history(ticker, report_date)
        return snapshots[-1] if snapshots else None

    def fetch_price_history(self, ticker: str, report_date: date) -> list[PriceSnapshot]:
        try:
            history = yf.download(
                tickers=ticker,
                period=self.history_period,
                interval=self.interval,
                auto_adjust=False,
                progress=False,
                threads=False,
                timeout=self.timeout,
            )
        except Exception as exc:  # noqa: BLE001 - yfinance raises several exception types.
            logger.warning("Failed to fetch price for %s from yfinance: %s", ticker, exc)
            return []

        if history.empty:
            logger.warning("No price history returned for %s", ticker)
            return []

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
            return []

        rsi_values = _calculate_rsi(history["Close"])
        snapshots: list[PriceSnapshot] = []
        previous_close: float | None = None

        for index_value, row in history.iterrows():
            close = _safe_float(row.get("Close"))
            if close is None:
                continue

            change_pct = None
            if previous_close not in (None, 0):
                change_pct = ((close - previous_close) / previous_close) * 100

            snapshot_date = index_value.date() if hasattr(index_value, "date") else report_date
            rsi = _safe_float(rsi_values.get(index_value))
            snapshots.append(
                PriceSnapshot(
                    ticker=ticker,
                    snapshot_date=snapshot_date,
                    open=_safe_float(row.get("Open")),
                    high=_safe_float(row.get("High")),
                    low=_safe_float(row.get("Low")),
                    close=close,
                    previous_close=previous_close,
                    change_pct=change_pct,
                    volume=_safe_float(row.get("Volume")),
                    source=self.source,
                    rsi=rsi,
                )
            )
            previous_close = close

        if snapshots:
            pe_ratio, options_trend = self._fetch_current_indicators(ticker)
            snapshots[-1].pe_ratio = pe_ratio
            snapshots[-1].options_trend = options_trend

        return snapshots

    def _fetch_current_indicators(self, ticker: str) -> tuple[float | None, str | None]:
        ticker_obj = yf.Ticker(ticker)
        return _fetch_pe_ratio(ticker_obj), _summarize_options_trend(ticker_obj)


def _safe_float(value: object) -> float | None:
    if value is None or pd.isna(value):
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _calculate_rsi(closes: pd.Series, period: int = 14) -> pd.Series:
    numeric_closes = pd.to_numeric(closes, errors="coerce")
    delta = numeric_closes.diff()
    gains = delta.clip(lower=0)
    losses = -delta.clip(upper=0)
    average_gain = gains.rolling(window=period, min_periods=period).mean()
    average_loss = losses.rolling(window=period, min_periods=period).mean()
    relative_strength = average_gain / average_loss
    rsi = 100 - (100 / (1 + relative_strength))
    rsi = rsi.where(average_loss != 0, 100)
    return rsi.where(~((average_gain == 0) & (average_loss == 0)), 50)


def _fetch_pe_ratio(ticker_obj: yf.Ticker) -> float | None:
    try:
        get_info = getattr(ticker_obj, "get_info", None)
        info = get_info() if callable(get_info) else ticker_obj.info
    except Exception as exc:  # noqa: BLE001 - yfinance metadata calls can fail independently.
        logger.warning("Failed to fetch valuation metadata from yfinance: %s", exc)
        return None

    if not isinstance(info, dict):
        return None

    for key in ("trailingPE", "forwardPE"):
        value = _safe_float(info.get(key))
        if value is not None and value > 0:
            return value
    return None


def _summarize_options_trend(ticker_obj: yf.Ticker) -> str | None:
    try:
        expirations = list(ticker_obj.options or [])
    except Exception as exc:  # noqa: BLE001
        logger.warning("Failed to fetch option expirations from yfinance: %s", exc)
        return None

    if not expirations:
        return None

    try:
        chain = ticker_obj.option_chain(expirations[0])
    except Exception as exc:  # noqa: BLE001
        logger.warning("Failed to fetch option chain from yfinance: %s", exc)
        return None

    call_volume = _sum_numeric_column(chain.calls, "volume")
    put_volume = _sum_numeric_column(chain.puts, "volume")
    call_open_interest = _sum_numeric_column(chain.calls, "openInterest")
    put_open_interest = _sum_numeric_column(chain.puts, "openInterest")
    volume_ratio = _safe_ratio(call_volume, put_volume)
    open_interest_ratio = _safe_ratio(call_open_interest, put_open_interest)

    direction = _options_direction(volume_ratio, open_interest_ratio)
    ratio_parts = []
    if volume_ratio is not None:
        ratio_parts.append(f"C/P volume {_format_ratio(volume_ratio)}")
    if open_interest_ratio is not None:
        ratio_parts.append(f"C/P OI {_format_ratio(open_interest_ratio)}")
    return f"{direction}; {', '.join(ratio_parts)}" if ratio_parts else direction


def _sum_numeric_column(frame: pd.DataFrame, column: str) -> float | None:
    if column not in frame:
        return None
    series = pd.to_numeric(frame[column], errors="coerce")
    if series.notna().sum() == 0:
        return None
    return float(series.fillna(0).sum())


def _safe_ratio(numerator: float | None, denominator: float | None) -> float | None:
    if numerator is None or denominator is None:
        return None
    if denominator == 0:
        return float("inf") if numerator > 0 else None
    return numerator / denominator


def _options_direction(volume_ratio: float | None, open_interest_ratio: float | None) -> str:
    primary_ratio = volume_ratio if volume_ratio is not None else open_interest_ratio
    if primary_ratio is None:
        return "options data available, trend unclear"
    if primary_ratio >= 1.2:
        return "call activity leading"
    if primary_ratio <= 0.83:
        return "put activity leading"
    return "call and put activity balanced"


def _format_ratio(value: float) -> str:
    if value == float("inf"):
        return "inf"
    return f"{value:.2f}"


def fetch_prices(
    tickers: list[str],
    report_date: date,
    provider: PriceProvider | None = None,
) -> list[PriceSnapshot]:
    price_provider = provider or YFinancePriceProvider()
    snapshots: list[PriceSnapshot] = []
    for ticker in sorted(set(tickers)):
        history_fetcher = getattr(price_provider, "fetch_price_history", None)
        if callable(history_fetcher):
            ticker_snapshots = history_fetcher(ticker, report_date)
            snapshots.extend(ticker_snapshots)
            continue

        snapshot = price_provider.fetch_price(ticker, report_date)
        if snapshot is not None:
            snapshots.append(snapshot)
    logger.info("Fetched %d price history rows", len(snapshots))
    return snapshots
