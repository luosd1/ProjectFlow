from pydantic import BaseModel


class ReviewSummaryRead(BaseModel):
    markdown: str
