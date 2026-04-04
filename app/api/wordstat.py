from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
import time
from app.core.database import get_db
from app.core.security import get_current_user
from app.models import User
from app.services.wordstat import wordstat_service
from app.crud.search import save_search_result

router = APIRouter()


class SearchRequest(BaseModel):
    phrase: str
    regions: list[int] | None = None


@router.post("/search")
async def search_wordstat(
        request: SearchRequest,
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    # 1. Запрашиваем данные у Яндекса
    data = await wordstat_service.get_top_requests(
        phrase=request.phrase,
        regions=request.regions
    )

    if "error" in data:
        raise HTTPException(status_code=400, detail=data)

    # 2. Вытаскиваем totalCount (если вдруг его нет, ставим 0)
    total_count = data.get("totalCount", 0)

    # Генерируем уникальный ID для этой группы запросов
    # В будущем здесь может быть логика объединения нескольких фраз
    group_id = int(time.time())

    # Передаем group_id в функцию сохранения
    await save_search_result(
        db=db,
        user_id=current_user.id,
        phrase_text=request.phrase,
        yandex_data=data,
        group_id=group_id
    )

    return {
        "status": "success",
        "group_id": group_id,
        "data": data
    }
