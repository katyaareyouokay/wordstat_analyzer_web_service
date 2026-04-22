from pydantic import BaseModel, ConfigDict
from typing import Optional


class UserCreate(BaseModel):
    """Схема для регистрации пользователя"""
    login: str
    password: str
    full_name: str
    role_id: int = 2  # По умолчанию назначаем роль пользователя


class UserUpdate(BaseModel):
    """Схема для обновления данных пользователя"""
    full_name: Optional[str] = None
    password: Optional[str] = None


class UserResponse(BaseModel):
    """Схема ответа пользователя"""
    id: int
    login: str
    full_name: str
    role_id: int

    model_config = ConfigDict(from_attributes=True)