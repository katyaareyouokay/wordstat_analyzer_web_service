from collections import defaultdict
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
import time
from sqlalchemy import select
from sqlalchemy.orm import joinedload
from app.core.database import get_db
from app.core.security import get_current_user
from app.models import User, Dynamics, TopRequest, \
    RegionsRequest as RegionsRequestModel, DynamicsPoint, RegionsRequestItem, \
    TopRequestItem, Region
from app.crud.search import save_search_result, save_dynamics_result, \
    save_regions_result
from fastapi.responses import StreamingResponse
import pandas as pd
import io
from app.schemas.wordstat import SearchRequest, DynamicsRequest, RegionsRequest

from app.services.wordstat import wordstat_service

router = APIRouter()


def _new_group_id() -> int:
    return int(time.time())


def _history_rows_grouped(rows, type_label: str):
    """Группировка строк БД по group_id для истории."""
    by_gid: dict[int, list] = defaultdict(list)
    for row in rows:
        by_gid[row.group_id].append(row)
    out = []
    for gid, items in by_gid.items():
        items = sorted(items, key=lambda x: x.id)
        phrases = []
        for x in items:
            sp = x.search_phrase
            if sp and sp.phrase:
                phrases.append(sp.phrase)
        phrase_text = ", ".join(phrases) if phrases else "---"
        times = [x.requested_at for x in items if x.requested_at]
        created_at = max(times) if times else None
        out.append({
            "group_id": gid,
            "type": type_label,
            "phrase": phrase_text,
            "_sort": created_at or datetime.min,
            "created_at": created_at.strftime(
                '%Y-%m-%d %H:%M') if created_at else "---",
        })
    return out


@router.post("/search")
async def search_top(request: SearchRequest, db: AsyncSession = Depends(get_db),
                     current_user: User = Depends(get_current_user)):
    phrases = request.resolved_phrases()
    yandex_by_phrase: dict[str, dict] = {}
    for ph in phrases:
        data = await wordstat_service.get_top_requests(
            phrase=ph,
            regions=request.regions,
            devices=request.devices
        )
        if "error" in data:
            raise HTTPException(
                status_code=400,
                detail={"phrase": ph, "yandex": data},
            )
        yandex_by_phrase[ph] = data

    group_id = _new_group_id()
    for ph, data in yandex_by_phrase.items():
        await save_search_result(
            db,
            current_user.id,
            ph,
            data,
            group_id,
            device_ids=request.devices,
            region_ids=request.regions
        )

    out = {
        "status": "success",
        "group_id": group_id,
        "by_phrase": yandex_by_phrase,
    }
    if len(phrases) == 1:
        out["data"] = yandex_by_phrase[phrases[0]]
    return out


@router.post("/dynamics")
async def search_dynamics(request: DynamicsRequest,
                          db: AsyncSession = Depends(get_db),
                          current_user: User = Depends(get_current_user)):
    phrases = request.resolved_phrases()
    yandex_by_phrase: dict[str, dict] = {}
    for ph in phrases:
        data = await wordstat_service.get_dynamics(
            phrase=ph,
            period=request.period,
            from_date=request.from_date,
            to_date=request.to_date,
            regions=request.regions,
            devices=request.devices
        )
        if "error" in data:
            raise HTTPException(
                status_code=400,
                detail={"phrase": ph, "yandex": data},
            )
        yandex_by_phrase[ph] = data

    group_id = _new_group_id()
    params = {
        "from_date": request.from_date,
        "to_date": request.to_date,
        "period": request.period,
    }
    for ph, data in yandex_by_phrase.items():
        await save_dynamics_result(
            db=db,
            user_id=current_user.id,
            phrase_text=ph,
            yandex_data=data,
            group_id=group_id,
            device_ids=request.devices,
            region_ids=request.regions,
            params=params,
        )

    out = {"status": "success", "group_id": group_id, "by_phrase": yandex_by_phrase}
    if len(phrases) == 1:
        out["data"] = yandex_by_phrase[phrases[0]]
    return out


