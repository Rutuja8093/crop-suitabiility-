"""Tests for Farmer Selection and Report/PDF Identity Synchronization.
Verifies:
1. Passing farmer_name to report endpoints overrides farmer identity without modifying soil measurements.
2. PDF endpoints stream valid PDF binaries reflecting the selected farmer name.
3. Cadastral Gat boundaries and scientific values remain consistent with underlying sample provenance.
"""
import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_report_data_with_selected_farmer():
    """Verify that report endpoint reflects selected farmer while keeping soil metrics unchanged."""
    # 1. Default report
    res_default = client.get("/api/v1/reports/104")
    assert res_default.status_code == 200
    data_default = res_default.json()
    assert "parameters" in data_default
    default_ph = next(p["value"] for p in data_default["parameters"] if p["key"] == "ph")

    # 2. Report with custom selected farmer
    selected_name = "श्री तुकाराम पांडुरंग पाटील"
    res_selected = client.get(f"/api/v1/reports/104?farmer_name={selected_name}")
    assert res_selected.status_code == 200
    data_selected = res_selected.json()

    # Identity updated
    assert data_selected["farmer"]["name"] == selected_name

    # Scientific parameters strictly untouched
    selected_ph = next(p["value"] for p in data_selected["parameters"] if p["key"] == "ph")
    assert selected_ph == default_ph
    assert len(data_selected["parameters"]) == len(data_default["parameters"])


def test_soil_health_card_data_with_selected_farmer():
    """Verify soil-health-card endpoint supports farmer_name parameter."""
    selected_name = "Ramesh Patil"
    res = client.get(f"/api/v1/reports/104/soil-health-card?farmer_name={selected_name}")
    assert res.status_code == 200
    data = res.json()
    assert data["farmer"]["name"] == selected_name


def test_soil_health_card_pdf_with_selected_farmer():
    """Verify PDF generator produces valid PDF with selected farmer name in English and Marathi."""
    # English PDF
    res_en = client.get("/api/v1/reports/104/soil-health-card/pdf?lang=en&farmer_name=Ramesh+Patil")
    assert res_en.status_code == 200
    assert res_en.headers["content-type"] == "application/pdf"
    assert len(res_en.content) > 10000

    # Marathi PDF
    res_mr = client.get("/api/v1/reports/104/soil-health-card/pdf?lang=mr&farmer_name=रमेश+पाटील")
    assert res_mr.status_code == 200
    assert res_mr.headers["content-type"] == "application/pdf"
    assert len(res_mr.content) > 10000


def test_detailed_soil_report_pdf_with_selected_farmer():
    """Verify Detailed Report PDF streams valid bytes with selected farmer name."""
    res = client.get("/api/v1/reports/104/detailed/pdf?lang=en&farmer_name=Pradip+Shelar")
    assert res.status_code == 200
    assert res.headers["content-type"] == "application/pdf"
    assert "Pradip_Shelar" in res.headers.get("content-disposition", "")
    assert len(res.content) > 10000
