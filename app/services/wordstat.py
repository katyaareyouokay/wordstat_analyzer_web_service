import httpx
import re
from typing import Optional, List, Dict, Any
from app.core.config import settings

class YandexWordstatService:
    def __init__(self):
        self.base_url = "https://api.wordstat.yandex.net"
        self.headers = {
            "Content-Type": "application/json;charset=utf-8",
            "Authorization": f"Bearer {settings.YANDEX_WORDSTAT_TOKEN}",
        }
        # Словари для эвристического анализа намерений (интентов)
        self.intent_markers = {
            "Коммерческий": [
                "купить", "цена", "заказать", "стоимость", "доставка", "магазин", 
                "недорого", "прайс", "sale", "скидка", "под заказ"
            ],
            "Информационный": [
                "как", "почему", "что", "где", "отзывы", "форум", "своими руками", 
                "инструкция", "обзор", "рецепт", "значение", "определение"
            ],
            "Навигационный": [
                "озон", "ozon", "вайлдберриз", "wildberries", "авито", "wb", 
                "яндекс", "гугл", "сбер", "официальный сайт", "вход", "личный кабинет"
            ]
        }

    def _determine_intent(self, phrase: str) -> str:
        """Вспомогательный метод для определения интента одной фразы."""
        phrase_low = phrase.lower()
        
        for intent, markers in self.intent_markers.items():
            if any(marker in phrase_low for marker in markers):
                return intent
        return "Прочий"

    async def _make_request(self, endpoint: str, json_data: Dict[str, Any]) -> Dict[str, Any]:
        transport = httpx.AsyncHTTPTransport(retries=3)
        async with httpx.AsyncClient(transport=transport) as client:
            try:
                response = await client.post(
                    f"{self.base_url}{endpoint}",
                    headers=self.headers,
                    json=json_data,
                    timeout=30.0
                )
                if response.status_code != 200:
                    return {"error": f"Ошибка {response.status_code}", "detail": response.text}
                return response.json()
            except httpx.ConnectError as e:
                return {"error": "Сетевая ошибка при подключении к Яндексу", "detail": str(e)}

    async def get_top_requests(self, phrase: str, regions: Optional[List[int]] = None):
        """Получает топ запросов и обогащает их данными об интентах."""
        json_data = {"phrase": phrase, "regions": regions} if regions else {"phrase": phrase}
        raw_response = await self._make_request("/v1/topRequests", json_data)

        # Если Яндекс вернул ошибку, пробрасываем её дальше
        if "error" in raw_response or "data" not in raw_response:
            return raw_response

        # Обработка и разметка интентов
        top_requests = raw_response.get("data", {}).get("topRequests", [])
        
        for item in top_requests:
            # Добавляем новое поле intent к каждому объекту в списке
            item["intent"] = self._determine_intent(item["phrase"])

        return {
            "status": "success",
            "data": {
                "topRequests": top_requests
            }
        }

    async def get_dynamics(self, phrase: str, period: str, from_date: str, to_date: Optional[str] = None):
        json_data = {"phrase": phrase, "period": period, "fromDate": from_date}
        if to_date:
            json_data["toDate"] = to_date
        return await self._make_request("/v1/dynamics", json_data)

    async def get_regions_distribution(self, phrase: str, region_type: str = "all"):
        return await self._make_request("/v1/regions", {"phrase": phrase, "regionType": region_type})

wordstat_service = YandexWordstatService()