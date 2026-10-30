from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    status: str = Field(default="ok", description="Operational status of the API service")
    service: str = Field(default="SoilPilot API", description="Name of the API service")

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "status": "ok",
                    "service": "SoilPilot API"
                }
            ]
        }
    }
