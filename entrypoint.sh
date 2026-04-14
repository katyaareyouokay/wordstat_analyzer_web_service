#!/bin/bash
set -e

# Ждём, пока PostgreSQL поднимется
echo "Waiting for PostgreSQL at $POSTGRES_HOST:$POSTGRES_PORT..."
python << END
import socket
import time
import os

host = os.getenv('POSTGRES_HOST', 'db')
port = int(os.getenv('POSTGRES_PORT', 5432))

while True:
    try:
        with socket.create_connection((host, port), timeout=1):
            break
    except OSError:
        time.sleep(0.5)
END
echo "PostgreSQL is ready"

# Создаём таблицы в БД
echo "Создание таблиц..."
python create_tables.py

# ЗАПУСКАЕМ СЕРВЕР ВМЕСТО СКРИПТА
echo "Запуск FastAPI сервера..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload