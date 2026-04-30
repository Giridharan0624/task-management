"""Shared REST client used by both Freshdesk and Freshservice.

Authentication is HTTP Basic with `apikey:X` (the `X` is literal — Freshworks
uses the password slot as a fixed sentinel). Stays on stdlib `urllib` to
match the rest of the codebase (no httpx/requests dependency).

Rate-limit handling:
  - Reads `Retry-After` on 429 and sleeps (bounded) before retrying.
  - Surfaces `X-RateLimit-*` headers in the returned RateLimitInfo so callers
    can decide to back off proactively.
  - Maximum 3 retries on 429 / 5xx; raises on the final failure.

Pagination:
  - Honors the `Link: <...>; rel="next"` header. Helper `paginate()` yields
    pages until exhausted, which the worker uses for initial sync (Phase 1c+).
"""
from __future__ import annotations

import base64
import json
import logging
import time
import urllib.error
import urllib.request
from typing import Any, Iterable, Optional


log = logging.getLogger(__name__)


class FreshworksAuthError(RuntimeError):
    """Raised on 401 — the integration's stored credentials are invalid /
    revoked. The platform reacts by marking the integration NEEDS_REAUTH."""


class FreshworksRateLimitError(RuntimeError):
    """Raised when retries on 429 are exhausted."""


class FreshworksHttpError(RuntimeError):
    def __init__(self, status: int, body: str):
        super().__init__(f"freshworks http {status}: {body[:200]}")
        self.status = status
        self.body = body


class RateLimitInfo:
    def __init__(self, total: Optional[int], remaining: Optional[int], used: Optional[int]):
        self.total = total
        self.remaining = remaining
        self.used = used


class FreshworksResponse:
    def __init__(self, status: int, headers: dict[str, str], body: bytes):
        self.status = status
        self.headers = {k.lower(): v for k, v in headers.items()}
        self.body = body

    def json(self) -> Any:
        return json.loads(self.body.decode("utf-8")) if self.body else None

    def rate_limit(self) -> RateLimitInfo:
        def _i(name: str) -> Optional[int]:
            v = self.headers.get(name.lower())
            try:
                return int(v) if v is not None else None
            except ValueError:
                return None
        return RateLimitInfo(
            total=_i("X-RateLimit-Total"),
            remaining=_i("X-RateLimit-Remaining"),
            used=_i("X-RateLimit-Used-CurrentRequest"),
        )

    def next_link(self) -> Optional[str]:
        link = self.headers.get("link")
        if not link:
            return None
        # Format: <url>; rel="next", <url>; rel="prev"
        for part in link.split(","):
            sect = part.strip()
            if 'rel="next"' in sect:
                lhs = sect.split(";")[0].strip()
                return lhs.strip("<>")
        return None


class FreshworksRestClient:
    """One client per (subdomain, product) — caller owns the lifecycle."""

    def __init__(self, *, subdomain: str, api_key: str, product: str = "freshdesk"):
        if product not in ("freshdesk", "freshservice"):
            raise ValueError(f"unsupported product: {product}")
        self.subdomain = subdomain
        self.product = product
        self._api_key = api_key
        host = "freshdesk.com" if product == "freshdesk" else "freshservice.com"
        self._base_url = f"https://{subdomain}.{host}/api/v2"
        token = base64.b64encode(f"{api_key}:X".encode("utf-8")).decode("ascii")
        self._auth_header = f"Basic {token}"

    def get(self, path: str, *, params: Optional[dict] = None, timeout: int = 15) -> FreshworksResponse:
        return self._request("GET", path, params=params, timeout=timeout)

    def put(self, path: str, *, body: dict, timeout: int = 15) -> FreshworksResponse:
        return self._request("PUT", path, body=body, timeout=timeout)

    def post(self, path: str, *, body: dict, timeout: int = 15) -> FreshworksResponse:
        return self._request("POST", path, body=body, timeout=timeout)

    def paginate(self, path: str, *, params: Optional[dict] = None) -> Iterable[FreshworksResponse]:
        url: Optional[str] = self._build_url(path, params)
        while url is not None:
            response = self._request_url("GET", url)
            yield response
            url = response.next_link()

    # ── internals ──────────────────────────────────────────────────────

    def _request(
        self,
        method: str,
        path: str,
        *,
        params: Optional[dict] = None,
        body: Optional[dict] = None,
        timeout: int = 15,
    ) -> FreshworksResponse:
        url = self._build_url(path, params)
        return self._request_url(method, url, body=body, timeout=timeout)

    def _request_url(
        self,
        method: str,
        url: str,
        *,
        body: Optional[dict] = None,
        timeout: int = 15,
        max_retries: int = 3,
    ) -> FreshworksResponse:
        attempt = 0
        while True:
            attempt += 1
            data = json.dumps(body).encode("utf-8") if body is not None else None
            req = urllib.request.Request(url, data=data, method=method)
            req.add_header("Authorization", self._auth_header)
            req.add_header("Content-Type", "application/json")
            req.add_header("Accept", "application/json")

            try:
                with urllib.request.urlopen(req, timeout=timeout) as resp:
                    return FreshworksResponse(
                        status=resp.status,
                        headers=dict(resp.headers.items()),
                        body=resp.read(),
                    )
            except urllib.error.HTTPError as e:
                payload = e.read() if hasattr(e, "read") else b""
                headers = dict(e.headers.items()) if e.headers else {}
                if e.code == 401:
                    raise FreshworksAuthError("freshworks rejected the api key") from None
                if e.code == 429:
                    if attempt > max_retries:
                        raise FreshworksRateLimitError(
                            f"rate limited; gave up after {max_retries} retries"
                        ) from None
                    sleep_for = _parse_retry_after(headers, default=5)
                    log.info("freshworks 429; sleeping %ss before retry %d", sleep_for, attempt)
                    time.sleep(min(sleep_for, 30))
                    continue
                if 500 <= e.code < 600 and attempt <= max_retries:
                    backoff = min(2 ** attempt, 8)
                    log.info("freshworks %d; backing off %ss", e.code, backoff)
                    time.sleep(backoff)
                    continue
                raise FreshworksHttpError(e.code, payload.decode("utf-8", errors="replace"))
            except urllib.error.URLError as e:
                if attempt <= max_retries:
                    backoff = min(2 ** attempt, 8)
                    log.info("freshworks url error %s; backing off %ss", e, backoff)
                    time.sleep(backoff)
                    continue
                raise

    def _build_url(self, path: str, params: Optional[dict]) -> str:
        from urllib.parse import urlencode

        if not path.startswith("/"):
            path = "/" + path
        url = f"{self._base_url}{path}"
        if params:
            url = f"{url}?{urlencode(params, doseq=True)}"
        return url


def _parse_retry_after(headers: dict[str, str], *, default: int) -> int:
    raw = headers.get("Retry-After") or headers.get("retry-after")
    if raw is None:
        return default
    try:
        return max(1, int(raw))
    except ValueError:
        return default
