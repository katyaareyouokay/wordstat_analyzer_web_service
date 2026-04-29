from pydantic import BaseModel
from typing import List


class TodayStatisticsRequest(BaseModel):
    pass


class StatisticsContent(BaseModel):
    user_id: int
    login: str
    top_requests_count: int
    dynamics_requests_count: int
    regions_requests_count: int


class TodayStatisticsResponse(BaseModel):
    today_stat: List[StatisticsContent]


class AllTimeStatisticsRequest(BaseModel):
    pass


class AllTimeStatisticsResponse(BaseModel):
    all_time_stat: List[StatisticsContent]
