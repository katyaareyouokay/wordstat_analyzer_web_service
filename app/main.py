import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from app.api import auth, wordstat, statistics
from app.core.database import AsyncSessionLocal

# Настройки путей
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
TEMPLATES_DIR = os.path.join(BASE_DIR, "templates")

@asynccontextmanager
async def lifespan(app: FastAPI):
    async with AsyncSessionLocal() as db:
        from app.crud.init_db import setup_initial_data
        await setup_initial_data(db)
    yield

app = FastAPI(
    title="Словарик API",
    description="Веб-сервис для анализа поисковых запросов на основе Яндекс.Вордстат",
    lifespan=lifespan
)

# Настройка CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Подключение роутеров и статики
app.include_router(auth.router)
app.include_router(wordstat.router, prefix="/wordstat", tags=["Wordstat"])
app.include_router(statistics.router)

# Монтируем статику
if os.path.exists(TEMPLATES_DIR):
    app.mount("/static", StaticFiles(directory=TEMPLATES_DIR), name="static")

@app.get("/", include_in_schema=False)
async def read_index():
    """Главная страница."""
    return FileResponse(os.path.join(TEMPLATES_DIR, "index.html"))