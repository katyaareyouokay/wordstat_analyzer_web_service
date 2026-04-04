FROM python:3.11-slim

# Установка рабочей директории в контейнере
WORKDIR /app

# Установка системных зависимостей
RUN apt-get update && apt-get install -y gcc libpq-dev && rm -rf /var/lib/apt/lists/*

# Копируем зависимости
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Копируем всё содержимое проекта в папку /app в контейнере
COPY . .

# Запуск приложения
# В Dockerfile меняем последнюю строку:
CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]