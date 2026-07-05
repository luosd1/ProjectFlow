import hmac
from typing import Annotated

from fastapi import Header, HTTPException

from app.core.config import settings


def require_demo_admin_access(
    x_projectflow_admin_token: Annotated[
        str | None,
        Header(alias="X-ProjectFlow-Admin-Token"),
    ] = None,
) -> None:
    """Protect destructive demo endpoints outside the local development loop."""
    if settings.app_env == "development":
        return

    expected_token = settings.demo_admin_token.get_secret_value() if settings.demo_admin_token else None
    if not expected_token:
        raise HTTPException(
            status_code=403,
            detail="Demo admin endpoints are disabled outside development",
        )
    if x_projectflow_admin_token != expected_token:
        raise HTTPException(status_code=403, detail="Demo admin token required")


def require_internal_service_access(
    authorization: Annotated[
        str | None,
        Header(alias="Authorization"),
    ] = None,
) -> None:
    """Protect sidecar-facing internal endpoints with a bearer service token."""
    expected_token = settings.internal_service_token.get_secret_value() if settings.internal_service_token else None
    if not expected_token:
        raise HTTPException(status_code=403, detail="Internal service token is not configured")

    prefix = "Bearer "
    if authorization is None or not authorization.startswith(prefix):
        raise HTTPException(status_code=403, detail="Internal service token required")

    token = authorization.removeprefix(prefix)
    if not hmac.compare_digest(token, expected_token):
        raise HTTPException(status_code=403, detail="Invalid internal service token")
