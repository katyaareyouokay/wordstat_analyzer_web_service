from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.schemas.user import UserCreate, UserResponse
from app.crud import user as crud_user
from fastapi.security import OAuth2PasswordRequestForm
from app.core.security import verify_password, create_access_token
from app.schemas.token import Token

router = APIRouter(tags=["Аутентификация"])


@router.post("/register", response_model=UserResponse)
async def register(user: UserCreate, db: AsyncSession = Depends(get_db)):
    # Проверяем, нет ли уже такого логина
    db_user = await crud_user.get_user_by_login(db, login=user.login)
    if db_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Пользователь с таким логином уже существует"
        )

    # Если всё ок, создаем пользователя
    return await crud_user.create_user(db=db, user=user)


@router.post("/login", response_model=Token)
async def login(
        db: AsyncSession = Depends(get_db),
        form_data: OAuth2PasswordRequestForm = Depends()
):
    # Ищем пользователя
    user = await crud_user.get_user_by_login(db, login=form_data.username)
    if not user or not verify_password(form_data.password, user.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Неверный логин или пароль",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Создаем токен
    access_token = create_access_token(data={"sub": user.login})
    return {"access_token": access_token, "token_type": "bearer"}
