from passlib.context import CryptContext
from datetime import datetime, timedelta, timezone
from app.core.config import settings
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Проверяет, совпадает ли введенный пароль с хэшем из БД"""
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """Превращает пароль в нечитаемый хэш"""
    return pwd_context.hash(password)


def create_access_token(data: dict):
    to_encode = data.copy()
    # Устанавливаем срок годности ]
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    # Шифруем данные пользователя в строку
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY,
                             algorithm=settings.ALGORITHM)
    return encoded_jwt


# Эта штука говорит Swagger, где брать токен
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")


async def get_current_user(
        token: str = Depends(oauth2_scheme),
        db: AsyncSession = Depends(get_db)
):
    """Проверяет JWT-токен доступа и возвращает текущего аутентифицированного пользователя."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Не удалось проверить учетные данные",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        # Расшифровываем токен
        payload = jwt.decode(token, settings.SECRET_KEY,
                             algorithms=[settings.ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    from app.crud.user import get_user_by_login
    # Ищем пользователя в БД
    user = await get_user_by_login(db, login=username)
    if user is None:
        raise credentials_exception

    return user
