import os
import requests
from dotenv import load_dotenv
from typing import Optional, List, Dict, Any
import time
from logger import get_logger

logger = get_logger(__name__)

MAX_REQUESTS_PER_RUN = 100  # ограничение на число фраз за раз


class YandexWordstatConnector:
    def __init__(self, token: str):
        self.base_url = "https://api.wordstat.yandex.net"
        self.token = token
        self.headers = {
            "Content-Type": "application/json;charset=utf-8",
            "Authorization": f"Bearer {self.token}",
        }

    def _make_request(
        self,
        method: str,
        endpoint: str,
        params: Optional[Dict[str, Any]] = None,
        json_data: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        url = f"{self.base_url}{endpoint}"
        try:
            response = requests.request(
                method=method,
                url=url,
                headers=self.headers,
                params=params,
                json=json_data,
            )
            if response.status_code != 200:
                logger.error(f"{method} {url} failed: ")
                raise Exception(
                    f"Ошибка запроса: {response.status_code}, {response.text}"
                )

            logger.info(f"{method} {url} succeeded.")
            return response.json()

        except requests.exceptions.RequestException as e:
            logger.error(f"Requests error during {method} {url}: {e}")
            raise

    def get_regions(self) -> List[dict[str, Any]]:
        try:
            regions_data = self._make_request(
                "POST", "/v1/getRegionsTree", json_data={}
            )
        except Exception as e:
            logger.error(f"Не удалось получить регионы: {e}")
            raise

        def extract_regions(data: dict[str, Any]) -> List[dict[str, Any]]:
            regions = []
            if "value" in data:
                regions.append(
                    {"value": (data["value"]),
                     "label": (data["label"])}
                )
            if "children" in data and isinstance(data["children"], list):
                for child in data["children"]:
                    regions.extend(extract_regions(child))
            return regions

        all_ids = []
        for root in regions_data:
            all_ids.extend(extract_regions(data=root))
        return all_ids

    def get_top_requests(
        self,
        phrase: str,
        regions: Optional[List[int]] = None,
        devices: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        json_data = {"phrase": phrase}
        if regions:
            json_data["regions"] = regions
        if devices:
            json_data["devices"] = devices     
        return self._make_request(
            "POST", "/v1/topRequests", json_data=json_data
        )

    def get_dynamics(
        self,
        phrase: str,
        period: str,
        from_date: str,
        to_date: Optional[str] = None,
        regions: Optional[List[int]] = None,
        devices: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        json_data = {
            "phrase": phrase,
            "period": period,
            "fromDate": from_date,
        }
        if to_date:
            json_data["toDate"] = to_date
        if regions:
            json_data["regions"] = regions
        if devices:
            json_data["devices"] = devices
        return self._make_request(
            "POST", "/v1/dynamics", json_data=json_data
        )

    def get_regions_distribution(
        self,
        phrase: str,
        region_type: str = "all",
        devices: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        json_data = {
            "phrase": phrase,
            "regionType": region_type,
        }

        if devices:
            json_data["devices"] = devices

        return self._make_request(
            "POST", "/v1/regions", json_data=json_data
        )

    def get_top_requests_batch(
        self,
        phrases: List[str],
        regions: Optional[List[int]] = None,
        devices: Optional[List[str]] = None,
        pause_seconds: float = 0.5,
    ) -> Dict[str, Dict[str, Any]]:
        if len(phrases) > MAX_REQUESTS_PER_RUN:
            raise ValueError(f"превышен максимум {MAX_REQUESTS_PER_RUN}!")
        results = {}
        for phrase in phrases:
            logger.info(f"запрашиваю топ по фразе: {phrase}")
            try:
                result = self.get_top_requests(
                    phrase, regions=regions, devices=devices
                )
                results[phrase] = result
            except Exception as e:
                results[phrase] = {"ошибка": str(e)}
            time.sleep(pause_seconds)
        return results

    def get_dynamics_batch(
        self,
        phrases: List[str],
        period: str,
        from_date: str,
        to_date: Optional[str] = None,
        regions: Optional[List[int]] = None,
        devices: Optional[List[str]] = None,
        pause_seconds: float = 0.5,
    ) -> Dict[str, Dict[str, Any]]:
        if len(phrases) > MAX_REQUESTS_PER_RUN:
            raise ValueError(f"превышен максимум {MAX_REQUESTS_PER_RUN}!")
        results = {}
        for phrase in phrases:
            logger.info(f"запрашиваю динамику по фразе: {phrase}")
            try:
                result = self.get_dynamics(
                    phrase=phrase,
                    period=period,
                    from_date=from_date,
                    to_date=to_date,
                    regions=regions,
                    devices=devices,
                )
                results[phrase] = result
            except Exception as e:
                results[phrase] = {"ошибка": str(e)}
            time.sleep(pause_seconds)
        return results

    def get_regions_distribution_batch(
        self,
        phrases: List[str],
        region_type: str = "all",
        devices: Optional[List[str]] = None,
        pause_seconds: float = 0.5,
    ) -> Dict[str, Dict[str, Any]]:
        if len(phrases) > MAX_REQUESTS_PER_RUN:
            raise ValueError(f"превышен максимум {MAX_REQUESTS_PER_RUN}!")

        results = {}

        for phrase in phrases:
            logger.info(f"запрашиваю распределение по регионам: {phrase}")
            try:
                result = self.get_regions_distribution(
                    phrase=phrase,
                    region_type=region_type,
                    devices=devices,  # ← как есть
                )
                results[phrase] = result
            except Exception as e:
                results[phrase] = {"ошибка": str(e)}

            time.sleep(pause_seconds)
        return results

    def phrases_to_list(self, phrases_str: str) -> List[str]:
        phrases = []
        for line in phrases_str.splitlines():
            for phrase in line.split(","):
                cleaned = phrase.strip()
                if cleaned:
                    phrases.append(cleaned)
        return phrases


if __name__ == "__main__":
    load_dotenv()

    TOKEN = os.getenv("YANDEX_WORDSTAT_TOKEN")
    if not TOKEN:
        raise ValueError(
            "YANDEX_WORDSTAT_TOKEN не найден")

    client = YandexWordstatConnector(token=TOKEN)

    valid_regions = client.get_regions()
    logger.info(f"Первые 10 регионов{valid_regions[:10]}")

    # пример использования
    raw_input = "купить телефон, пицца москва\nманикюр на дому"
    phrases = client.phrases_to_list(raw_input)
    logger.info(f"Введенные фразы: {phrases}")
    
    # пример запроса топов
    result1 = client.get_top_requests_batch(
        phrases=phrases,
        regions=[213, 21624, 216],
        devices=["phone", "desktop"]
    )
    logger.info(f"Результат выполнения запросов топов: {result1}")
    
    # пример запроса динамики
    result2 = client.get_dynamics_batch(
        phrases=phrases,
        period="weekly",
        from_date="2025-05-05",
        regions=[213, 21624, 216],
        devices=["desktop", "phone"],
    )
    logger.info(f"Результат выполнения запросов динамики: {result2}")
    
    # пример запроса распределения по регионам
    result3 = client.get_regions_distribution_batch(
        phrases=phrases,
        region_type="cities",  # или "all", "regions"
        devices=["desktop", "phone"],
    )

    logger.info(f"Результат распределения по регионам: {result3}")
    
    pass