@router.post("/regions")
async def search_regions(request: RegionsRequest,
                         db: AsyncSession = Depends(get_db),
                         current_user: User = Depends(get_current_user)):
    phrases = request.resolved_phrases()
    yandex_by_phrase: dict[str, dict] = {}
    for ph in phrases:
        data = await wordstat_service.get_regions_distribution(
            ph, request.region_type)
        if "error" in data:
            raise HTTPException(
                status_code=400,
                detail={"phrase": ph, "yandex": data},
            )
        yandex_by_phrase[ph] = data

    group_id = _new_group_id()
    merged_region_ids: set[int] = set()
    for ph, data in yandex_by_phrase.items():
        await save_regions_result(
            db=db,
            user_id=current_user.id,
            phrase_text=ph,
            yandex_data=data,
            group_id=group_id,
            region_type=request.region_type,
            device_ids=request.devices
        )
        for r in data.get("regions", []) or []:
            rid = r.get("regionId")
            if rid is not None:
                merged_region_ids.add(int(rid))

    by_phrase_out: dict[str, dict] = {}
    db_regions: dict[int, str] = {}
    if merged_region_ids:
        res = await db.execute(
            select(Region).where(Region.id.in_(merged_region_ids)))
        db_regions = {r.id: r.label for r in res.scalars().all()}

    for ph, data in yandex_by_phrase.items():
        payload = dict(data)
        regions_list = list(payload.get("regions", []) or [])
        for r in regions_list:
            r_id = r.get("regionId")
            r["regionName"] = db_regions.get(
                r_id, f"Регион ID {r_id}" if r_id is not None else "---")
        payload["regions"] = regions_list
        by_phrase_out[ph] = payload

    out = {"status": "success", "group_id": group_id, "by_phrase": by_phrase_out}
    if len(phrases) == 1:
        out["data"] = by_phrase_out[phrases[0]]
    return out


@router.get("/regions/dict")
async def get_regions_dictionary(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Region).order_by(Region.label))
    regions = result.scalars().all()

    return [{"id": r.id, "label": r.label} for r in regions]


