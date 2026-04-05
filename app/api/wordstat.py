from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
import time
from typing import Optional

from app.core.database import get_db
from app.core.security import get_current_user
from app.models import User
from app.crud.search import save_search_result, save_dynamics_result, save_regions_result

# Импортируем наш сервис
from app.services.wordstat import wordstat_service

router = APIRouter()

# --- СХЕМЫ ЗАПРОСОВ ---
class SearchRequest(BaseModel):
    phrase: str
    regions: list[int] | None = None

class DynamicsRequest(BaseModel):
    phrase: str
    period: str = "monthly"
    from_date: str
    to_date: Optional[str] = None

class RegionsRequest(BaseModel):
    phrase: str
    region_type: str = "all"


# --- ЭНДПОИНТЫ ---
@router.post("/search")
async def search_top(request: SearchRequest, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    data = await wordstat_service.get_top_requests(request.phrase, request.regions)
    if "error" in data: raise HTTPException(status_code=400, detail=data)

    group_id = int(time.time())
    await save_search_result(db, current_user.id, request.phrase, data, group_id)
    return {"status": "success", "group_id": group_id, "data": data}

@router.post("/dynamics")
async def search_dynamics(request: DynamicsRequest, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    data = await wordstat_service.get_dynamics(
        request.phrase, request.period, request.from_date, request.to_date
    )
    if "error" in data: raise HTTPException(status_code=400, detail=data)

    group_id = int(time.time())

    await save_dynamics_result(
        db=db,
        user_id=current_user.id,
        phrase_text=request.phrase,
        yandex_data=data,
        group_id=group_id,
        params={
            "from_date": request.from_date,
            "to_date": request.to_date,
            "period": request.period
        }
    )
    return {"status": "success", "group_id": group_id, "data": data}

@router.post("/regions")
async def search_regions(request: RegionsRequest, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    data = await wordstat_service.get_regions_distribution(request.phrase, request.region_type)
    if "error" in data: raise HTTPException(status_code=400, detail=data)

    group_id = int(time.time())

    await save_regions_result(
        db=db,
        user_id=current_user.id,
        phrase_text=request.phrase,
        yandex_data=data,
        group_id=group_id,
        region_type=request.region_type
    )

    return {"status": "success", "group_id": group_id, "data": data}