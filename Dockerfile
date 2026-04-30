FROM python:3.11-slim-bookworm

# Установка рабочей директории в контейнере
WORKDIR /app

# Копируем зависимости
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Копируем всё содержимое проекта в папку /app в контейнере
COPY . .

# Запуск приложения
CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]