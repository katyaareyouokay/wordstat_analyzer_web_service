from datetime import datetime, date
from typing import Optional, List
from sqlalchemy import (String, Integer, ForeignKey, DateTime, Date, Float,
                        Text, Index, CheckConstraint)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from sqlalchemy import func


class Base(DeclarativeBase):
    pass


# Cправочники

class Role(Base):
    """Роли пользователей (админ, обычный пользователь и т.д.)"""
    __tablename__ = 'roles'

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)

    users: Mapped[List['User']] = relationship(back_populates='role')


class User(Base):
    """Пользователи системы"""
    __tablename__ = 'users'

    id: Mapped[int] = mapped_column(primary_key=True)
    role_id: Mapped[int] = mapped_column(ForeignKey('roles.id'),
                                         nullable=False
                                         )
    full_name: Mapped[str] = mapped_column(String(150), nullable=False)
    login: Mapped[str] = mapped_column(String(100),
                                       unique=True, nullable=False
                                       )
    password: Mapped[str] = mapped_column(String(255), nullable=False)

    role: Mapped['Role'] = relationship(back_populates='users')
    search_phrases: Mapped[List['SearchPhrase']] = relationship(back_populates='user')
    top_requests: Mapped[List['TopRequest']] = relationship(back_populates='user')
    dynamics: Mapped[List['Dynamics']] = relationship(back_populates='user')
    regions_requests: Mapped[List['RegionsRequest']] = relationship(back_populates='user')


class Region(Base):
    """Регионы"""
    __tablename__ = 'regions'

    id: Mapped[int] = mapped_column(primary_key=True)
    label: Mapped[str] = mapped_column(Text, nullable=False)

    top_requests: Mapped[List['TopRequest']] = relationship(back_populates='region')
    dynamics: Mapped[List['Dynamics']] = relationship(back_populates='region')
    regions_requests_items: Mapped[List['RegionsRequestItem']] = relationship(back_populates='region')


class Device(Base):
    """Типы устройств"""
    __tablename__ = 'devices'

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)

    # для top_requests
    top_requests_as_device1: Mapped[List['TopRequest']] = relationship(
        foreign_keys='TopRequest.device1_id', back_populates='device1')
    top_requests_as_device2: Mapped[List['TopRequest']] = relationship(
        foreign_keys='TopRequest.device2_id', back_populates='device2')
    top_requests_as_device3: Mapped[List['TopRequest']] = relationship(
        foreign_keys='TopRequest.device3_id', back_populates='device3')
    # для dynamics
    dynamics_as_device1: Mapped[List['Dynamics']] = relationship(
        foreign_keys='Dynamics.device1_id', back_populates='device1')
    dynamics_as_device2: Mapped[List['Dynamics']] = relationship(
        foreign_keys='Dynamics.device2_id', back_populates='device2')
    dynamics_as_device3: Mapped[List['Dynamics']] = relationship(
        foreign_keys='Dynamics.device3_id', back_populates='device3')
    # для regions_requests
    regions_requests_as_device1: Mapped[List['RegionsRequest']] = relationship(
        foreign_keys='RegionsRequest.device1_id', back_populates='device1')
    regions_requests_as_device2: Mapped[List['RegionsRequest']] = relationship(
        foreign_keys='RegionsRequest.device2_id', back_populates='device2')
    regions_requests_as_device3: Mapped[List['RegionsRequest']] = relationship(
        foreign_keys='RegionsRequest.device3_id', back_populates='device3')


