from pydantic import BaseModel, ConfigDict, Field

from app.schemas.common import NonEmptyStr


class LLMDiagnosticRequest(BaseModel):
    """Optional body for the diagnostic endpoint.

    Runtime API keys are intentionally not accepted here. Configure LLM_API_KEY in
    the backend environment, then use this request to override non-secret settings
    for a one-off connectivity check.
    """

    model_config = ConfigDict(extra="forbid")

    provider: NonEmptyStr | None = None
    base_url: NonEmptyStr | None = None
    model: NonEmptyStr | None = None
    timeout_seconds: float | None = Field(default=None, gt=0)


class LLMDiagnosticResponse(BaseModel):
    """Safe diagnostic result — never includes the API key."""

    provider: str
    model: str
    base_url: str
    status: str  # "ok" | "error" | "mock"
    detail: str = ""
