#!/bin/bash
set -e

# Ждём, пока PostgreSQL поднимется
echo "Waiting for PostgreSQL at $POSTGRES_HOST:$POSTGRES_PORT..."
while ! nc -z $POSTGRES_HOST $POSTGRES_PORT; do
  sleep 0.5
done
echo "PostgreSQL is ready"

# Создаём таблицы в БД (если ещё не созданы)
python create_tables.py

# Запускаем основной скрипт
python app/main.py