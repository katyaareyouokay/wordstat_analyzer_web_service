from fastapi import FastAPI

app = FastAPI(
    title="Словарик API",
    description="Веб-сервис для анализа поисковых запросов на основе Яндекс.Вордстат",
    version="1.0.0"
)

@app.get("/")
async def root():
    return {"status": "ok", "message": "Бэкенд команды «Словарик» успешно запущен!"}