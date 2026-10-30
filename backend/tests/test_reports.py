"""Automated Tests for SoilPilot Phase 9 Reports & PDF Generation.
Tests report data, verification, and ReportLab PDF streaming in English and Marathi.
"""
import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_get_field_report_demo():
    """Verify report data structure for demo Gat 104."""
    response = client.get("/api/v1/reports/104")
    assert response.status_code == 200
    data = response.json()
    assert "field" in data
    assert "farmer" in data
    assert "report" in data
    assert "parameters" in data
    assert data["has_report"] is True
    assert data["report"]["report_no"] == "SPL/2026/SL-0104"
    assert len(data["parameters"]) >= 14


def test_get_soil_health_card_data():
    """Verify Soil Health Card specific endpoint."""
    response = client.get("/api/v1/reports/104/soil-health-card")
    assert response.status_code == 200
    data = response.json()
    assert data["has_report"] is True
    assert data["field"]["gat_no"] == "104"


def test_download_soil_health_card_pdf_en():
    """Verify downloading Soil Health Card PDF in English."""
    response = client.get("/api/v1/reports/104/soil-health-card/pdf?lang=en")
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/pdf"
    assert "SoilPilot_Soil_Health_Card" in response.headers["content-disposition"]
    assert response.content.startswith(b"%PDF-")
    assert len(response.content) > 10000


def test_download_soil_health_card_pdf_mr():
    """Verify downloading Soil Health Card PDF in Marathi with Devanagari font."""
    response = client.get("/api/v1/reports/104/soil-health-card/pdf?lang=mr")
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/pdf"
    assert response.content.startswith(b"%PDF-")
    assert len(response.content) > 10000


def test_download_detailed_soil_report_pdf_en():
    """Verify downloading Detailed Soil Report PDF in English."""
    response = client.get("/api/v1/reports/104/detailed/pdf?lang=en")
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/pdf"
    assert "SoilPilot_Detailed_Soil_Report" in response.headers["content-disposition"]
    assert response.content.startswith(b"%PDF-")
    assert len(response.content) > 10000


def test_download_detailed_soil_report_pdf_mr():
    """Verify downloading Detailed Soil Report PDF in Marathi."""
    response = client.get("/api/v1/reports/104/detailed/pdf?lang=mr")
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/pdf"
    assert response.content.startswith(b"%PDF-")
    assert len(response.content) > 10000


def test_report_verification_valid():
    """Verify QR scan / report number verification for an authentic report."""
    response = client.get("/api/v1/reports/verify/SPL/2026/SL-0104")
    assert response.status_code == 200
    data = response.json()
    assert data["verified"] is True
    assert data["report_no"] == "SPL/2026/SL-0104"
    assert "Malegaon" in data["village"]


def test_report_verification_invalid():
    """Verify QR scan / report number verification for an invalid report."""
    response = client.get("/api/v1/reports/verify/FAKE-REPORT-999")
    assert response.status_code == 200
    data = response.json()
    assert data["verified"] is False
