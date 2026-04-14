from fastapi import FastAPI
from app.api import auth, wordstat
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title="Словарик API",
    description="Веб-сервис для анализа поисковых запросов на основе Яндекс.Вордстат",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],             # Разрешить запросы с любого адреса (для разработки — ок)
    allow_credentials=True,
    allow_methods=["*"],             # Разрешить все методы (POST, GET, OPTIONS и т.д.)
    allow_headers=["*"],             # Разрешить любые заголовки
)
app.include_router(auth.router, prefix="/auth", tags=["Auth"])
app.include_router(wordstat.router, prefix="/wordstat", tags=["Wordstat"])