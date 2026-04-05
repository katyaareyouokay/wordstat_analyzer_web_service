import httpx
from typing import Optional, List, Dict, Any
from app.core.config import settings

class YandexWordstatService:
    def __init__(self):
        self.base_url = "https://api.wordstat.yandex.net"
        self.headers = {
            "Content-Type": "application/json;charset=utf-8",
            "Authorization": f"Bearer {settings.YANDEX_WORDSTAT_TOKEN}",
        }

    async def _make_request(self, endpoint: str, json_data: Dict[str, Any]) -> Dict[str, Any]:
        # Настраиваем 3 попытки переподключения при сбоях сети
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
        json_data = {"phrase": phrase, "regions": regions} if regions else {"phrase": phrase}
        return await self._make_request("/v1/topRequests", json_data)

    async def get_dynamics(self, phrase: str, period: str, from_date: str, to_date: Optional[str] = None):
        json_data = {"phrase": phrase, "period": period, "fromDate": from_date}
        if to_date:
            json_data["toDate"] = to_date
        return await self._make_request("/v1/dynamics", json_data)

    async def get_regions_distribution(self, phrase: str, region_type: str = "all"):
        return await self._make_request("/v1/regions", {"phrase": phrase, "regionType": region_type})

# Экземпляр сервиса, который мы будем импортировать в эндпоинтах
wordstat_service = YandexWordstatService()