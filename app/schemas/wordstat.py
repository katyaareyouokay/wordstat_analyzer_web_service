from pydantic import BaseModel
from typing import Optional


class SearchRequest(BaseModel):
    phrase: str
    regions: list[int] | None = [1]
    devices: list[int] = [4]

class DynamicsRequest(BaseModel):
    phrase: str
    period: str = "monthly"
    from_date: str
    to_date: Optional[str] = None

class RegionsRequest(BaseModel):
    phrase: str
    region_type: str = "all"