from typing import Optional
from pydantic import BaseModel, ConfigDict


class VillageBriefResponse(BaseModel):
    id: int
    name: str
    taluka_id: int
    taluka_name: Optional[str] = None
    district_name: Optional[str] = "Pune"
    state_name: Optional[str] = "Maharashtra"

    model_config = ConfigDict(from_attributes=True)


class FarmerBriefResponse(BaseModel):
    id: int
    full_name: str
    farmer_code: str

    model_config = ConfigDict(from_attributes=True)


class FieldLookupResponse(BaseModel):
    id: int
    gat_no: str
    area: Optional[float] = None
    area_ha: Optional[float] = None
    area_acres: Optional[float] = None
    area_unit: str = "hectare"
    is_demo: bool = True
    is_active: bool = True
    geometry_wkt: Optional[str] = None
    geometry: Optional[dict] = None
    village: Optional[VillageBriefResponse] = None
    farmer: Optional[FarmerBriefResponse] = None

    model_config = ConfigDict(from_attributes=True)


class AuthorizedFieldDetailResponse(BaseModel):
    id: int
    gat_no: str
    area: Optional[float] = None
    area_ha: Optional[float] = None
    area_acres: Optional[float] = None
    area_unit: str = "hectare"
    village: str
    taluka: str
    district: str
    state: str
    farmer_name: Optional[str] = None
    is_demo: bool = True
    geometry: Optional[dict] = None

    model_config = ConfigDict(from_attributes=True)

