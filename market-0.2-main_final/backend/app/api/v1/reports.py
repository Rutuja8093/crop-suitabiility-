"""Versioned REST API Endpoints for Reports & PDF Generation.
SoilPilot Phase 9: /api/v1/reports/*
"""
from typing import Dict, Any, Optional
from fastapi import APIRouter, Depends, Query, Response, Request, status
from fastapi.responses import Response as FastApiResponse
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.api.v1.auth import extract_token
from app.services.auth_service import auth_service
from app.services.report_service import report_service

router = APIRouter(prefix="/reports", tags=["Reports & PDF Generation"])


def get_token_payload(
    token: Optional[str] = Depends(extract_token),
) -> Optional[Dict[str, Any]]:
    """Extract and verify session token payload if provided."""
    if token:
        return auth_service.verify_session_token(token)
    return None


@router.get(
    "/verify/{report_no:path}",
    response_model=Dict[str, Any],
    summary="Verify Soil Report Authenticity",
    description="Validates a report number scanned from a QR code or entered manually to verify laboratory authenticity.",
)
def verify_soil_report(
    report_no: str,
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    return report_service.verify_report(db, report_no)


@router.get(
    "/{field_id}",
    response_model=Dict[str, Any],
    summary="Get Field Soil Report Metadata & Parameters",
    description="Retrieves complete report structure, farmer context, laboratory parameters, and interpretations.",
)
def get_field_report(
    field_id: str,
    farmer_name: Optional[str] = Query(None, description="Optional selected farmer name override"),
    db: Session = Depends(get_db),
    token_payload: Optional[Dict[str, Any]] = Depends(get_token_payload),
) -> Dict[str, Any]:
    report_service.verify_field_access(db, field_id, token_payload)
    return report_service.get_report_data(db, field_id, farmer_name=farmer_name)


@router.get(
    "/{field_id}/soil-health-card",
    response_model=Dict[str, Any],
    summary="Get Soil Health Card Data",
    description="Returns targeted diagnostic parameters and classifications for the Soil Health Card.",
)
def get_soil_health_card_data(
    field_id: str,
    farmer_name: Optional[str] = Query(None, description="Optional selected farmer name override"),
    db: Session = Depends(get_db),
    token_payload: Optional[Dict[str, Any]] = Depends(get_token_payload),
) -> Dict[str, Any]:
    report_service.verify_field_access(db, field_id, token_payload)
    return report_service.get_report_data(db, field_id, farmer_name=farmer_name)


@router.get(
    "/{field_id}/soil-health-card/pdf",
    summary="Download Official Soil Health Card PDF",
    description="Generates and streams an A4 printer-ready Soil Health Card PDF via ReportLab in English or Marathi.",
)
def download_soil_health_card_pdf(
    field_id: str,
    request: Request,
    lang: str = Query("en", description="Language code: 'en' for English or 'mr' for Marathi"),
    farmer_name: Optional[str] = Query(None, description="Optional selected farmer name override"),
    db: Session = Depends(get_db),
    token_payload: Optional[Dict[str, Any]] = Depends(get_token_payload),
) -> Response:
    report_service.verify_field_access(db, field_id, token_payload)
    base_url = str(request.base_url).rstrip("/")
    pdf_bytes, filename = report_service.generate_soil_health_card_pdf(
        db=db,
        field_identifier=field_id,
        lang=lang,
        base_url=base_url,
        farmer_name=farmer_name,
    )

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "no-cache, no-store, must-revalidate",
        },
    )


@router.get(
    "/{field_id}/detailed/pdf",
    summary="Download Detailed Soil Test Report PDF",
    description="Generates and streams an official multi-page laboratory dossier PDF via ReportLab in English or Marathi.",
)
def download_detailed_soil_report_pdf(
    field_id: str,
    request: Request,
    lang: str = Query("en", description="Language code: 'en' for English or 'mr' for Marathi"),
    farmer_name: Optional[str] = Query(None, description="Optional selected farmer name override"),
    db: Session = Depends(get_db),
    token_payload: Optional[Dict[str, Any]] = Depends(get_token_payload),
) -> Response:
    report_service.verify_field_access(db, field_id, token_payload)
    base_url = str(request.base_url).rstrip("/")
    pdf_bytes, filename = report_service.generate_detailed_soil_report_pdf(
        db=db,
        field_identifier=field_id,
        lang=lang,
        base_url=base_url,
        farmer_name=farmer_name,
    )

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "no-cache, no-store, must-revalidate",
        },
    )
