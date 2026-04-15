from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles  
from fastapi.responses import FileResponse   
import os
from app.api import auth, wordstat

# Путь к папке templates
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
TEMPLATES_DIR = os.path.join(BASE_DIR, "templates")


app = FastAPI(
    title="Словарик API",
    description="Веб-сервис для анализа поисковых запросов на основе Яндекс.Вордстат",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Монтируем папку templates под префиксом /static
app.mount("/static", StaticFiles(directory=TEMPLATES_DIR), name="static")

app.include_router(auth.router, prefix="/auth", tags=["Auth"])
app.include_router(wordstat.router, prefix="/wordstat", tags=["Wordstat"])

@app.get("/")
async def read_index():
    html_path = os.path.join(BASE_DIR, "templates", "index.html")
    return FileResponse(html_path)