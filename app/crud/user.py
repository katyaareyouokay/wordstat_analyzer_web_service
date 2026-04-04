from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.models import User
from app.schemas.user import UserCreate
from app.core.security import get_password_hash


async def get_user_by_login(db: AsyncSession, login: str):
    """Ищет пользователя по логину"""
    result = await db.execute(select(User).where(User.login == login))
    return result.scalars().first()


async def create_user(db: AsyncSession, user: UserCreate):
    """Создает нового пользователя в БД с хэшированным паролем"""
    hashed_password = get_password_hash(user.password)

    # Создаем объект модели SQLAlchemy
    db_user = User(
        login=user.login,
        password=hashed_password,
        full_name=user.full_name,
        role_id=user.role_id
    )

    # Добавляем в сессию и сохраняем
    db.add(db_user)
    await db.commit()
    await db.refresh(db_user)

    return db_user