# SoilPilot
### Digital Soil Mapping & Soil Health Portal

SoilPilot is a farmer-centric web platform designed to provide intuitive, parcel-level soil intelligence. By navigating through administrative levels (**State → District → Taluka → Village → Gat Number**), farmers can effortlessly access soil diagnostic parameters, high-resolution Digital Soil Mapping (DSM) layers, actionable fertilizer recommendations, and printable bilingual reports.

---

## 1. Project Purpose

Traditional GIS dashboards and soil portals are often overly academic, complex, or inaccessible to grassroots cultivators. SoilPilot bridges this gap by offering:
- Direct, simple farmer access using local land record numbers (**Gat Numbers**).
- Full bilingual localization in **English** and **Marathi (मराठी)**.
- High-contrast, mobile-first design tailored for smartphone usage in rural conditions.
- Reliable separation between verified field observations and predictive soil modeling.

---

## 2. Features Planned

- **Gat-Based Farmer Access**: Administrative drill-down (State → District → Taluka → Village → Gat Number) without complex credential barriers.
- **Farmer Dashboard**: Plot summary, primary soil classification, soil health index, and quick module navigation.
- **My Farm (Cadastral Boundary Map)**: PostGIS-backed parcel geometry viewer powered by MapLibre GL JS.
- **Soil Health Card**: Diagnostic breakdown of N-P-K, pH, Soil Organic Carbon (SOC), Electrical Conductivity (EC), and micronutrients (Zinc, Boron, Iron, etc.).
- **Digital Soil Mapping (DSM) Layers**: Interactive raster/vector overlay switching for pH, Bulk Density, Elevation/DEM, Nitrogen, SOC, and multi-temporal NDVI vegetation vigor.
- **Soil Recommendations**: Tailored crop suitability and balanced chemical/organic fertilizer dosages.
- **Reports & PDF Export**: A4-formatted, downloadable bilingual Soil Health Cards and seasonal logs.

---

## 3. Technology Stack

| Layer | Technologies |
|---|---|
| **Frontend** | Next.js (App Router), TypeScript, Tailwind CSS, TanStack Query, Axios, Lucide Icons |
| **Mapping Engine** | MapLibre GL JS (modular GIS architecture) |
| **Backend** | Python 3.13+, FastAPI, Pydantic v2, SQLAlchemy 2.0, Alembic |
| **Spatial Database** | PostgreSQL 16 + PostGIS 3.4 |
| **Future GIS Tools** | Shapely, GeoPandas, Rasterio, GDAL |
| **Containerization** | Docker & Docker Compose |

---

## 4. Architecture

The application adopts a clean, decoupled architecture:

```text
               ┌────────────────────────────────────────────────────────┐
               │              Frontend (Next.js App Router)             │
               │   • Mobile-first UI with SoilPilot Design Palette      │
               │   • Bilingual Engine (en / mr)                         │
               │   • Modular MapLibre GL Container                      │
               └───────────────────────────┬────────────────────────────┘
                                           │  REST API (Axios / TanStack Query)
                                           ▼
               ┌────────────────────────────────────────────────────────┐
               │                 Backend (FastAPI)                      │
               │   • API Routes (/api/v1/*)                             │
               │   • Schemas (Pydantic v2)                              │
               │   • Services (Business Logic)                          │
               │   • Repositories (Data Access)                         │
               │   • GIS Utilities (Spatial Geometry & Rasters)         │
               └───────────────────────────┬────────────────────────────┘
                                           │  SQLAlchemy ORM & Alembic
                                           ▼
               ┌────────────────────────────────────────────────────────┐
               │             Database (PostgreSQL + PostGIS)            │
               │   • Spatial Cadastral Parcels                          │
               │   • Soil Test Records & Layer Metadata                 │
               └────────────────────────────────────────────────────────┘
```

---

## 5. Folder Structure

