from __future__ import annotations

import logging
from datetime import date, timedelta
from typing import Any

import requests

from pipeline.models import SecFiling

logger = logging.getLogger(__name__)

SEC_COMPANY_TICKERS_URL = "https://www.sec.gov/files/company_tickers.json"
SEC_SUBMISSIONS_URL = "https://data.sec.gov/submissions/CIK{cik}.json"
TRACKED_FORMS = {"10-K", "10-Q", "8-K", "S-1", "S-3", "424B", "13F-HR", "4"}


def fetch_sec_filings(
    tickers: list[str],
    report_date: date,
    user_agent: str,
    lookback_days: int = 3,
    timeout: int = 20,
) -> list[SecFiling]:
    mapping = fetch_cik_mapping(user_agent=user_agent, timeout=timeout)
    since_date = report_date - timedelta(days=lookback_days)
    filings: list[SecFiling] = []

    for ticker in sorted(set(tickers)):
        ticker_key = ticker.upper()
        mapped = mapping.get(ticker_key)
        if not mapped:
            logger.warning("No SEC CIK mapping found for %s; skipping", ticker_key)
            continue

        cik, company_name = mapped
        try:
            response = requests.get(
                SEC_SUBMISSIONS_URL.format(cik=cik),
                timeout=timeout,
                headers={"User-Agent": user_agent, "Accept-Encoding": "gzip, deflate"},
            )
            response.raise_for_status()
            data = response.json()
        except requests.RequestException as exc:
            logger.warning("Failed to fetch SEC submissions for %s: %s", ticker_key, exc)
            continue

        filings.extend(_parse_recent_filings(ticker_key, company_name, cik, data, since_date))

    logger.info("Fetched %d SEC filings", len(filings))
    return filings


def fetch_cik_mapping(user_agent: str, timeout: int = 20) -> dict[str, tuple[str, str | None]]:
    try:
        response = requests.get(
            SEC_COMPANY_TICKERS_URL,
            timeout=timeout,
            headers={"User-Agent": user_agent, "Accept-Encoding": "gzip, deflate"},
        )
        response.raise_for_status()
        raw_data: dict[str, Any] = response.json()
    except requests.RequestException as exc:
        logger.warning("Failed to fetch SEC ticker mapping: %s", exc)
        return {}

    mapping: dict[str, tuple[str, str | None]] = {}
    for item in raw_data.values():
        ticker = str(item.get("ticker", "")).upper()
        cik_value = item.get("cik_str")
        if not ticker or cik_value is None:
            continue
        mapping[ticker] = (str(cik_value).zfill(10), item.get("title"))
    return mapping


def _parse_recent_filings(
    ticker: str,
    company_name: str | None,
    cik: str,
    data: dict[str, Any],
    since_date: date,
) -> list[SecFiling]:
    recent = data.get("filings", {}).get("recent", {})
    forms = recent.get("form", []) or []
    filing_dates = recent.get("filingDate", []) or []
    accession_numbers = recent.get("accessionNumber", []) or []
    primary_documents = recent.get("primaryDocument", []) or []

    filings: list[SecFiling] = []
    for index, form in enumerate(forms):
        form_value = str(form).upper().strip()
        if form_value not in TRACKED_FORMS and not form_value.startswith("424B"):
            continue

        filed_at = _safe_date(_get_at(filing_dates, index))
        if filed_at is not None and filed_at < since_date:
            continue

        accession_number = _get_at(accession_numbers, index)
        primary_document = _get_at(primary_documents, index)
        report_url = _filing_url(cik, accession_number, primary_document)
        filing_type = "Form 4" if form_value == "4" else form_value

        filings.append(
            SecFiling(
                ticker=ticker,
                company_name=company_name,
                cik=cik,
                filing_type=filing_type,
                accession_number=accession_number,
                filed_at=filed_at,
                report_url=report_url,
                summary=f"{ticker} filed {filing_type} on {filed_at.isoformat() if filed_at else 'unknown date'}",
            )
        )
    return filings


def _get_at(values: list[Any], index: int) -> Any:
    return values[index] if index < len(values) else None


def _safe_date(value: Any) -> date | None:
    if not value:
        return None
    try:
        return date.fromisoformat(str(value))
    except ValueError:
        return None


def _filing_url(cik: str, accession_number: str | None, primary_document: str | None) -> str | None:
    if not accession_number or not primary_document:
        return None
    accession_no_dashes = accession_number.replace("-", "")
    cik_no_leading_zeroes = str(int(cik))
    return (
        "https://www.sec.gov/Archives/edgar/data/"
        f"{cik_no_leading_zeroes}/{accession_no_dashes}/{primary_document}"
    )

