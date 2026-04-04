from pydantic import BaseModel, ConfigDict
from typing import Optional


# 1. Схема для регистрации
class UserCreate(BaseModel):
    login: str
    password: str
    full_name: str
    role_id: int = 1  # По умолчанию назначаем базовую роль


# 2. Схема для обновления данных пользователя
class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    password: Optional[str] = None


# 3. Схема ответа
class UserResponse(BaseModel):
    id: int
    login: str
    full_name: str
    role_id: int

    model_config = ConfigDict(from_attributes=True)