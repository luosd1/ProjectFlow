from datetime import date
from pydantic import BaseModel, Field, model_validator

from app.models.enums import StageStatus
from app.schemas.common import NonEmptyStr, reject_inverted_date_range


class StageCreate(BaseModel):
    project_id: NonEmptyStr
    name: NonEmptyStr
    goal: NonEmptyStr
    start_date: date
    end_date: date
    deliverable: NonEmptyStr
    done_criteria: list[NonEmptyStr] | None = None
    order_index: int | None = Field(default=None, ge=0)

    @model_validator(mode="after")
    def validate_dates(self) -> "StageCreate":
        reject_inverted_date_range(self.start_date, self.end_date, "stage")
        return self


class StageUpdate(BaseModel):
    name: NonEmptyStr | None = None
    goal: NonEmptyStr | None = None
    status: StageStatus | None = None
    order_index: int | None = Field(default=None, ge=0)


class StageRead(BaseModel):
    id: str
    project_id: str
    name: str
    goal: str
    start_date: date
    end_date: date
    deliverable: str
    done_criteria: list[str]
    status: StageStatus
    order_index: int
