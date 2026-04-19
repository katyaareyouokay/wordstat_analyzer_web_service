from pydantic import BaseModel
from typing import Optional, List


class SearchRequest(BaseModel):
    phrase: str
    regions: list[int] = []
    devices: list[int] = []

class DynamicsRequest(BaseModel):
    phrase: str
    period: str = "monthly"
    from_date: str
    to_date: Optional[str] = None
    regions: List[int] = []
    devices: List[int] = []

class RegionsRequest(BaseModel):
    phrase: str
    region_type: str = "all"