@router.get("/history")
async def get_user_history(
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    try:
        history_list = []

        dyn_stmt = (
            select(Dynamics)
            .options(joinedload(Dynamics.search_phrase))
            .where(Dynamics.user_id == current_user.id)
        )
        dyn_rows = (await db.execute(dyn_stmt)).scalars().all()
        history_list.extend(_history_rows_grouped(dyn_rows, "Динамика"))

        top_stmt = (
            select(TopRequest)
            .options(joinedload(TopRequest.search_phrase))
            .where(TopRequest.user_id == current_user.id)
        )
        top_rows = (await db.execute(top_stmt)).scalars().all()
        history_list.extend(_history_rows_grouped(top_rows, "Топ запросов"))

        reg_stmt = (
            select(RegionsRequestModel)
            .options(joinedload(RegionsRequestModel.search_phrase))
            .where(RegionsRequestModel.user_id == current_user.id)
        )
        reg_rows = (await db.execute(reg_stmt)).scalars().all()
        history_list.extend(_history_rows_grouped(reg_rows, "Регионы"))

        history_list.sort(key=lambda x: x["_sort"], reverse=True)
        for h in history_list:
            h.pop("_sort", None)

        return history_list

    except Exception as e:
        print(f"DEBUG ERROR: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Ошибка БД: {str(e)}")


def _excel_sheet_title(label: str, index: int, used: set[str]) -> str:
    raw = "".join(
        c for c in (label or f"Лист{index + 1}")[:28]
        if c not in '[]:*?/\\'
    ) or f"Лист{index + 1}"
    name = raw[:31]
    base = name
    n = 1
    while name in used:
        suf = f"_{n}"
        name = (base[: 31 - len(suf)] + suf)[:31]
        n += 1
    used.add(name)
    return name


@router.get("/history/group/{group_id}/download")
async def download_excel_by_group(
        group_id: int,
        type: str,
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(get_current_user),
):
    """Выгрузка всего логического запроса (один group_id, несколько фраз — несколько листов)."""
    try:
        output = io.BytesIO()
        used_names: set[str] = set()
        filename = f"group_{group_id}.xlsx"

        if type == "Топ запросов":
            stmt = (
                select(TopRequest)
                .options(joinedload(TopRequest.search_phrase))
                .where(
                    TopRequest.user_id == current_user.id,
                    TopRequest.group_id == group_id,
                )
                .order_by(TopRequest.id)
            )
            trs = (await db.execute(stmt)).scalars().all()
            if not trs:
                raise HTTPException(status_code=404, detail="Данные не найдены")
            filename = f"top_group_{group_id}.xlsx"
            with pd.ExcelWriter(output, engine="openpyxl") as writer:
                wrote_any = False
                for idx, tr in enumerate(trs):
                    label = (
                        tr.search_phrase.phrase if tr.search_phrase else str(tr.id)
                    )
                    sheet = _excel_sheet_title(label, idx, used_names)
                    res = await db.execute(
                        select(TopRequestItem).where(
                            TopRequestItem.top_request_id == tr.id
                        )
                    )
                    items = res.scalars().all()
                    rows = [{"Фраза": i.phrase, "Частота": i.count} for i in items]
                    if not rows:
                        continue
                    wrote_any = True
                    pd.DataFrame(rows).to_excel(
                        writer, sheet_name=sheet, index=False)
                if not wrote_any:
                    raise HTTPException(
                        status_code=404, detail="Нет строк для выгрузки")

        elif type == "Динамика":
            stmt = (
                select(Dynamics)
                .options(joinedload(Dynamics.search_phrase))
                .where(
                    Dynamics.user_id == current_user.id,
                    Dynamics.group_id == group_id,
                )
                .order_by(Dynamics.id)
            )
            dyn_rows = (await db.execute(stmt)).scalars().all()
            if not dyn_rows:
                raise HTTPException(status_code=404, detail="Данные не найдены")
            filename = f"dynamics_group_{group_id}.xlsx"
            with pd.ExcelWriter(output, engine="openpyxl") as writer:
                wrote_any = False
                for idx, d in enumerate(dyn_rows):
                    label = (
                        d.search_phrase.phrase if d.search_phrase else str(d.id)
                    )
                    sheet = _excel_sheet_title(label, idx, used_names)
                    res = await db.execute(
                        select(DynamicsPoint).where(
                            DynamicsPoint.dynamics_id == d.id
                        )
                    )
                    items = res.scalars().all()
                    rows = [
                        {"Дата": i.point_date, "Количество": i.count, "Доля": i.share}
                        for i in items
                    ]
                    if not rows:
                        continue
                    wrote_any = True
                    pd.DataFrame(rows).to_excel(
                        writer, sheet_name=sheet, index=False)
                if not wrote_any:
                    raise HTTPException(
                        status_code=404, detail="Нет точек динамики")

        elif type == "Регионы":
            stmt = (
                select(RegionsRequestModel)
                .options(joinedload(RegionsRequestModel.search_phrase))
                .where(
                    RegionsRequestModel.user_id == current_user.id,
                    RegionsRequestModel.group_id == group_id,
                )
                .order_by(RegionsRequestModel.id)
            )
            reg_rows = (await db.execute(stmt)).scalars().all()
            if not reg_rows:
                raise HTTPException(status_code=404, detail="Данные не найдены")
            filename = f"regions_group_{group_id}.xlsx"
            with pd.ExcelWriter(output, engine="openpyxl") as writer:
                wrote_any = False
                for idx, rr in enumerate(reg_rows):
                    label = (
                        rr.search_phrase.phrase if rr.search_phrase else str(rr.id)
                    )
                    sheet = _excel_sheet_title(label, idx, used_names)
                    q = (
                        select(
                            RegionsRequestItem,
                            Region.label.label("region_label"),
                        )
                        .join(Region, Region.id == RegionsRequestItem.region_id)
                        .where(
                            RegionsRequestItem.regions_requests_id == rr.id
                        )
                    )
                    res = await db.execute(q)
                    data_rows = [
                        {
                            "Регион": row.region_label,
                            "Количество": row.RegionsRequestItem.count,
                            "Доля": row.RegionsRequestItem.share,
                            "Affinity": row.RegionsRequestItem.affinity_index,
                        }
                        for row in res.all()
                    ]
                    if not data_rows:
                        continue
                    wrote_any = True
                    pd.DataFrame(data_rows).to_excel(
                        writer, sheet_name=sheet, index=False)
                if not wrote_any:
                    raise HTTPException(
                        status_code=404, detail="Нет строк по регионам")
        else:
            raise HTTPException(status_code=400, detail="Неизвестный тип отчёта")

        output.seek(0)
        return StreamingResponse(
            output,
            media_type=(
                "application/vnd.openxmlformats-officedocument."
                "spreadsheetml.sheet"
            ),
            headers={
                "Content-Disposition": f"attachment; filename={filename}"
            },
        )
    except HTTPException:
        raise
    except Exception as e:
        print(f"Excel group Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/history/download/{item_id}")
async def download_excel(
        item_id: int,
        type: str,
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(get_current_user),
):
    """Скачивание одной строки БД по первичному ключу (совместимость)."""
    try:
        data_for_excel = []
        filename = f"report_{item_id}.xlsx"

        if type == "Топ запросов":
            tr = await db.get(TopRequest, item_id)
            if not tr or tr.user_id != current_user.id:
                raise HTTPException(status_code=404, detail="Данные не найдены")
            stmt = select(TopRequestItem).where(
                TopRequestItem.top_request_id == item_id)
            res = await db.execute(stmt)
            items = res.scalars().all()
            data_for_excel = [{"Фраза": i.phrase, "Частота": i.count} for i in
                              items]
            filename = f"top_requests_{item_id}.xlsx"

        elif type == "Динамика":
            d = await db.get(Dynamics, item_id)
            if not d or d.user_id != current_user.id:
                raise HTTPException(status_code=404, detail="Данные не найдены")
            stmt = select(DynamicsPoint).where(
                DynamicsPoint.dynamics_id == item_id)
            res = await db.execute(stmt)
            items = res.scalars().all()
            data_for_excel = [
                {"Дата": i.point_date, "Количество": i.count, "Доля": i.share}
                for i in items
            ]
            filename = f"dynamics_{item_id}.xlsx"

        elif type == "Регионы":
            rr = await db.get(RegionsRequestModel, item_id)
            if not rr or rr.user_id != current_user.id:
                raise HTTPException(status_code=404, detail="Данные не найдены")
            stmt = (
                select(
                    RegionsRequestItem,
                    Region.label.label("region_label")
                )
                .join(Region, Region.id == RegionsRequestItem.region_id)
                .where(RegionsRequestItem.regions_requests_id == item_id)
            )

            res = await db.execute(stmt)
            rows = res.all()

            data_for_excel = [
                {
                    "Регион": row.region_label,
                    "Количество": row.RegionsRequestItem.count,
                    "Доля": row.RegionsRequestItem.share,
                    "Affinity": row.RegionsRequestItem.affinity_index
                }
                for row in rows
            ]
            filename = f"regions_{item_id}.xlsx"

        if not data_for_excel:
            raise HTTPException(status_code=404, detail="Данные не найдены")

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

    except HTTPException:
        raise
    except Exception as e:
        print(f"Excel Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
