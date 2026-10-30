"""Unit and integration tests for Digital Soil Mapping (DSM), GeoTIFF heatmaps, and KML Gat accessing."""

from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_get_soil_layers():
    response = client.get("/api/v1/soil-layers")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) == 9  # farm_boundary + 8 GeoTIFF DSM layers

    ids = [layer["id"] for layer in data]
    expected_ids = ["farm_boundary", "ph", "soc", "nitrogen", "bd", "elevation", "ndvi", "evi", "uncertainty"]
    for eid in expected_ids:
        assert eid in ids

    boundary_layer = next(l for l in data if l["id"] == "farm_boundary")
    assert boundary_layer["status"] == "available"

    ph_layer = next(l for l in data if l["id"] == "ph")
    assert ph_layer["unit"] == "pH"
    assert ph_layer["status"] == "available"


def test_get_single_soil_layer():
    response = client.get("/api/v1/soil-layers/ph")
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == "ph"
    assert data["unit"] == "pH"
    assert data["status"] == "available"


def test_get_nonexistent_soil_layer():
    response = client.get("/api/v1/soil-layers/nonexistent")
    assert response.status_code == 404


def test_point_probe():
    # Probe inside Malegaon area
    response = client.get("/api/v1/soil-layers/point-probe?lat=18.16&lon=74.505")
    assert response.status_code == 200
    data = response.json()
    assert "layers" in data
    assert "ph" in data["layers"]
    assert "ndvi" in data["layers"]
    assert data["layers"]["ph"]["value"] is not None


def test_kml_files_list():
    response = client.get("/api/v1/soil-layers/kml/files")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    filenames = [f["filename"] for f in data]
    assert any("malegaon" in f or "sample-gats" in f for f in filenames)
    assert any("final1" in f for f in filenames)


def test_kml_gats_feature_collection():
    response = client.get("/api/v1/soil-layers/kml/gats")
    assert response.status_code == 200
    data = response.json()
    assert data["type"] == "FeatureCollection"
    assert len(data["features"]) >= 11
    # Check that Gat 12 is in the collection
    gat_names = [f["properties"].get("gat_no") or f["properties"]["name"] for f in data["features"]]
    assert any("12" in g for g in gat_names)


def test_kml_single_gat_detail():
    response = client.get("/api/v1/soil-layers/kml/gats/12")
    assert response.status_code == 200
    data = response.json()
    assert data["gat_no"] == "12"
    assert data["area_ha"] > 0
    assert "geometry" in data
    assert "bounds" in data


def test_gat_statistics_from_kml_and_db():
    response = client.get("/api/v1/soil-layers/gat-stats/12")
    assert response.status_code == 200
    data = response.json()
    assert data["gat_no"] == "12"
    assert data["area_ha"] > 0
    assert "layers" in data
    assert "ph" in data["layers"]
    assert "soc" in data["layers"]
    assert "nitrogen" in data["layers"]
    assert "bd" in data["layers"]
    assert "ndvi" in data["layers"]
    assert data["layers"]["ph"]["mean"] is not None
    assert data["layers"]["ndvi"]["mean"] is not None


def test_heatmap_png_rendering_full_and_clipped():
    # Full heatmap for NDVI
    r_full = client.get("/api/v1/soil-layers/ndvi/heatmap")
    assert r_full.status_code == 200
    assert r_full.headers["content-type"] == "image/png"
    assert len(r_full.content) > 1000

    # Clipped heatmap for Gat 12
    r_clipped = client.get("/api/v1/soil-layers/ndvi/heatmap?gat_no=12")
    assert r_clipped.status_code == 200
    assert r_clipped.headers["content-type"] == "image/png"
    assert len(r_clipped.content) > 100
