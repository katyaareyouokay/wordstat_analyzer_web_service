from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import SearchPhrase, TopRequest, TopRequestItem, Dynamics, \
    DynamicsPoint, RegionsRequest, RegionsRequestItem, Region
from sqlalchemy import select
from datetime import datetime

async def get_or_create_phrase(db: AsyncSession, phrase_text: str,
                               user_id: int) -> int:
    # Сначала пытаемся просто найти фразу
    stmt = select(SearchPhrase).where(SearchPhrase.phrase == phrase_text)
    result = await db.execute(stmt)
    phrase = result.scalars().first()

    if phrase:
        return phrase.id

    # Если не нашли, пробуем создать
    new_phrase = SearchPhrase(phrase=phrase_text, user_id=user_id)
    db.add(new_phrase)

    try:
        # Пытаемся зафиксировать запись
        await db.commit()
        return new_phrase.id
    except IntegrityError:
        await db.rollback()

        stmt = select(SearchPhrase).where(SearchPhrase.phrase == phrase_text)
        result = await db.execute(stmt)
        phrase = result.scalars().first()
        return phrase.id


# 1. Сохранение ТОПов
async def save_search_result(
        db: AsyncSession,
        user_id: int,
        phrase_text: str,
        yandex_data: dict,
        group_id: int,
        device_ids: list[int] = None,
        region_ids: list[int] = None,
):
    phrase_id = await get_or_create_phrase(db, phrase_text, user_id)

    # Получаем объекты регионов из БД
    selected_regions = []
    if region_ids:
        result = await db.execute(
            select(Region).where(Region.id.in_(region_ids))
        )
        selected_regions = result.scalars().all()

    # Если выбрано all (4) или ничего не выбрано, то считаем, что выбраны все устройства
    is_all = device_ids and (
                4 in device_ids or set([1, 2, 3]).issubset(set(device_ids)))

    # Присваиваем ID устройств или None
    d1_id = 1 if (is_all or (device_ids and 1 in device_ids)) else None
    d2_id = 2 if (is_all or (device_ids and 2 in device_ids)) else None
    d3_id = 3 if (is_all or (device_ids and 3 in device_ids)) else None

    # Передаем ID во внешние ключи (колонки с окончанием _id)
    db_top_request = TopRequest(
        group_id=group_id,
        search_phrase_id=phrase_id,
        user_id=user_id,
        total_count=yandex_data.get("totalCount", 0),
        device1_id=d1_id,
        device2_id=d2_id,
        device3_id=d3_id,
        regions=selected_regions
    )

    print(f"DEBUG: IDs from request: {region_ids}")
    print(f"DEBUG: Found regions objects: {[r.id for r in selected_regions]}")

    db.add(db_top_request)
    await db.flush()

    items = yandex_data.get("topRequests", [])
    for item in items:
        new_item = TopRequestItem(
            top_request_id=db_top_request.id,
            search_phrase_id=phrase_id,
            phrase=item.get("phrase"),
            count=item.get("count", 0)
        )
        db.add(new_item)

    await db.commit()


# 2. Сохранение динамики
async def save_dynamics_result(
        db: AsyncSession,
        user_id: int,
        phrase_text: str,
        yandex_data: dict,
        group_id: int,
        params: dict,
        device_ids: list[int] = None,
        region_ids: list[int] = None
):
    phrase_id = await get_or_create_phrase(db, phrase_text, user_id)

    if params.get("to_date"):
        to_dt = datetime.strptime(params["to_date"], "%Y-%m-%d").date()
    else:
        to_dt = datetime.now().date()

    selected_regions = []
    if region_ids:
        res = await db.execute(
            select(Region).where(Region.id.in_(region_ids)))
        selected_regions = res.scalars().all()

    # Логика распределения девайсов
    is_all = device_ids and (
                    4 in device_ids or {1, 2, 3}.issubset(set(device_ids)))

    d1_id = 1 if (is_all or (device_ids and 1 in device_ids)) else None
    d2_id = 2 if (is_all or (device_ids and 2 in device_ids)) else None
    d3_id = 3 if (is_all or (device_ids and 3 in device_ids)) else None

    # Создаем запись в таблице dynamics
    db_dynamics = Dynamics(
        group_id=group_id,
        search_phrase_id=phrase_id,
        user_id=user_id,
        from_date=datetime.strptime(params["from_date"], "%Y-%m-%d").date(),
        to_date=to_dt,
        period=params["period"],
        device1_id=d1_id,
        device2_id=d2_id,
        device3_id=d3_id,
        regions=selected_regions
    )
    db.add(db_dynamics)
    await db.flush()

    # Сохраняем точки из ответа Яндекса
    points = yandex_data.get("dynamics", [])

    for p in points:
        new_point = DynamicsPoint(
            dynamics_id=db_dynamics.id,
            point_date=datetime.strptime(p.get("date"), "%Y-%m-%d").date(),
            count=p.get("count", 0),
            share=p.get("share", 0.0),
            search_phrase_id=phrase_id
        )
        db.add(new_point)
    await db.commit()


# 3. Сохранение регионов
async def save_regions_result(
        db: AsyncSession,
        user_id: int,
        phrase_text: str,
        yandex_data: dict,
        group_id: int,
        region_type: str,
        device_ids: list[int] = None
):
    phrase_id = await get_or_create_phrase(db, phrase_text, user_id)

    is_all = device_ids and (
                    4 in device_ids or {1, 2, 3}.issubset(set(device_ids)))

    d1_id = 1 if (is_all or (device_ids and 1 in device_ids)) else None
    d2_id = 2 if (is_all or (device_ids and 2 in device_ids)) else None
    d3_id = 3 if (is_all or (device_ids and 3 in device_ids)) else None

    db_reg_req = RegionsRequest(
        group_id=group_id,
        user_id=user_id,
        search_phrase_id=phrase_id,
        region_type=region_type,
        device1_id=d1_id,
        device2_id=d2_id,
        device3_id=d3_id
    )
    db.add(db_reg_req)
    await db.flush()

    regions_list = yandex_data.get("regions", [])
    for reg in regions_list:
        r_id = reg.get("regionId")
        if not r_id:
            continue

        db_region = await db.get(Region, r_id)
        if not db_region:
            r_name = reg.get("regionName", f"Регион {r_id}")
            db_region = Region(id=r_id, label=r_name)
            db.add(db_region)
            await db.flush()

        new_item = RegionsRequestItem(
            regions_requests_id=db_reg_req.id,
            search_phrase_id=phrase_id,
            region_id=r_id,
            count=reg.get("count", 0),
            share=min(float(reg.get("share", 0.0)), 1.0),
            affinity_index=reg.get("affinityIndex")
        )
        db.add(new_item)

    await db.commit()
