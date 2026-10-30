from typing import Optional
from pydantic import BaseModel, ConfigDict


class StateResponse(BaseModel):
    id: int
    name: str
    code: str
    is_active: bool

    model_config = ConfigDict(from_attributes=True)


class DistrictResponse(BaseModel):
    id: int
    state_id: int
    name: str
    code: Optional[str] = None
    is_active: bool

    model_config = ConfigDict(from_attributes=True)


class TalukaResponse(BaseModel):
    id: int
    district_id: int
    name: str
    code: Optional[str] = None
    is_active: bool

    model_config = ConfigDict(from_attributes=True)


class VillageResponse(BaseModel):
    id: int
    taluka_id: int
    name: str
    code: Optional[str] = None
    is_active: bool

    model_config = ConfigDict(from_attributes=True)
