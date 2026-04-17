import logging
from sqlalchemy import select
from app.services.wordstat import YandexWordstatService
from app.models import Region, Role, User
from app.core.security import get_password_hash

logger = logging.getLogger(__name__)


# Роли
async def init_roles(db):
    roles_data = {1: "Admin", 2: "User"}
    for role_id, role_name in roles_data.items():
        result = await db.execute(select(Role).where(Role.id == role_id))
        if not result.scalars().first():
            db.add(Role(id=role_id, name=role_name))
            print(f"Роль {role_name} создана.")
    await db.flush()


# Администратор
async def init_admin(db):
    admin_login = "admin"
    admin_password = "admin_password_123"

    result = await db.execute(select(User).where(User.login == admin_login))
    if not result.scalars().first():
        new_admin = User(
            full_name="Administrator",
            login=admin_login,
            password=get_password_hash(admin_password),
            role_id=1,
        )
        db.add(new_admin)

    print(f"Админ {admin_login} создан.")


# Регионы
async def init_regions(db):
    # Проверяем, пуста ли таблица
    result = await db.execute(select(Region).limit(1))
    if result.scalar():
        return

    wordstat_service = YandexWordstatService()

    # Получаем сырые данные от API
    regions_data = await wordstat_service.get_all_regions()

    if "error" in regions_data:
        logger.error(f"Не удалось получить регионы: {regions_data}")
        return

    def extract_regions(data):
        regions = []
        if isinstance(data, list):
            for item in data:
                regions.extend(extract_regions(item))
            return regions

        if isinstance(data, dict):
            if "value" in data and "label" in data:
                regions.append({
                    "id": int(data["value"]),
                    "label": data["label"]
                })

            if "children" in data and isinstance(data["children"], list):
                for child in data["children"]:
                    regions.extend(extract_regions(child))
        return regions

    try:
        # Превращаем дерево в плоский список
        flat_regions = extract_regions(regions_data)

        # Сохраняем в базу
        seen_ids = set()
        for reg in flat_regions:
            if reg["id"] not in seen_ids:
                db.add(Region(id=reg["id"], label=reg["label"]))
                seen_ids.add(reg["id"])

        await db.commit()
        print(f"Успешно загружено {len(seen_ids)} регионов!")

    except Exception as e:
        await db.rollback()
        logger.error(f"Ошибка при сохранении регионов в БД: {e}")

# Собираем в одну функцию для записи в БД
async def setup_initial_data(db):
    try:
        await init_roles(db)
        await init_admin(db)
        await init_regions(db)
        await db.commit()
    except Exception as e:
        await db.rollback()
        logger.error(f"Ошибка при первичной настройке БД: {e}")