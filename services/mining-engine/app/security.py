"""Fail-closed internal service authentication for mining-engine.

The token is a server-side machine credential; user/project authorization is
enforced by the calling GeoCapitals gateway before this service is invoked.
"""
from __future__ import annotations

import hmac
import os

from fastapi import HTTPException


def require_engine_auth(authorization: str | None) -> None:
    """Reject all protected requests unless MINING_ENGINE_TOKEN is configured.

    No implicit development bypass: local tests configure their own token.
    Configuration mistakes yield 503, and invalid client credentials yield 401.
    """
    token = os.environ.get("MINING_ENGINE_TOKEN", "")
    if not token or not token.strip():
        raise HTTPException(status_code=503, detail="engine_auth_not_configured")

    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="unauthorized")

    supplied = authorization[len("Bearer "):]
    if not supplied or not hmac.compare_digest(
        supplied.encode("utf-8"), token.encode("utf-8")
    ):
        raise HTTPException(status_code=401, detail="unauthorized")
