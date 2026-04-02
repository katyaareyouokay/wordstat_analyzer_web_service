import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv


load_dotenv()


class DatabaseManager:
    def __init__(self):
        self.engine = None
        self.SessionLocal = None

    def get_connection_string(self):
        connection_string = os.getenv('DATABASE_URL')
        if not connection_string:
            raise ValueError("Не найдена строка подключения в .env файле")
        return connection_string

    def connect(self):
        connection_string = self.get_connection_string()
        print("Подключение к локальной базе данных")

        # параметр кодировки
        if '?' in connection_string:
            connection_string += '&client_encoding=utf8'
        else:
            connection_string += '?client_encoding=utf8'

        self.engine = create_engine(connection_string)
        self.SessionLocal = sessionmaker(autocommit=False, autoflush=False,
                                         bind=self.engine)
        return self.engine

    def get_session(self):
        if not self.SessionLocal:
            self.connect()
        return self.SessionLocal()

    def disconnect(self):
        if self.engine:
            self.engine.dispose()


# глобальный экземпляр менеджера
db = DatabaseManager()
