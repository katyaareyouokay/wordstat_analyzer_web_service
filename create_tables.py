import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))

from app.database import db
from app.models import Base

def create_tables():
    try:
        engine = db.connect()
        print("Создание таблиц...")
        Base.metadata.create_all(bind=engine)
        print("Таблицы созданы")
    except Exception as e:
        print(f"Ошибка: {e}")
        return False
    finally:
        db.disconnect()
    return True

if __name__ == "__main__":
    create_tables()