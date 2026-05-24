from __future__ import annotations

from typing import Any

from pipeline.config import get_holdings, normalize_ticker
from pipeline.models import ImpactResult, RawNewsItem, RelevanceResult, SecFiling


def analyze_news_impact(
    item: RawNewsItem,
    relevance: RelevanceResult,
    watchlist: dict[str, Any],
) -> ImpactResult:
    text = " ".join([item.title, item.raw_excerpt or ""]).lower()
    positive_hits: list[str] = []
    negative_hits: list[str] = []

    for holding_ticker, holding_cfg in get_holdings(watchlist).items():
        ticker = normalize_ticker(holding_ticker)
        if ticker not in relevance.related_holdings:
            continue
        positive_hits.extend(_matched_keywords(text, holding_cfg.get("positive_keywords", []) or []))
        negative_hits.extend(_matched_keywords(text, holding_cfg.get("negative_keywords", []) or []))

    positive_hits = sorted(set(positive_hits))
    negative_hits = sorted(set(negative_hits))

    if positive_hits and negative_hits:
        direction = "mixed"
        reason = f"同时命中正面关键词：{', '.join(positive_hits)}；负面关键词：{', '.join(negative_hits)}。"
    elif positive_hits:
        direction = "positive"
        reason = f"命中正面关键词：{', '.join(positive_hits)}。"
    elif negative_hits:
        direction = "negative"
        reason = f"命中负面关键词：{', '.join(negative_hits)}。"
    elif relevance.themes or relevance.related_holdings:
        direction = "neutral"
        reason = "与持仓主题或相关资产有关，但未命中明确方向性关键词。"
    else:
        direction = "unknown"
        reason = "未识别出足够的持仓相关性。"

    hit_count = len(positive_hits) + len(negative_hits)
    if hit_count >= 2 or relevance.relevance_score >= 75:
        level = "high"
    elif hit_count == 1 or relevance.relevance_score >= 40:
        level = "medium"
    else:
        level = "low"

    if hit_count > 0 and relevance.relevance_score >= 50:
        confidence = "high"
    elif hit_count > 0 or relevance.relevance_score >= 40:
        confidence = "medium"
    else:
        confidence = "low"

    return ImpactResult(
        impact_direction=direction,
        impact_level=level,
        confidence=confidence,
        reason=reason,
    )


def analyze_filing_impact(filing: SecFiling) -> ImpactResult:
    filing_type = filing.filing_type.upper()
    if filing_type in {"S-1", "S-3"} or filing_type.startswith("424B"):
        return ImpactResult(
            impact_direction="negative",
            impact_level="high",
            confidence="medium",
            reason="融资或证券发行相关 filing，可能涉及稀释或资本结构变化，需要人工复核。",
        )
    if filing_type == "8-K":
        return ImpactResult(
            impact_direction="unknown",
            impact_level="medium",
            confidence="medium",
            reason="8-K 通常代表重大事项披露，需要查看原文判断方向。",
        )
    if filing_type in {"10-K", "10-Q"}:
        return ImpactResult(
            impact_direction="neutral",
            impact_level="medium",
            confidence="medium",
            reason="定期报告披露，重点关注业绩、风险因素和管理层讨论变化。",
        )
    if filing_type in {"13F-HR", "13F"}:
        return ImpactResult(
            impact_direction="neutral",
            impact_level="low",
            confidence="low",
            reason="机构持仓披露，通常滞后且方向性有限。",
        )
    if filing_type == "FORM 4":
        return ImpactResult(
            impact_direction="unknown",
            impact_level="medium",
            confidence="low",
            reason="内幕人交易披露，需要结合交易规模和身份人工判断。",
        )
    return ImpactResult(
        impact_direction="unknown",
        impact_level="low",
        confidence="low",
        reason="暂未配置该 filing 类型的方向性规则。",
    )


def apply_filing_impact(filings: list[SecFiling]) -> list[SecFiling]:
    for filing in filings:
        impact = analyze_filing_impact(filing)
        filing.impact_direction = impact.impact_direction
        filing.impact_level = impact.impact_level
        filing.reason = impact.reason
    return filings


def _matched_keywords(text: str, keywords: list[Any]) -> list[str]:
    matches: list[str] = []
    for keyword in keywords:
        keyword_text = " ".join(str(keyword).lower().split())
        if keyword_text and keyword_text in text:
            matches.append(str(keyword))
    return matches

