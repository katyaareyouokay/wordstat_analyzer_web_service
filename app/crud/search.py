from sqlalchemy.ext.asyncio import AsyncSession

from app.models import SearchPhrase, TopRequest, TopRequestItem
from sqlalchemy import select


async def save_search_result(
        db: AsyncSession,
        user_id: int,
        phrase_text: str,
        yandex_data: dict,
        group_id: int
):
    # 1. Проверяем, есть ли основная фраза в справочнике
    result = await db.execute(
        select(SearchPhrase).where(SearchPhrase.phrase == phrase_text))
    db_phrase = result.scalar_one_or_none()

    if not db_phrase:
        db_phrase = SearchPhrase(phrase=phrase_text, user_id=user_id)
        db.add(db_phrase)
        await db.flush()

    # 2. Создаем запись в top_requests
    db_top_request = TopRequest(
        group_id=group_id,
        search_phrase_id=db_phrase.id,
        user_id=user_id,
        total_count=yandex_data.get("totalCount", 0)
    )
    db.add(db_top_request)
    await db.flush()  # Получаем id для связи с items

    # 3. Сохраняем вложенные элементы (items)
    items = yandex_data.get("topRequests", [])

    for item in items:
        new_item = TopRequestItem(
            top_request_id=db_top_request.id,
            phrase=item.get("phrase"),
            count=item.get("count", 0)
        )
        db.add(new_item)

    await db.commit()