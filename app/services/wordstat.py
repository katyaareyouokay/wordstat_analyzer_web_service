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

    async def get_top_requests(self, phrase: str,
                               regions: Optional[List[int]] = None) -> Dict[
        str, Any]:
        """Метод для получения топа запросов по одной фразе"""
        json_data = {"phrase": phrase}
        if regions:
            json_data["regions"] = regions

        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/v1/topRequests",
                headers=self.headers,
                json=json_data
            )

            if response.status_code != 200:
                return {"error": f"Ошибка {response.status_code}",
                        "detail": response.text}

            return response.json()


wordstat_service = YandexWordstatService()