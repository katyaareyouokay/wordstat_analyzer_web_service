from database import db
from models import Base


def create_tables():
    try:
        engine = db.connect()
        print("Создание таблиц в базе данных")
        Base.metadata.create_all(bind=engine)

        print("Таблицы успешно созданы")

    except Exception as e:
        print(f"Ошибка при создании таблиц: {e}")
        return False
    finally:
        db.disconnect()

    return True


if __name__ == "__main__":
    create_tables()