class SearchPhrase(Base):
    """Поисковые фразы"""
    __tablename__ = 'search_phrases'

    id: Mapped[int] = mapped_column(primary_key=True)
    phrase: Mapped[str] = mapped_column(Text, unique=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    user_id: Mapped[Optional[int]] = mapped_column(ForeignKey('users.id'), nullable=True)

    user: Mapped[Optional['User']] = relationship(back_populates='search_phrases')
    top_requests: Mapped[List['TopRequest']] = relationship(back_populates='search_phrase')
    dynamics: Mapped[List['Dynamics']] = relationship(back_populates='search_phrase')
    regions_requests: Mapped[List['RegionsRequest']] = relationship(back_populates='search_phrase')
    top_request_items: Mapped[List['TopRequestItem']] = relationship(back_populates='search_phrase')
    dynamics_points: Mapped[List['DynamicsPoint']] = relationship(back_populates='search_phrase')
    regions_requests_items: Mapped[List['RegionsRequestItem']] = relationship(back_populates='search_phrase')


# Основные таблицы

class TopRequest(Base):
    """
    Запросы на получение топа запросов (один логический запрос может состоять из нескольких строк с одинаковым group_id)
    """
    __tablename__ = 'top_requests'

    id: Mapped[int] = mapped_column(primary_key=True)
    group_id: Mapped[int] = mapped_column(Integer,
                                          nullable=False,
                                          comment='Идентификатор группы'
                                          )
    search_phrase_id: Mapped[int] = mapped_column(ForeignKey('search_phrases.id'),
                                                  nullable=False
                                                  )
    requested_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    region_id: Mapped[Optional[int]] = mapped_column(ForeignKey('regions.id'), nullable=True)
    device1_id: Mapped[Optional[int]] = mapped_column(ForeignKey('devices.id'), nullable=True)
    device2_id: Mapped[Optional[int]] = mapped_column(ForeignKey('devices.id'), nullable=True)
    device3_id: Mapped[Optional[int]] = mapped_column(ForeignKey('devices.id'), nullable=True)
    total_count: Mapped[Optional[int]] = mapped_column(Integer)
    user_id: Mapped[Optional[int]] = mapped_column(ForeignKey('users.id'), nullable=True)

    search_phrase: Mapped['SearchPhrase'] = relationship(back_populates='top_requests')
    region: Mapped[Optional['Region']] = relationship(back_populates='top_requests')
    device1: Mapped[Optional['Device']] = relationship(foreign_keys=[device1_id], back_populates='top_requests_as_device1')
    device2: Mapped[Optional['Device']] = relationship(foreign_keys=[device2_id], back_populates='top_requests_as_device2')
    device3: Mapped[Optional['Device']] = relationship(foreign_keys=[device3_id], back_populates='top_requests_as_device3')
    user: Mapped[Optional['User']] = relationship(back_populates='top_requests')
    items: Mapped[List['TopRequestItem']] = relationship(back_populates='top_request', cascade='all, delete-orphan')


class TopRequestItem(Base):
    """Элементы топа (результаты по каждой связанной фразе)"""
    __tablename__ = 'top_request_items'

    id: Mapped[int] = mapped_column(primary_key=True)
    top_request_id: Mapped[int] = mapped_column(ForeignKey('top_requests.id', ondelete='CASCADE'), nullable=False)
    search_phrase_id: Mapped[Optional[int]] = mapped_column(ForeignKey('search_phrases.id'), nullable=True, comment='Связанная фраза (если присутствует в справочнике)')
    phrase: Mapped[str] = mapped_column(Text, nullable=False, comment='Текст фразы (денормализовано для быстрого доступа)')
    count: Mapped[int] = mapped_column(Integer, nullable=False)
    __table_args__ = (
        CheckConstraint('count > 0'),
    )

    top_request: Mapped['TopRequest'] = relationship(back_populates='items')
    search_phrase: Mapped[Optional['SearchPhrase']] = relationship(back_populates='top_request_items')


class Dynamics(Base):
    """
    Запросы на получение динамики (один логический запрос может состоять из нескольких строк с одинаковым group_id)
    """
    __tablename__ = 'dynamics'

    id: Mapped[int] = mapped_column(primary_key=True)
    group_id: Mapped[int] = mapped_column(Integer, nullable=False, comment='Идентификатор группы (повторяется для одного логического запроса с несколькими фразами)')
    search_phrase_id: Mapped[int] = mapped_column(ForeignKey('search_phrases.id'), nullable=False)
    requested_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    from_date: Mapped[date] = mapped_column(Date, nullable=False)
    to_date: Mapped[date] = mapped_column(Date, nullable=False)
    period: Mapped[str] = mapped_column(String(20), nullable=False)
    region_id: Mapped[Optional[int]] = mapped_column(ForeignKey('regions.id'), nullable=True)
    device1_id: Mapped[Optional[int]] = mapped_column(ForeignKey('devices.id'), nullable=True)
    device2_id: Mapped[Optional[int]] = mapped_column(ForeignKey('devices.id'), nullable=True)
    device3_id: Mapped[Optional[int]] = mapped_column(ForeignKey('devices.id'), nullable=True)
    user_id: Mapped[Optional[int]] = mapped_column(ForeignKey('users.id'), nullable=True)

    search_phrase: Mapped['SearchPhrase'] = relationship(back_populates='dynamics')
    region: Mapped[Optional['Region']] = relationship(back_populates='dynamics')
    device1: Mapped[Optional['Device']] = relationship(foreign_keys=[device1_id], back_populates='dynamics_as_device1')
    device2: Mapped[Optional['Device']] = relationship(foreign_keys=[device2_id], back_populates='dynamics_as_device2')
    device3: Mapped[Optional['Device']] = relationship(foreign_keys=[device3_id], back_populates='dynamics_as_device3')
    user: Mapped[Optional['User']] = relationship(back_populates='dynamics')
    points: Mapped[List['DynamicsPoint']] = relationship(back_populates='dynamics', cascade='all, delete-orphan')


class DynamicsPoint(Base):
    """Точки динамики (значения по датам)"""
    __tablename__ = 'dynamics_points'

    id: Mapped[int] = mapped_column(primary_key=True)
    dynamics_id: Mapped[int] = mapped_column(ForeignKey('dynamics.id', ondelete='CASCADE'), nullable=False)
    search_phrase_id: Mapped[Optional[int]] = mapped_column(ForeignKey('search_phrases.id'), nullable=True, comment='Связанная фраза (если нужна дополнительная привязка)')
    point_date: Mapped[date] = mapped_column(Date, nullable=False)
    count: Mapped[int] = mapped_column(Integer, nullable=False)
    share: Mapped[float] = mapped_column(Float, nullable=False)
    __table_args__ = (
        CheckConstraint('count >= 0'),
        CheckConstraint('share BETWEEN 0 AND 1'),
    )

    dynamics: Mapped['Dynamics'] = relationship(back_populates='points')
    search_phrase: Mapped[Optional['SearchPhrase']] = relationship(back_populates='dynamics_points')


class RegionsRequest(Base):
    """
    Запросы для регионов (один логический запрос может состоять из нескольких строк с одинаковым group_id)
    """
    __tablename__ = 'regions_requests'

    id: Mapped[int] = mapped_column(primary_key=True)
    group_id: Mapped[int] = mapped_column(Integer, nullable=False, comment='Идентификатор группы (повторяется для одного логического запроса с несколькими фразами)')
    user_id: Mapped[Optional[int]] = mapped_column(ForeignKey('users.id'), nullable=True)
    search_phrase_id: Mapped[int] = mapped_column(ForeignKey('search_phrases.id'), nullable=False)
    requested_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    region_type: Mapped[Optional[str]] = mapped_column(String(50), comment='Тип региона (например, "country", "city")')
    device1_id: Mapped[Optional[int]] = mapped_column(ForeignKey('devices.id'), nullable=True)
    device2_id: Mapped[Optional[int]] = mapped_column(ForeignKey('devices.id'), nullable=True)
    device3_id: Mapped[Optional[int]] = mapped_column(ForeignKey('devices.id'), nullable=True)

    user: Mapped[Optional['User']] = relationship(back_populates='regions_requests')
    search_phrase: Mapped['SearchPhrase'] = relationship(back_populates='regions_requests')
    device1: Mapped[Optional['Device']] = relationship(foreign_keys=[device1_id], back_populates='regions_requests_as_device1')
    device2: Mapped[Optional['Device']] = relationship(foreign_keys=[device2_id], back_populates='regions_requests_as_device2')
    device3: Mapped[Optional['Device']] = relationship(foreign_keys=[device3_id], back_populates='regions_requests_as_device3')
    items: Mapped[List['RegionsRequestItem']] = relationship(back_populates='regions_request', cascade='all, delete-orphan')


class RegionsRequestItem(Base):
    """Элементы ответа для запросов по регионам (метрики по регионам)"""
    __tablename__ = 'regions_requests_items'

    id: Mapped[int] = mapped_column(primary_key=True)
    regions_requests_id: Mapped[int] = mapped_column(ForeignKey('regions_requests.id', ondelete='CASCADE'), nullable=False)
    search_phrase_id: Mapped[int] = mapped_column(ForeignKey('search_phrases.id'), nullable=False)
    region_id: Mapped[int] = mapped_column(ForeignKey('regions.id'), nullable=False)
    count: Mapped[int] = mapped_column(Integer, nullable=False)
    share: Mapped[float] = mapped_column(Float, nullable=False)
    affinity_index: Mapped[Optional[float]] = mapped_column(Float)
    __table_args__ = (
        CheckConstraint('count >= 0'),
        CheckConstraint('share BETWEEN 0 AND 1'),
    )

    regions_request: Mapped['RegionsRequest'] = relationship(back_populates='items')
    search_phrase: Mapped['SearchPhrase'] = relationship(back_populates='regions_requests_items')
    region: Mapped['Region'] = relationship(back_populates='regions_requests_items')


# Индексы

Index('idx_users_role', User.role_id)

Index('idx_search_phrases_user', SearchPhrase.user_id)

Index('idx_top_requests_group', TopRequest.group_id)
Index('idx_top_requests_search_phrase', TopRequest.search_phrase_id)
Index('idx_top_requests_region', TopRequest.region_id)
Index('idx_top_requests_user', TopRequest.user_id)
Index('idx_top_requests_device1', TopRequest.device1_id)
Index('idx_top_requests_device2', TopRequest.device2_id)
Index('idx_top_requests_device3', TopRequest.device3_id)

Index('idx_top_request_items_top_request', TopRequestItem.top_request_id)
Index('idx_top_request_items_search_phrase', TopRequestItem.search_phrase_id)

Index('idx_dynamics_group', Dynamics.group_id)
Index('idx_dynamics_search_phrase', Dynamics.search_phrase_id)
Index('idx_dynamics_region', Dynamics.region_id)
Index('idx_dynamics_user', Dynamics.user_id)
Index('idx_dynamics_device1', Dynamics.device1_id)
Index('idx_dynamics_device2', Dynamics.device2_id)
Index('idx_dynamics_device3', Dynamics.device3_id)

Index('idx_dynamics_points_dynamics', DynamicsPoint.dynamics_id)
Index('idx_dynamics_points_search_phrase', DynamicsPoint.search_phrase_id)

Index('idx_regions_requests_group', RegionsRequest.group_id)
Index('idx_regions_requests_user', RegionsRequest.user_id)
Index('idx_regions_requests_search_phrase', RegionsRequest.search_phrase_id)
Index('idx_regions_requests_device1', RegionsRequest.device1_id)
Index('idx_regions_requests_device2', RegionsRequest.device2_id)
Index('idx_regions_requests_device3', RegionsRequest.device3_id)

Index('idx_regions_requests_items_request', RegionsRequestItem.regions_requests_id)
Index('idx_regions_requests_items_search_phrase', RegionsRequestItem.search_phrase_id)
Index('idx_regions_requests_items_region', RegionsRequestItem.region_id)