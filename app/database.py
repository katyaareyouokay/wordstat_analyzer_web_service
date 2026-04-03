import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

load_dotenv()


class DatabaseManager:
    def __init__(self):
        self.engine = None
        self.SessionLocal = None
        self._connected = False

    def get_connection_string(self):
        user = os.getenv('POSTGRES_USER')
        password = os.getenv('POSTGRES_PASSWORD')
        host = os.getenv('POSTGRES_HOST', 'localhost')
        port = os.getenv('POSTGRES_PORT', '5432')
        db = os.getenv('POSTGRES_DB')
        if not all([user, password, db]):
            raise ValueError(
                "Не заданы POSTGRES_USER, POSTGRES_PASSWORD или POSTGRES_DB")
        return f"postgresql://{user}:{password}@{host}:{port}/{db}"

    def connect(self):
        if self._connected:
            return self.engine

        connection_string = self.get_connection_string()
        print("Подключение к базе данных")

        # Настройки для PostgreSQL
        connect_args = {}
        if 'postgresql' in connection_string:
            connect_args = {"client_encoding": "utf8"}

        self.engine = create_engine(
            connection_string,
            connect_args=connect_args,
            pool_pre_ping=True,  # проверка соединения перед использованием
            echo=False  # можно включить True для отладки SQL
        )
        self.SessionLocal = sessionmaker(autocommit=False, autoflush=False,
                                         bind=self.engine)
        self._connected = True
        return self.engine

    def get_session(self):
        if not self._connected:
            self.connect()
        return self.SessionLocal()

    def disconnect(self):
        if self.engine:
            self.engine.dispose()
        self._connected = False


# Глобальный экземпляр
db = DatabaseManager()
