from sqlalchemy.ext.asyncio import AsyncSession

from app.models import SearchPhrase, TopRequest, TopRequestItem, Dynamics, \
    DynamicsPoint, RegionsRequest, RegionsRequestItem, Region
from sqlalchemy import select
from datetime import datetime

async def get_or_create_phrase(db: AsyncSession, phrase_text: str,
                               user_id: int) -> int:
    result = await db.execute(
        select(SearchPhrase).where(SearchPhrase.phrase == phrase_text))
    db_phrase = result.scalar_one_or_none()
    if not db_phrase:
        db_phrase = SearchPhrase(phrase=phrase_text, user_id=user_id)
        db.add(db_phrase)
        await db.flush()
    return db_phrase.id


# 1. Сохранение ТОПов
async def save_search_result(db: AsyncSession, user_id: int, phrase_text: str,
                             yandex_data: dict, group_id: int):
    phrase_id = await get_or_create_phrase(db, phrase_text, user_id)

    db_top_request = TopRequest(
        group_id=group_id,
        search_phrase_id=phrase_id,
        user_id=user_id,
        total_count=yandex_data.get("totalCount", 0)
    )
    db.add(db_top_request)
    await db.flush()

    items = yandex_data.get("topRequests", [])
    for item in items:
        new_item = TopRequestItem(
            top_request_id=db_top_request.id,
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
        params: dict
):
    phrase_id = await get_or_create_phrase(db, phrase_text, user_id)

    if params.get("to_date"):
        to_dt = datetime.strptime(params["to_date"], "%Y-%m-%d").date()
    else:
        to_dt = datetime.now().date()

    # 3. Создаем запись в таблице dynamics
    db_dynamics = Dynamics(
        group_id=group_id,
        search_phrase_id=phrase_id,
        user_id=user_id,
        from_date=datetime.strptime(params["from_date"], "%Y-%m-%d").date(),
        to_date=to_dt,
        period=params["period"]
    )
    db.add(db_dynamics)
    await db.flush()

    # 4. Сохраняем точки из ответа Яндекса
    points = yandex_data.get("dynamics", [])

    for p in points:
        new_point = DynamicsPoint(
            dynamics_id=db_dynamics.id,
            point_date=datetime.strptime(p.get("date"), "%Y-%m-%d").date(),
            count=p.get("count", 0),
            share=p.get("share", 0.0)
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
        region_type: str
):
    # 1. Получаем ID фразы
    phrase_id = await get_or_create_phrase(db, phrase_text, user_id)

    # 2. Создаем "шапку" запроса
    db_reg_req = RegionsRequest(
        group_id=group_id,
        user_id=user_id,
        search_phrase_id=phrase_id,
        region_type=region_type
    )
    db.add(db_reg_req)
    await db.flush()

    # 3. Сохраняем элементы
    regions_list = yandex_data.get("regions", [])
    for reg in regions_list:
        r_id = reg.get("regionId")
        if not r_id:
            continue

        # Проверяем, есть ли такой регион в базе
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
