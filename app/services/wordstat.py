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

    async def _make_request(self, endpoint: str, json_data: Dict[str, Any]) -> \
            Dict[str, Any]:
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
                    return {"error": f"Ошибка {response.status_code}",
                            "detail": response.text}
                return response.json()
            except httpx.ConnectError as e:
                return {"error": "Сетевая ошибка при подключении к Яндексу",
                        "detail": str(e)}

    async def get_top_requests(self, phrase: str,
                               regions: Optional[List[int]] = None,
                               devices: list[int] = None):
        if not regions:
            regions = [1]

        json_data = {
            "phrase": phrase,
            "regions": regions
        }

        if devices:
            # Если пришел ID 4 или список пуст - по умолчанию "all"
            if 4 in devices or not devices:
                json_data["devices"] = ["all"]
            else:
                # Сопоставляем ID со строками Яндекса
                dev_mapping = {1: "phone", 2: "desktop", 3: "tablet"}
                selected_devs = [dev_mapping[d] for d in devices if
                                 d in dev_mapping]

                if selected_devs:
                    json_data["devices"] = selected_devs
                else:
                    json_data["devices"] = ["all"]
        else:
            json_data["devices"] = ["all"]

        return await self._make_request("/v1/topRequests", json_data)

    async def get_dynamics(
            self,
            phrase: str,
            period: str,
            from_date: str,
            to_date: str,
            regions: list[int] = None,
            devices: list[int] = None
    ):
        json_data = {
            "phrase": phrase,
            "period": period,
            "fromDate": from_date
        }

        if to_date:
            json_data["toDate"] = to_date

        if regions:
            json_data[
                "regions"] = regions

        if devices:
            # Если пришел ID 4 или список пуст - по умолчанию "all"
            if 4 in devices or not devices:
                json_data["devices"] = ["all"]
            else:
                # Сопоставляем ваши ID (1,2,3) со строками Яндекса
                dev_mapping = {1: "phone", 2: "desktop", 3: "tablet"}
                selected_devs = [dev_mapping[d] for d in devices if
                                 d in dev_mapping]

                if selected_devs:
                    json_data["devices"] = selected_devs
                else:
                    json_data["devices"] = ["all"]
        else:
            json_data["devices"] = ["all"]

        return await self._make_request("/v1/dynamics", json_data)

    async def get_regions_distribution(self, phrase: str,
                                       region_type: str = "all"):
        return await self._make_request("/v1/regions", {"phrase": phrase,
                                                        "regionType": region_type})

    async def get_all_regions(self):
        """Получает полный справочник регионов из Яндекса"""
        return await self._make_request("/v1/getRegionsTree", {})


wordstat_service = YandexWordstatService()
