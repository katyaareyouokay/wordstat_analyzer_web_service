from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, case
from datetime import datetime, timedelta

from app.core.database import get_db
from app.models import User, TopRequest, Dynamics, RegionsRequest
from app.schemas.statistics import (
    TodayStatisticsResponse,
    AllTimeStatisticsResponse,
    StatisticsContent
)

router = APIRouter(prefix="/statistics", tags=["Статистика"])


@router.get("/today", response_model=TodayStatisticsResponse)
async def get_today_statistics(db: AsyncSession = Depends(get_db)):
    last_24h = datetime.utcnow() - timedelta(hours=24)

    top_subq = (
        select(
            TopRequest.user_id,
            func.count(TopRequest.id).label("top_count")
        )
        .where(TopRequest.requested_at >= last_24h)
        .group_by(TopRequest.user_id)
        .subquery()
    )

    dyn_subq = (
        select(
            Dynamics.user_id,
            func.count(Dynamics.id).label("dyn_count")
        )
        .where(Dynamics.requested_at >= last_24h)
        .group_by(Dynamics.user_id)
        .subquery()
    )

    reg_subq = (
        select(
            RegionsRequest.user_id,
            func.count(RegionsRequest.id).label("reg_count")
        )
        .where(RegionsRequest.requested_at >= last_24h)
        .group_by(RegionsRequest.user_id)
        .subquery()
    )

    # основной запрос
    stmt = (
        select(
            User.id.label("user_id"),
            User.login,
            func.coalesce(top_subq.c.top_count, 0).label("top_count"),
            func.coalesce(dyn_subq.c.dyn_count, 0).label("dyn_count"),
            func.coalesce(reg_subq.c.reg_count, 0).label("reg_count"),
        )
        .outerjoin(top_subq, top_subq.c.user_id == User.id)
        .outerjoin(dyn_subq, dyn_subq.c.user_id == User.id)
        .outerjoin(reg_subq, reg_subq.c.user_id == User.id)
        .where(User.id != 1)
        .order_by(User.id)
    )

    result = await db.execute(stmt)
    rows = result.all()

    data = [
        StatisticsContent(
            user_id=row.user_id,
            login=row.login,
            top_requests_count=row.top_count,
            dynamics_requests_count=row.dyn_count,
            regions_requests_count=row.reg_count,
        )
        for row in rows
    ]

    return TodayStatisticsResponse(today_stat=data)

@router.get("/all-time", response_model=AllTimeStatisticsResponse)
async def get_all_time_statistics(db: AsyncSession = Depends(get_db)):
    
    top_subq = (
        select(
            TopRequest.user_id,
            func.count(TopRequest.id).label("top_count")
        )
        .group_by(TopRequest.user_id)
        .subquery()
    )

    dyn_subq = (
        select(
            Dynamics.user_id,
            func.count(Dynamics.id).label("dyn_count")
        )
        .group_by(Dynamics.user_id)
        .subquery()
    )

    reg_subq = (
        select(
            RegionsRequest.user_id,
            func.count(RegionsRequest.id).label("reg_count")
        )
        .group_by(RegionsRequest.user_id)
        .subquery()
    )

    # основной запрос
    stmt = (
        select(
            User.id.label("user_id"),
            User.login,
            func.coalesce(top_subq.c.top_count, 0).label("top_count"),
            func.coalesce(dyn_subq.c.dyn_count, 0).label("dyn_count"),
            func.coalesce(reg_subq.c.reg_count, 0).label("reg_count"),
        )
        .outerjoin(top_subq, top_subq.c.user_id == User.id)
        .outerjoin(dyn_subq, dyn_subq.c.user_id == User.id)
        .outerjoin(reg_subq, reg_subq.c.user_id == User.id)
        .where(User.id != 1)
        .order_by(User.id)
    )

    result = await db.execute(stmt)
    rows = result.all()

    data = [
        StatisticsContent(
            user_id=row.user_id,
            login=row.login,
            top_requests_count=row.top_count,
            dynamics_requests_count=row.dyn_count,
            regions_requests_count=row.reg_count,
        )
        for row in rows
    ]

    return AllTimeStatisticsResponse(all_time_stat=data)