from __future__ import annotations

from datetime import date, datetime
from typing import Any


def generate_markdown_report(
    report_date: date,
    holdings: list[dict[str, Any]],
    prices: list[dict[str, Any]],
    news_items: list[dict[str, Any]],
    filings: list[dict[str, Any]],
) -> tuple[str, dict[str, int]]:
    counts = impact_counts(news_items, filings)
    lines: list[str] = [
        f"# 每日持仓情报日报 - {report_date.isoformat()}",
        "",
        "## 总览",
        f"- 高影响事件数量：{counts['high']}",
        f"- 中影响事件数量：{counts['medium']}",
        f"- 低影响事件数量：{counts['low']}",
        "",
        "## 持仓与相关资产价格",
    ]

    if prices:
        for price in sorted(prices, key=lambda item: item.get("ticker") or ""):
            ticker = price.get("ticker", "N/A")
            close = _format_number(price.get("close"))
            change_pct = _format_pct(price.get("change_pct"))
            snapshot_date = price.get("snapshot_date") or price.get("date") or ""
            lines.append(f"- **{ticker}**：收盘 {close}，涨跌幅 {change_pct}（{snapshot_date}）")
    else:
        lines.append("- 今日未获取到价格快照。")

    lines.extend(["", "## 高影响事件"])
    high_news = [item for item in news_items if item.get("impact_level") == "high"]
    if high_news:
        for item in high_news:
            lines.extend(_news_block(item))
    else:
        lines.append("- 今日未识别到高影响新闻事件。")

    lines.extend(["", "## 按持仓分类"])
    primary_holdings = [item for item in holdings if item.get("position_type") != "related"]
    if not primary_holdings:
        primary_holdings = holdings

    for holding in sorted(primary_holdings, key=lambda item: item.get("ticker") or ""):
        ticker = holding.get("ticker")
        if not ticker:
            continue
        lines.extend(["", f"### {ticker}"])
        holding_prices = [price for price in prices if price.get("ticker") == ticker]
        if holding_prices:
            for price in holding_prices:
                lines.append(
                    f"- 价格：收盘 {_format_number(price.get('close'))}，涨跌幅 {_format_pct(price.get('change_pct'))}"
                )
        else:
            lines.append("- 价格：今日未获取。")

        related_news = [
            item for item in news_items if ticker in (item.get("related_holdings") or [])
        ]
        if related_news:
            lines.append("- 相关新闻：")
            for item in related_news[:8]:
                lines.append(
                    f"  - [{item.get('title', 'Untitled')}]({item.get('url', '')})"
                    f"（{item.get('impact_direction', 'unknown')}/{item.get('impact_level', 'low')}）"
                )
        else:
            lines.append("- 相关新闻：今日未获取到相关新闻。")

        related_filings = [item for item in filings if item.get("ticker") == ticker]
        if related_filings:
            lines.append("- SEC filing：")
            for filing in related_filings:
                lines.append(
                    f"  - {filing.get('filing_type')} {filing.get('filed_at') or ''}"
                    f"：{filing.get('reason') or '需要人工复核'}"
                )
        else:
            lines.append("- SEC filing：今日未获取到新增 filing。")

    lines.extend(["", "## SEC Filings"])
    if filings:
        for filing in sorted(filings, key=lambda item: (item.get("ticker") or "", item.get("filed_at") or "")):
            title = f"{filing.get('ticker')} {filing.get('filing_type')} {filing.get('filed_at') or ''}".strip()
            url = filing.get("report_url")
            if url:
                lines.append(f"- [{title}]({url})：{filing.get('reason') or '需要人工复核'}")
            else:
                lines.append(f"- {title}：{filing.get('reason') or '需要人工复核'}")
    else:
        lines.append("- 今日未获取到新增 SEC filing。")

    lines.extend(
        [
            "",
            "## 注意",
            "本日报仅用于信息整理，不构成投资建议，也不包含任何自动交易指令。",
            "",
        ]
    )
    return "\n".join(lines), counts


def impact_counts(news_items: list[dict[str, Any]], filings: list[dict[str, Any]]) -> dict[str, int]:
    counts = {"high": 0, "medium": 0, "low": 0}
    for item in [*news_items, *filings]:
        level = item.get("impact_level", "low")
        if level in counts:
            counts[level] += 1
    return counts


def _news_block(item: dict[str, Any]) -> list[str]:
    return [
        "",
        f"### {item.get('title', 'Untitled')}",
        f"- 来源：{item.get('source') or '未知'}",
        f"- 时间：{_format_datetime(item.get('published_at') or item.get('fetched_at'))}",
        f"- 相关持仓：{', '.join(item.get('related_holdings') or []) or '未识别'}",
        f"- 影响方向：{item.get('impact_direction', 'unknown')}",
        f"- 影响级别：{item.get('impact_level', 'low')}",
        f"- 原因：{item.get('reason') or '无'}",
        f"- URL：{item.get('url') or ''}",
    ]


def _format_number(value: Any) -> str:
    try:
        return f"{float(value):.2f}"
    except (TypeError, ValueError):
        return "N/A"


def _format_pct(value: Any) -> str:
    try:
        return f"{float(value):+.2f}%"
    except (TypeError, ValueError):
        return "N/A"


def _format_datetime(value: Any) -> str:
    if isinstance(value, datetime):
        return value.isoformat()
    return str(value or "未知")

