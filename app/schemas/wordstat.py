from pydantic import BaseModel, Field, model_validator
from typing import Optional, List


def _strip_phrases(phrases: List[str]) -> List[str]:
    return [p.strip() for p in phrases if isinstance(p, str) and p.strip()]


class SearchRequest(BaseModel):
    """Одна фраза в `phrase` или несколько в `phrases` (один логический запрос — один group_id)."""

    phrase: str = ""
    phrases: List[str] = Field(default_factory=list)
    regions: list[int] = Field(default_factory=list)
    devices: list[int] = Field(default_factory=list)

    @model_validator(mode="after")
    def _at_least_one_phrase(self):
        if not _strip_phrases(self.phrases) and not (self.phrase or "").strip():
            raise ValueError("Укажите phrase или непустой список phrases")
        return self

    def resolved_phrases(self) -> List[str]:
        out = _strip_phrases(self.phrases)
        if out:
            return out
        return [(self.phrase or "").strip()]


class DynamicsRequest(BaseModel):
    phrase: str = ""
    phrases: List[str] = Field(default_factory=list)
    period: str = "monthly"
    from_date: str
    to_date: Optional[str] = None
    regions: List[int] = Field(default_factory=list)
    devices: List[int] = Field(default_factory=list)

    @model_validator(mode="after")
    def _at_least_one_phrase_dyn(self):
        if not _strip_phrases(self.phrases) and not (self.phrase or "").strip():
            raise ValueError("Укажите phrase или непустой список phrases")
        return self

    def resolved_phrases(self) -> List[str]:
        out = _strip_phrases(self.phrases)
        if out:
            return out
        return [(self.phrase or "").strip()]


class RegionsRequest(BaseModel):
    phrase: str = ""
    phrases: List[str] = Field(default_factory=list)
    region_type: str = "all"
    devices: list[int] = Field(default_factory=list)

    @model_validator(mode="after")
    def _at_least_one_phrase_reg(self):
        if not _strip_phrases(self.phrases) and not (self.phrase or "").strip():
            raise ValueError("Укажите phrase или непустой список phrases")
        return self

    def resolved_phrases(self) -> List[str]:
        out = _strip_phrases(self.phrases)
        if out:
            return out
        return [(self.phrase or "").strip()]
