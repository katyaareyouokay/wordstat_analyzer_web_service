import time
from datetime import datetime
from app.database import db
from app.models import (
    SearchPhrase, Region, Device,
    TopRequest, TopRequestItem,
    Dynamics, DynamicsPoint
)
from app.logger import get_logger

logger = get_logger(__name__)

def get_or_create_region(session, region_id: int):
    region = session.query(Region).filter_by(id=region_id).first()
    if not region:
        region = Region(id=region_id, label=f"Region_{region_id}")
        session.add(region)
        session.flush()
        logger.warning(f"Создан регион-заглушка для ID {region_id}")
    return region

def get_or_create_device(session, device_name: str):
    device = session.query(Device).filter_by(name=device_name).first()
    if not device:
        device = Device(name=device_name)
        session.add(device)
        session.flush()
        logger.info(f"Создано устройство: {device_name}")
    return device

def get_or_create_search_phrase(session, phrase_text: str, user_id=None):
    phrase = session.query(SearchPhrase).filter_by(phrase=phrase_text).first()
    if not phrase:
        phrase = SearchPhrase(phrase=phrase_text, user_id=user_id)
        session.add(phrase)
        session.flush()
    return phrase

def save_top_requests_batch(results: dict, regions: list, devices: list, user_id=None):
    session = db.get_session()
    try:
        group_id = int(time.time())
        region_id = regions[0] if regions else None
        device_objs = []
        for dev_name in devices[:3]:
            dev_obj = get_or_create_device(session, dev_name)
            device_objs.append(dev_obj)
        device_objs += [None] * (3 - len(device_objs))

        for phrase, api_response in results.items():
            if "ошибка" in api_response:
                logger.error(f"Ошибка для фразы '{phrase}': {api_response['ошибка']}")
                continue
            top_items = api_response.get("topRequests", [])
            total = api_response.get("totalCount", 0)
            if not top_items:
                logger.warning(f"Нет topRequests для фразы '{phrase}'")
                continue
            src_phrase_obj = get_or_create_search_phrase(session, phrase, user_id)
            top_req = TopRequest(
                group_id=group_id,
                search_phrase_id=src_phrase_obj.id,
                region_id=region_id,
                device1_id=device_objs[0].id if device_objs[0] else None,
                device2_id=device_objs[1].id if device_objs[1] else None,
                device3_id=device_objs[2].id if device_objs[2] else None,
                user_id=user_id,
                total_count=total
            )
            session.add(top_req)
            session.flush()
            for item in top_items:
                sub_phrase_text = item.get("phrase", "")
                count = item.get("count", 0)
                if not sub_phrase_text:
                    continue
                sub_phrase_obj = get_or_create_search_phrase(session, sub_phrase_text, user_id)
                top_item = TopRequestItem(
                    top_request_id=top_req.id,
                    search_phrase_id=sub_phrase_obj.id,
                    phrase=sub_phrase_text,
                    count=count
                )
                session.add(top_item)
        session.commit()
        logger.info(f"Сохранено {len(results)} записей topRequests")
    except Exception as e:
        session.rollback()
        logger.exception(f"Ошибка сохранения topRequests: {e}")
    finally:
        session.close()

def save_dynamics_batch(results: dict, period: str, from_date: str, to_date: str,
                        regions: list, devices: list, user_id=None):
    session = db.get_session()
    try:
        group_id = int(time.time())
        region_id = regions[0] if regions else None
        device_objs = []
        for dev_name in devices[:3]:
            dev_obj = get_or_create_device(session, dev_name)
            device_objs.append(dev_obj)
        device_objs += [None] * (3 - len(device_objs))

        for phrase, api_response in results.items():
            if "ошибка" in api_response:
                logger.error(f"Ошибка динамики для '{phrase}': {api_response['ошибка']}")
                continue
            dynamics_points = api_response.get("dynamics", [])
            if not dynamics_points:
                logger.warning(f"Нет dynamics для фразы '{phrase}'")
                continue
            src_phrase_obj = get_or_create_search_phrase(session, phrase, user_id)
            if not to_date and dynamics_points:
                last_date_str = dynamics_points[-1].get("date")
                if last_date_str:
                    to_date = last_date_str
            dynamics_record = Dynamics(
                group_id=group_id,
                search_phrase_id=src_phrase_obj.id,
                from_date=datetime.strptime(from_date, "%Y-%m-%d").date(),
                to_date=datetime.strptime(to_date, "%Y-%m-%d").date() if to_date else None,
                period=period,
                region_id=region_id,
                device1_id=device_objs[0].id if device_objs[0] else None,
                device2_id=device_objs[1].id if device_objs[1] else None,
                device3_id=device_objs[2].id if device_objs[2] else None,
                user_id=user_id
            )
            session.add(dynamics_record)
            session.flush()
            for point in dynamics_points:
                point_date = datetime.strptime(point["date"], "%Y-%m-%d").date()
                dyn_point = DynamicsPoint(
                    dynamics_id=dynamics_record.id,
                    search_phrase_id=src_phrase_obj.id,
                    point_date=point_date,
                    count=point.get("count", 0),
                    share=point.get("share", 0.0)
                )
                session.add(dyn_point)
        session.commit()
        logger.info(f"Сохранено {len(results)} записей dynamics")
    except Exception as e:
        session.rollback()
        logger.exception(f"Ошибка сохранения dynamics: {e}")
    finally:
        session.close()