"""Reports Service for SoilPilot Phase 9.
Handles report data retrieval, verification, authorization checks, and PDF exports.
Single source of truth between online preview and PDF documents.
"""
from typing import Dict, Any, Optional
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.models.field import Field
from app.models.farmer import Farmer
from app.models.soil_health import SoilReport
from app.services.soil_health_service import soil_health_service
from app.services.pdf_service import pdf_service, get_india_current_date_str


def sanitize_filename_part(text: str) -> str:
    """Sanitize string for clean, ASCII-safe HTTP header filenames."""
    clean = "".join(c if (c.isascii() and c.isalnum()) or c in ("-", "_") else "_" for c in text.strip())
    while "__" in clean:
        clean = clean.replace("__", "_")
    return clean.strip("_")


class ReportService:
    """Domain service for reports and PDF exports."""

    def get_report_data(
        self,
        db: Session,
        field_identifier: str,
        farmer_name: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Fetch unified soil report data with optional selected farmer override."""
        data = soil_health_service.get_report_for_field(db, field_identifier, farmer_name=farmer_name)
        if not data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Field with ID or Gat '{field_identifier}' not found.",
            )
        # Apply selected farmer name override if provided
        if farmer_name and farmer_name.strip():
            if "farmer" not in data or not isinstance(data["farmer"], dict):
                data["farmer"] = {}
            data["farmer"]["name"] = farmer_name.strip()

        # Ensure report_date reflects dynamic live generation date in India timezone
        if "report" in data and isinstance(data["report"], dict):
            data["report"]["report_date"] = get_india_current_date_str()

        # Integrate verified crop decision & market intelligence data
        try:
            from app.services.crop_decision_service import crop_decision_service
            decision_res = crop_decision_service.evaluate_field_crop_decision(db, field_identifier=field_identifier)
            data["crop_decision"] = decision_res.model_dump()
        except Exception:
            data["crop_decision"] = None

        return data

    def verify_field_access(
        self,
        db: Session,
        field_identifier: str,
        token_payload: Optional[Dict[str, Any]],
    ) -> None:
        """
        Verify that the requested field belongs to the current farmer's session.
        Permits access if:
          1. Field identifier matches session token's field_id or gat_no
          2. Field is demo field (Gat 104) for platform evaluation
          3. Token belongs to the farmer who owns the field
        """
        norm_id = str(field_identifier).strip().lower()
        if norm_id.startswith("demo-field-gat-") or norm_id.startswith("demo") or norm_id in ["demo-field-gat-104", "demo", "gat-104", "104"]:
            return  # Demo fields are always accessible for review

        # If session token is provided, enforce ownership
        if token_payload:
            sess_field_id = token_payload.get("field_id")
            sess_gat = str(token_payload.get("gat_no", "")).strip().lower()
            sess_farmer_id = token_payload.get("farmer_id")

            if str(sess_field_id) == str(field_identifier) or sess_gat == norm_id:
                return

            # Check if farmer owns this field
            if sess_farmer_id:
                target_field = soil_health_service._find_field(db, field_identifier)
                if target_field and target_field.farmer_id == sess_farmer_id:
                    return

            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Unauthorized: You do not have permission to access reports for this field.",
            )

    def generate_soil_health_card_pdf(
        self,
        db: Session,
        field_identifier: str,
        lang: str = "en",
        base_url: str = "https://soilpilot.gov.in",
        farmer_name: Optional[str] = None,
    ) -> tuple[bytes, str]:
        """Generates Soil Health Card PDF binary and clean filename."""
        data = self.get_report_data(db, field_identifier, farmer_name=farmer_name)
        report_meta = data.get("report") or {}
        report_no = report_meta.get("report_no", "SPL/2026/SL-0104")
        verify_url = f"{base_url}/reports?verify={report_no}"

        pdf_bytes = pdf_service.generate_soil_health_card_pdf(
            report_data=data,
            lang=lang,
            verify_url=verify_url,
        )

        gat_no = sanitize_filename_part(str(data.get("field", {}).get("gat_no", "104")))
        live_date = get_india_current_date_str()
        filename = f"SoilPilot_Soil_Health_Card_Gat_{gat_no}_{live_date}.pdf"

        return pdf_bytes, filename

    def generate_detailed_soil_report_pdf(
        self,
        db: Session,
        field_identifier: str,
        lang: str = "en",
        base_url: str = "https://soilpilot.gov.in",
        farmer_name: Optional[str] = None,
    ) -> tuple[bytes, str]:
        """Generates Soil Health Card PDF binary and clean filename matching the online website design."""
        data = self.get_report_data(db, field_identifier, farmer_name=farmer_name)
        report_meta = data.get("report") or {}
        report_no = report_meta.get("report_no", "SPL/2026/SL-0104")
        verify_url = f"{base_url}/reports?verify={report_no}"

        pdf_bytes = pdf_service.generate_detailed_soil_report_pdf(
            report_data=data,
            lang=lang,
            verify_url=verify_url,
        )

        gat_no = sanitize_filename_part(str(data.get("field", {}).get("gat_no", "104")))
        farmer_name_clean = sanitize_filename_part(str(data.get("farmer", {}).get("name", "")))
        live_date = get_india_current_date_str()
        if farmer_name_clean and farmer_name_clean.lower() != "farmer":
            filename = f"SoilPilot_Detailed_Soil_Report_{farmer_name_clean}_Gat_{gat_no}_{live_date}.pdf"
        else:
            filename = f"SoilPilot_Detailed_Soil_Report_Gat_{gat_no}_{live_date}.pdf"

        return pdf_bytes, filename

    def verify_report(self, db: Session, report_no: str) -> Dict[str, Any]:
        """Verify authenticity of a report number for QR scan."""
        clean_no = report_no.strip()
        db_report = db.query(SoilReport).filter(SoilReport.report_no.ilike(clean_no)).first()

        if db_report:
            field = db_report.field
            farmer = field.farmer if field else None
            village = field.village if field else None
            taluka = village.taluka if village else None
            district = taluka.district if taluka else None

            return {
                "verified": True,
                "status": "Authentic Certified Soil Test Record",
                "report_no": db_report.report_no,
                "receipt_no": db_report.receipt_no,
                "farmer_name": farmer.full_name if farmer else "Farmer",
                "gat_no": field.gat_no if field else "N/A",
                "village": village.name if village else "N/A",
                "taluka": taluka.name if taluka else "N/A",
                "district": district.name if district else "Pune",
                "report_date": db_report.report_date,
                "sample_date": db_report.sample_date,
                "is_demo": db_report.is_demo,
                "laboratory_name": db_report.laboratory_name,
            }

        # Check for demo report number
        if clean_no.upper() in ["SPL/2026/SL-0104", "SPL-2026-0104", "DEMO-104"]:
            return {
                "verified": True,
                "status": "Authentic Demonstration Soil Test Record",
                "report_no": "SPL/2026/SL-0104",
                "receipt_no": "REC-7842/26",
                "farmer_name": "Pradip Bhauso Shelar",
                "gat_no": "104",
                "village": "Malegaon Bk",
                "taluka": "Baramati",
                "district": "Pune",
                "report_date": "20-09-2026",
                "sample_date": "15-09-2026",
                "is_demo": True,
                "laboratory_name": "SoilPilot Soil Testing & Diagnostic Laboratory",
            }

        return {
            "verified": False,
            "status": "Report Not Found in Cadastral Database",
            "report_no": clean_no,
        }


report_service = ReportService()
