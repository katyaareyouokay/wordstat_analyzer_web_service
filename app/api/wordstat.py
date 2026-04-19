from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
import time
from sqlalchemy import select
from sqlalchemy.orm import joinedload
from app.core.database import get_db
from app.core.security import get_current_user
from app.models import User, Dynamics, TopRequest, \
    RegionsRequest as RegionsRequestModel, DynamicsPoint, RegionsRequestItem, \
    TopRequestItem
from app.crud.search import save_search_result, save_dynamics_result, \
    save_regions_result
from fastapi.responses import StreamingResponse
import pandas as pd
import io
from app.schemas.wordstat import SearchRequest, DynamicsRequest, RegionsRequest

from app.services.wordstat import wordstat_service

router = APIRouter()


@router.post("/search")
async def search_top(request: SearchRequest, db: AsyncSession = Depends(get_db),
                     current_user: User = Depends(get_current_user)):

    data = await wordstat_service.get_top_requests(
        phrase=request.phrase,
        regions=request.regions,
        devices=request.devices
    )
    if "error" in data: raise HTTPException(status_code=400, detail=data)

    group_id = int(time.time())
    await save_search_result(
        db,
        current_user.id,
        request.phrase,
        data,
        group_id,
        device_ids=request.devices,
        region_ids=request.regions
    )

    return {"status": "success", "group_id": group_id, "data": data}


@router.post("/dynamics")
async def search_dynamics(request: DynamicsRequest,
                          db: AsyncSession = Depends(get_db),
                          current_user: User = Depends(get_current_user)):
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
async def search_regions(request: RegionsRequest,
                         db: AsyncSession = Depends(get_db),
                         current_user: User = Depends(get_current_user)):
    data = await wordstat_service.get_regions_distribution(request.phrase,
                                                           request.region_type)
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


@router.get("/history")
async def get_user_history(
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    try:
        history_list = []

        # Загружаем Динамику
        dyn_stmt = (
            select(Dynamics)
            .options(joinedload(Dynamics.search_phrase))
            .where(Dynamics.user_id == current_user.id)
            .order_by(Dynamics.requested_at.desc())
        )
        dyn_res = await db.execute(dyn_stmt)
        for d in dyn_res.scalars().all():
            history_list.append({
                "id": d.id,
                "type": "Динамика",
                "phrase": d.search_phrase.phrase if d.search_phrase else "---",
                "created_at": d.requested_at.strftime(
                    '%Y-%m-%d %H:%M') if d.requested_at else "---"
            })

        # Загружаем ТОП запросов
        top_stmt = (
            select(TopRequest)
            .options(joinedload(TopRequest.search_phrase))
            .where(TopRequest.user_id == current_user.id)
            .order_by(TopRequest.requested_at.desc())
        )
        top_res = await db.execute(top_stmt)
        for t in top_res.scalars().all():
            history_list.append({
                "id": t.id,
                "type": "Топ запросов",
                "phrase": t.search_phrase.phrase if t.search_phrase else "---",
                "created_at": t.requested_at.strftime(
                    '%Y-%m-%d %H:%M') if t.requested_at else "---"
            })

        # Загружаем Регионы
        reg_stmt = (
            select(RegionsRequestModel)
            .options(joinedload(RegionsRequestModel.search_phrase))
            .where(RegionsRequestModel.user_id == current_user.id)
            .order_by(RegionsRequestModel.requested_at.desc())
        )
        reg_res = await db.execute(reg_stmt)
        for r in reg_res.scalars().all():
            history_list.append({
                "id": r.id,
                "type": "Регионы",
                "phrase": r.search_phrase.phrase if r.search_phrase else "---",
                "created_at": r.requested_at.strftime(
                    '%Y-%m-%d %H:%M') if r.requested_at else "---"
            })

        # Сортируем: новые записи в начало списка
        history_list.sort(key=lambda x: x['created_at'], reverse=True)

        return history_list

    except Exception as e:
        print(f"DEBUG ERROR: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Ошибка БД: {str(e)}")


@router.get("/history/download/{item_id}")
async def download_excel(
        item_id: int,
        type: str,
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    try:
        data_for_excel = []
        filename = f"report_{item_id}.xlsx"

        # Логика для топ запросов
        if type == "Топ запросов":
            stmt = select(TopRequestItem).where(
                TopRequestItem.top_request_id == item_id)
            res = await db.execute(stmt)
            items = res.scalars().all()
            data_for_excel = [{"Фраза": i.phrase, "Частота": i.count} for i in
                              items]
            filename = f"top_requests_{item_id}.xlsx"

        # Логика для  динамики
        elif type == "Динамика":
            stmt = select(DynamicsPoint).where(
                DynamicsPoint.dynamics_id == item_id)
            res = await db.execute(stmt)
            items = res.scalars().all()
            data_for_excel = [
                {"Дата": i.point_date, "Количество": i.count, "Доля": i.share}
                for i in items
            ]
            filename = f"dynamics_{item_id}.xlsx"

        # Логика для регионов
        elif type == "Регионы":
            stmt = (
                select(RegionsRequestItem)
                .options(joinedload(RegionsRequestItem.region))
                .where(RegionsRequestItem.regions_requests_id == item_id)
            )
            res = await db.execute(stmt)
            items = res.scalars().all()
            data_for_excel = [
                {"Регион": i.region.label, "Количество": i.count,
                 "Доля": i.share, "Affinity": i.affinity_index}
                for i in items
            ]
            filename = f"regions_{item_id}.xlsx"

        if not data_for_excel:
            raise HTTPException(status_code=404, detail="Данные не найдены")

        # Создаем Excel в памяти
        df = pd.DataFrame(data_for_excel)
        output = io.BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, index=False, sheet_name='Результат')
        output.seek(0)

        return StreamingResponse(
            output,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )

    except Exception as e:
        print(f"Excel Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