```text
SoilPilot/
├── frontend/                     # Next.js App Router Frontend
│   ├── app/                      # Routes (dashboard, my-farm, soil-map, etc.)
│   ├── components/               # Layout, common, map, and ui components
│   ├── i18n/                     # Bilingual translations (en.json, mr.json)
│   ├── lib/api/                  # Axios API client abstraction
│   ├── hooks/                    # Custom React hooks
│   ├── types/                    # TypeScript type declarations
│   ├── package.json
│   ├── tsconfig.json
│   └── tailwind.config.ts
│
├── backend/                      # FastAPI Backend
│   ├── app/
│   │   ├── api/v1/               # Versioned REST endpoints (health, etc.)
│   │   ├── core/                 # Config & logging
│   │   ├── db/                   # Database session & Base models
│   │   ├── models/               # SQLAlchemy ORM models
│   │   ├── schemas/              # Pydantic validation schemas
│   │   ├── services/             # Domain business logic
│   │   ├── repositories/         # Database query repositories
│   │   ├── gis/                  # Spatial analysis module
│   │   └── main.py               # FastAPI application entrypoint
│   ├── alembic/                  # Alembic database migrations
│   ├── tests/                    # Pytest test suite
│   ├── requirements.txt
│   └── alembic.ini
│
├── database/
│   ├── migrations/               # Database migration scripts
│   └── seeds/                    # Reproducible demo seed scripts
│
├── data/                         # GIS and Soil data storage (strictly gitignored)
│   ├── gis/                      # raw/, processed/, exports/
│   └── soil/                     # raw/, processed/, metadata/
│
├── scripts/                      # Automation utilities
│   ├── gis/
│   └── database/
│
├── docs/                         # Specifications and project documentation
├── docker/                       # Dockerfiles for frontend and backend
├── .env.example                  # Environment variable reference
├── .gitignore                    # Monorepo git exclusion rules
├── docker-compose.yml            # Multi-container orchestration
└── README.md                     # Project documentation
```

---

## 6. SoilPilot Design System

To ensure a credible, calming, and farmer-focused experience, the portal uses a strict agricultural palette:

| Token | Hex Value | Application |
|---|---|---|
| **Primary Green** | `#2A7C13` | Primary buttons, active navigation, key brand elements |
| **Secondary Green** | `#76C457` | Hover states, borders, accent highlights, map accents |
| **Soft Cream** | `#FFF8CF` | Notice containers, highlights, demo badges |
| **Warm Beige** | `#FBE6C2` | Phase tags, secondary badges, warm accents |
| **Surface Subtle** | `#FBFDF9` | Main page background |

---

## 7. Prerequisites

- **Node.js**: v18.0 or newer (tested with v22.18.0)
- **Python**: v3.11 or newer (tested with v3.13.0)
- **Docker & Docker Compose** (optional for containerized setup)

---

## 8. Installation & Setup

### Clone and Configure Environment

```powershell
# Copy the environment configuration template
Copy-Item .env.example .env
```

---

## 9. Running Frontend (Native)

```powershell
cd frontend
npm install
npm run dev
```

