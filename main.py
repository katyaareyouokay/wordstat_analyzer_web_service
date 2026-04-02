from dotenv import dotenv_values
from yandex_wordstat_connector import YandexWordstatConnector
from logger import get_logger

logger = get_logger(__name__)


if __name__ == "__main__":
    config = dotenv_values(".env")
    TOKEN = config["YANDEX_WORDSTAT_TOKEN"]
    client = YandexWordstatConnector(token=TOKEN)

    valid_regions = client.get_regions()
    logger.info(f"Первые 10 регионов{valid_regions[:10]}")

    # пример использования
    raw_input = "купить телефон, пицца москва\nманикюр на дому"
    phrases = client.phrases_to_list(raw_input)
    logger.info(f"Введенные фразы: {phrases}")

    # пример запроса топов
    result1 = client.get_top_requests_batch(
        phrases=phrases, regions=[213], devices=["phone"]
    )
    logger.info(f"Результат выполнения запросов топов: {result1}")

    # пример запроса динамики
    result2 = client.get_dynamics_batch(
        phrases=phrases,
        period="weekly",
        from_date="2025-05-05",
        regions=[2],
        devices=["desktop"],
    )
    logger.info(f"Результат выполнения запросов динамики: {result2}")
    pass
