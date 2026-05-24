from __future__ import annotations

import hashlib
import re
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

TRACKING_PREFIXES = ("utm_",)
TRACKING_PARAMS = {"fbclid", "gclid", "mc_cid", "mc_eid", "ref", "src"}


def normalized_title(title: str) -> str:
    return re.sub(r"\s+", " ", title or "").strip().lower()


def canonical_url(url: str) -> str:
    parsed = urlparse(url.strip())
    query_pairs = []
    for key, value in parse_qsl(parsed.query, keep_blank_values=True):
        lower_key = key.lower()
        if lower_key in TRACKING_PARAMS or lower_key.startswith(TRACKING_PREFIXES):
            continue
        query_pairs.append((key, value))
    clean_query = urlencode(sorted(query_pairs), doseq=True)
    return urlunparse(
        (
            parsed.scheme.lower(),
            parsed.netloc.lower(),
            parsed.path.rstrip("/"),
            "",
            clean_query,
            "",
        )
    )


def content_hash(title: str, url: str) -> str:
    key = f"{normalized_title(title)}|{canonical_url(url)}"
    return hashlib.sha256(key.encode("utf-8")).hexdigest()