The frontend will start at [http://localhost:3000](http://localhost:3000).

Available routes:
- `/` — Platform Landing & Architecture Overview
- `/dashboard` — Farmer Dashboard (Demo profile)
- `/my-farm` — Cadastral Gat Boundary Viewer (Phase 5 placeholder)
- `/soil-health-card` — Soil Nutrient Diagnostics (Phase 7 placeholder)
- `/soil-map` — MapLibre GL Digital Soil Mapping (Phase 6 placeholder)
- `/recommendations` — Fertilizer & Crop Recommendations (Phase 8 placeholder)
- `/reports` — Printable PDF Reports (Phase 9 placeholder)

---

## 10. Running Backend (Native)

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Backend URLs:
- **Root API**: [http://localhost:8000](http://localhost:8000)
- **Health Probe**: [http://localhost:8000/api/v1/health](http://localhost:8000/api/v1/health)
- **Interactive OpenAPI Documentation**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **ReDoc Documentation**: [http://localhost:8000/redoc](http://localhost:8000/redoc)

---

## 11. Running Automated Backend Tests

```powershell
cd backend
.\.venv\Scripts\pytest.exe tests
```

---

## 12. Running via Docker Compose

When Docker Desktop is running:

```powershell
docker compose up --build
```

This launches:
1. `soilpilot_db`: PostgreSQL 16 with PostGIS 3.4 on port `5432`
2. `soilpilot_backend`: FastAPI on port `8000`
3. `soilpilot_frontend`: Next.js on port `3000`

---

## 13. API Health Check Response

`GET /api/v1/health`

```json
{
  "status": "ok",
  "service": "SoilPilot API"
}
```

---

## 14. Project Development Phases

- **Phase 0** — Specification
- **Phase 1** — Project Foundation *(Completed)*
- **Phase 2** — Geographic Hierarchy + Database Foundation *(Completed)*
  - PostgreSQL 16 + PostGIS normalized relational schema (`states`, `districts`, `talukas`, `villages`, `farmers`, `fields`).
  - Strict Gat uniqueness constraint per village: `UNIQUE(village_id, gat_no)`.
  - PostGIS `Geometry('MULTIPOLYGON', srid=4326)` with spatial GiST indexing.
  - Reversible Alembic migrations (`001_phase2_geography`).
  - Reproducible `DEMO DATA` seed script (`scripts/database/seed_demo_data.py`).
  - Versioned REST APIs: `/api/v1/geography/states`, `/api/v1/geography/districts`, `/api/v1/geography/talukas`, `/api/v1/geography/villages`, `/api/v1/fields/by-gat`.
  - Frontend responsive cascading dropdown selector (`GeographicSelector.tsx`) with English and Marathi localization.
- **Phase 3** — Gat-based Farmer Access / Authentication *(Completed)*
  - Session management with signed tokens and secure cookies (`/api/v1/auth/gat-login`, `/api/v1/auth/me`, `/api/v1/auth/logout`).
  - Seamless farmer access through administrative hierarchy (**State → District → Taluka → Village → Gat Number**) without requiring complex credentials.
  - Client-side `AuthContext`, reactive state restoration, and `ProtectedRoute` navigation guards.
- **Phase 4** — Farmer Dashboard *(Completed)*
  - Centralized dashboard (`/dashboard`) presenting farm parcel summaries, geographic hierarchy breadcrumbs, and primary soil metrics.
  - Quick-action shortcuts to GIS mapping, diagnostic soil health cards, tailored recommendations, and reports.
- **Phase 5** — Farm Map (MapLibre GL Boundary Visualization) *(Completed)*
  - Interactive cadastral boundary viewer (`/my-farm`) built on MapLibre GL JS with PostGIS-backed parcel geometries.
  - Vector polygon rendering, hover inspection, area measurement, and centroid auto-fitting.
- **Phase 6** — DSM Soil Layers *(Completed)*
  - Digital Soil Mapping exploration interface (`/soil-map`) supporting multi-layer raster/vector overlays.
  - Interactive layer switcher for Soil pH, Bulk Density, Elevation/DEM, Nitrogen, Soil Organic Carbon (SOC), and multi-temporal NDVI vegetation vigor.
  - Opacity adjustment sliders, dynamic scientific legends, and ingestion status badges.
- **Phase 7** — Soil Health Card *(Completed)*
  - Dual-tier diagnostic Soil Health Card (`/soil-health-card`) modeled after ICAR and MPKV Rahuri Vertisol standards.
  - Farmer summary cards with color-coded health ratings and detailed 14+ parameter scientific laboratory table.
- **Phase 8** — Recommendations Engine *(Completed)*
  - Deterministic, rule-based agronomical recommendation system (`/recommendations`, `/api/v1/recommendations/field/{field_id}`).
  - Structured Marathi & English guidance for pH buffering, organic carbon enrichment, and balanced N-P-K and micronutrient application.
- **Phase 9** — Reports + PDF Generation *(Completed)*
  - Client-side PDF export engine (`/reports`) utilizing `jspdf` and `jspdf-autotable`.
  - Downloadable, printer-optimized A4 Soil Health Cards and comprehensive diagnostic dossiers in English and Marathi.
- **Phase 10** — Testing & Quality Assurance *(Completed)*
  - Full automated backend test suite with 38 pytest integration and unit tests (`tests/test_auth.py`, `tests/test_dsm.py`, `tests/test_fields.py`, `tests/test_geography.py`, `tests/test_health.py`, `tests/test_recommendations.py`, `tests/test_soil_health.py`).
  - Next.js typecheck (`tsc --noEmit`) and production static/dynamic build validation (`next build`).

---

## 15. Soil Health Parameter Interpretation Standards

SoilPilot applies deterministic agronomic classification rules derived from the **Government Soil Health Card (SHC) scheme**, large-scale **Indian Micronutrient Research (242,827 soil samples across 615 districts)**, and **MPKV Rahuri STCR-IPNS equations** for Maharashtra Vertisols:

| Parameter | Range | Classification | Short recommendation | Ref. |
| --------- | ----- | -------------- | -------------------- | ---- |
| **pH** | <5.0 | Strongly acidic | Apply lime as per soil test | R1 |
| | 5.0–6.0 | Acidic | Monitor; lime if needed | R1 |
| | 6.0–7.5 | Suitable | Maintain current pH | R1 |
| | 7.5–8.5 | Alkaline | Monitor Fe/Zn | R1, R2 |
| | >8.5 | Strongly alkaline | Test soil; manage alkalinity | R1 |
| **EC** | <0.4 dS/m | Non-saline | No salinity action | R1 |
| | 0.4–0.8 | Slightly saline | Improve drainage; monitor | R1 |
| | 0.8–1.6 | Moderately saline | Manage salts and irrigation | R1 |
| | >1.6 | Highly saline | Soil/water testing needed | R1 |
| **OC** | <0.5% | Low | Add FYM/compost/residues | R1 |
| | 0.5–0.75% | Medium | Maintain organic matter | R1 |
| | >0.75% | High | Maintain; no extra OC needed | R1 |
| **N** | <280 kg/ha | Low | Increase N; ~125% RDF* | R1, R3 |
| | 280–560 | Medium | Normal RDF* | R1, R3 |
| | >560 | High | Reduce N; ~75% RDF* | R1, R3 |
| **P** | <10 kg/ha | Low | Increase P; ~125% RDF* | R1, R3 |
| | 10–25 | Medium | Normal RDF* | R1, R3 |
| | 25–50 | High | Reduce P; ~75% RDF* | R1, R3 |
| | >50 | Very high | Avoid P fertilizer | R1 |
| **K** | <120 kg/ha | Low | Increase K; ~125% RDF* | R1, R3 |
| | 120–280 | Medium | Normal RDF* | R1, R3 |
| | 280–600 | High | Reduce K; ~75% RDF* | R1, R3 |
| | >600 | Very high | Avoid K fertilizer | R1 |
| **Fe** | <2.5 mg/kg | Very deficient | Correct Fe deficiency | R2 |
| | 2.5–4.5 | Deficient | Apply Fe if needed | R1, R2 |
| | 4.5–6.5 | Marginal | Monitor Fe | R2 |
| | >6.5 | Sufficient | No Fe correction | R2 |
| **Zn** | <0.3 mg/kg | Very deficient | Correct Zn deficiency | R2 |
| | 0.3–0.6 | Deficient | Apply Zn if needed | R1, R2 |
| | 0.6–0.9 | Marginal | Monitor Zn | R2 |
| | >0.9 | Sufficient | No Zn correction | R2 |
| **S** | <15 mg/kg | Deficient | Apply S as needed | R2 |
| | 15–22.5 | Marginal | Monitor S | R2 |
| | >22.5 | Sufficient | Maintain S | R2 |
| **B** | <0.5 mg/kg | Deficient | Apply B carefully | R2 |
| | 0.5–0.7 | Marginal | Monitor B | R2 |
| | >0.7 | Sufficient | No B correction | R2 |
| **Cu** | <0.4 mg/kg | Deficient | Apply Cu if needed | R2 |
| | 0.4–0.6 | Marginal | Monitor Cu | R2 |
| | >0.6 | Sufficient | No Cu correction | R2 |
| **Mn** | <3 mg/kg | Deficient | Apply Mn if needed | R2 |
| | 3–5 | Marginal | Monitor Mn | R2 |
| | >5 | Sufficient | No Mn correction | R2 |

> **References & Notes:**
> - **R1**: Soil Health Card (SHC) Scheme, Ministry of Agriculture & Farmers Welfare, Govt of India.
> - **R2**: Indian Micronutrient Research (242,827 soil samples across 615 districts), Shukla et al., ICAR-IISS.
> - **R3**: Soil Test Crop Response (STCR) & MPKV Rahuri STCR-IPNS Framework for Maharashtra Vertisols.
> - **\*RDF**: Recommended Dose of Fertilizers (शिफारशीत खत मात्रा).
> - See full documentation in [`docs/soil-health-standards.md`](docs/soil-health-standards.md).

---

## 15. Phase 2 Database & Migration Commands

### Running Alembic Migrations
```powershell
cd backend
.\.venv\Scripts\alembic.exe upgrade head
```

To test reversibility:
```powershell
.\.venv\Scripts\alembic.exe downgrade -1
.\.venv\Scripts\alembic.exe upgrade head
```

### Seeding Demo Data
```powershell
# From project root
& "backend/.venv/Scripts/python.exe" scripts/database/seed_demo_data.py
```

### Running Backend Tests
```powershell
& "backend/.venv/Scripts/pytest.exe" backend/tests
```

---

## 16. Demo Data Policy

Any data currently shown in the application is strictly **DEMO DATA** for prototype verification and does not represent official government cadastral records or laboratory analyses.

---

## Gat visualisation & Digital Soil Mapping layers (added)

This adds real raster + KML/Gat visualisation to the Soil Map page (`/soil-map`), built from the
`project_soil_full` DSM export (GeoTIFFs + `trial.kml`).

### What was added

- **`scripts/gis/export_dsm_web.py`** — converts the 8 DSM GeoTIFFs (NDVI, EVI, pH, SOC, Nitrogen, BD,
  Elevation, Uncertainty) into a browser-ready bundle: a colour-ramped PNG overlay per layer, a compact
  quantised `uint16` value grid (for the live pixel probe + zonal stats), and `manifest.json` describing
  bounds/legend/stats. Output lands in `frontend/public/data/dsm/`. Re-run it whenever the source rasters
  change:
  ```bash
  pip install numpy pillow matplotlib tifffile
  python scripts/gis/export_dsm_web.py --src /path/to/tifs --kml /path/to/trial.kml
  ```
- **`lib/kml/`** — dependency-free KML/KMZ parsing (`parseKml.ts`), KMZ (ZIP) extraction using the
  browser's native `DecompressionStream` (`readKmlFile.ts`), and KML export (`exportKml.ts`). Farmers can
  upload their own `.kml`/`.kmz` Gat boundaries, or use the bundled sample.
- **`lib/gis/`** — planar geometry helpers (area/centroid/bounds, `geometry.ts`), raster grid decoding and
  zonal statistics (`rasterGrid.ts`), soil parameter classification thresholds (`soilClassification.ts`),
  per-Gat statistics (`gatStats.ts`), and canvas-based raster clipping to a Gat's outline
  (`rasterClip.ts`).
- **`services/dsmService.ts`** — fetches the DSM manifest, merges it with the backend `/soil-layers`
  catalogue, and lazily loads/caches each raster's value grid.
- **`components/map/SoilMapViewer.tsx`** — MapLibre map: raster overlay (optionally clipped to the
  selected Gat), all Gat boundaries with hover/selection states and labels, live pixel probe, satellite/
  street basemap toggle, and the farmer's own field boundary as an extra outline.
- **`components/gat/`** — `GatKmlPanel` (upload/search/select/export UI), `GatSoilHealthPanel` (per-Gat
  soil matrix + a dependency-free SVG radar chart), `RadarChart`.
- **`app/soil-map/page.tsx`** — rewritten to wire all of the above together.

### Notes

- All per-Gat statistics (mean/median/min/max/std/p10/p90, classification, confidence) are computed
  **client-side** from the raster grids — verified to match the original `generate_map.py` output exactly
  for all 11 sample Gats.
- KML/KMZ parsing was fuzz-tested against empty files, invalid XML, point-only placemarks, namespaced
  tags, `MultiGeometry`, polygons with holes, and duplicate names.
