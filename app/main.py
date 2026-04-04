from fastapi import FastAPI
from app.api import auth, wordstat

app = FastAPI(
    title="Словарик API",
    description="Веб-сервис для анализа поисковых запросов на основе Яндекс.Вордстат",
)

app.include_router(auth.router, prefix="/auth", tags=["Auth"])
app.include_router(wordstat.router, prefix="/wordstat", tags=["Wordstat"])