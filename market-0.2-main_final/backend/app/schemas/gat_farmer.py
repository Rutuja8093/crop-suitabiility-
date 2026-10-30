from typing import List, Optional, Union
from pydantic import BaseModel, Field


class AssociatedFarmerItem(BaseModel):
    """Individual farmer associated with a specific cadastral Gat."""
    id: Union[int, str] = Field(..., description="Stable record identifier")
    name: str = Field(..., description="Full farmer name preserved in Marathi Unicode")
    source_row: Optional[int] = Field(None, description="Original source row index from Excel")


class GatFarmersLookupResponse(BaseModel):
    """Response containing farmers associated with a specific Gat number."""
    village: str = Field(..., description="Village name (e.g. Malegaon Khurd)")
    village_id: Optional[int] = Field(None, description="Database village ID")
    gat_no: str = Field(..., description="Cadastral Gat Number (e.g. 124)")
    total: int = Field(..., description="Total count of associated farmers")
    farmers: List[AssociatedFarmerItem] = Field(default_factory=list, description="List of associated farmers")
    message: Optional[str] = Field(None, description="Status or guidance message")


class GatOptionItem(BaseModel):
    gat_no: str
    farmer_count: int


class VillageGatsResponse(BaseModel):
    village: str
    village_id: int
    total_gats: int
    total_farmers: int
    gats: List[GatOptionItem]
