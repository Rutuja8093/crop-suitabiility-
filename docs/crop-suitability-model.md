# GIS-Based Crop Suitability Model for SoilPilot (Malegaon Khurd & Baramati)

## 1. Overview & Architectural Design

This module implements a scientifically traceable, GIS-based multi-criteria **Crop Suitability Evaluation Engine** for the **SoilPilot** platform, specifically calibrated for **Malegaon Khurd and Baramati (Pune District, Maharashtra, India)**.

The system combines:
1. **30-Year WMO Agro-Climatic Normals (1991–2020)** and recent climate variability (2016–2025) derived from Open-Meteo dual-table meteorology records.
2. **High-Resolution (10m) Digital Soil Mapping (DSM) and Topographic Rasters** (pH, SOC, Available Nitrogen, Bulk Density, SRTM Slope, Elevation, and USDA Soil Texture).
3. **Cadastral Gat Boundary Polygons** (217 validated parcels from `final_gat_mmkh.kmz`).
4. **FAO Land Suitability Framework (S1, S2, S3, N)** combined with **Liebig's Law of the Minimum** and **Agronomic Multi-Criteria Weighted Scoring (0–100%)** based on official Deccan agro-climatic criteria.

```mermaid
flowchart TD
    subgraph Data Sources
        Rasters["High-Res Rasters (10m)\npH, SOC, N, BD, Slope, Texture"]
        Boundaries["Cadastral Gat Polygons\n(217 Plots in EPSG:4326)"]
        Weather["Open-Meteo Weather CSVs\n(1991-2020 WMO & 2016-2025)"]
        RulesPDF["Crop Suitability Criteria\n(10 Deccan Crops JSON)"]
    end

    subgraph Processing Pipeline
        Extractor["Gat Soil Extractor\n(Rasterio Zonal Statistics & Mode)"]
        WProcessor["Weather Processor\n(ET0, VPD, IMD Rainy Days, Normals)"]
        Engine["Suitability Engine\n(Liebig Limitation + Weighted Scoring)"]
    end

    subgraph Storage & Caching
        Cache["data/gis/gat_soil_indicators_cache.json"]
        Postgres["PostgreSQL / PostGIS (or SQLite Fallback)"]
    end

    subgraph API Layer (FastAPI)
        API1["GET /crops\nGET /weather-summary"]
        API2["GET /gat/{gat_no}\nGET /crop/{crop_code}"]
        API3["GET /crop/{crop_code}/geojson\nGET /export/csv\nPOST /refresh"]
    end

    subgraph Frontend UI (Next.js / Leaflet)
        Map["Leaflet GIS Map\n(S1/S2/S3/N Parcel Choropleth)"]
        Dashboard["Field Suitability Dashboard\n(Comparison Matrix, Criteria Breakdown)"]
    end

    Rasters --> Extractor
    Boundaries --> Extractor
    Extractor --> Cache
    Weather --> WProcessor
    RulesPDF --> Engine

    Cache --> Engine
    WProcessor --> Engine
    Engine --> Postgres
    Engine --> API2
    Engine --> API3

    API1 --> Dashboard
    API2 --> Dashboard
    API3 --> Map
    API3 --> Dashboard
```

---

## 2. Directory Structure & Key Files

| Module / File | Description |
| :--- | :--- |
| [backend/app/gis/crop_suitability_rules.json](file:///c:/Users/Rutuja/Downloads/market-0.2-main/market-0.2-main/backend/app/gis/crop_suitability_rules.json) | Authoritative criteria definition for all 10 crops (thresholds, units, and weights summing to 100%). |
| [backend/app/gis/crop_suitability_engine.py](file:///c:/Users/Rutuja/Downloads/market-0.2-main/market-0.2-main/backend/app/gis/crop_suitability_engine.py) | Core evaluation logic: bounds parsing, categorical texture matching, Liebig conservative class assignment, weighted index scoring, and limiting factors. |
| [backend/app/gis/weather_processor.py](file:///c:/Users/Rutuja/Downloads/market-0.2-main/market-0.2-main/backend/app/gis/weather_processor.py) | Open-Meteo multi-section CSV parser, 30-year WMO baseline aggregator, ET₀/VPD calculators, and IMD rainy day statistics. |
| [backend/app/gis/gat_soil_extractor.py](file:///c:/Users/Rutuja/Downloads/market-0.2-main/market-0.2-main/backend/app/gis/gat_soil_extractor.py) | Rasterio zonal statistics extractor across 217 cadastral Gat boundaries with persistence and caching. |
| [backend/app/api/v1/crop_suitability.py](file:///c:/Users/Rutuja/Downloads/market-0.2-main/market-0.2-main/backend/app/api/v1/crop_suitability.py) | FastAPI REST endpoints for catalogs, parcel evaluations, GeoJSON map layers, CSV export, and cache refresh. |
| [frontend/services/cropSuitabilityService.ts](file:///c:/Users/Rutuja/Downloads/market-0.2-main/market-0.2-main/frontend/services/cropSuitabilityService.ts) | TypeScript API client with full type safety for crop models and evaluation responses. |
| [frontend/components/map/CropSuitabilityMap.tsx](file:///c:/Users/Rutuja/Downloads/market-0.2-main/market-0.2-main/frontend/components/map/CropSuitabilityMap.tsx) | Interactive Leaflet GIS map with S1–N thematic styling, satellite basemap switcher, parcel hover, and click handlers. |
| [frontend/app/field-suitability/page.tsx](file:///c:/Users/Rutuja/Downloads/market-0.2-main/market-0.2-main/frontend/app/field-suitability/page.tsx) | Comprehensive crop suitability dashboard: crop switcher, irrigation toggle, 4-tier KPI summary, criteria breakdown, and 10-crop matrix. |
| [backend/tests/test_gis_crop_suitability.py](file:///c:/Users/Rutuja/Downloads/market-0.2-main/market-0.2-main/backend/tests/test_gis_crop_suitability.py) | 8 automated verification tests covering boundaries, S1–N logic, Liebig limitations, missing values, and API schemas. |

---

## 3. Environment Variables & Security

The weather API key and other secrets are loaded securely from environment variables and are **never exposed to the browser, logged, or committed to source control**.

### `.env` Configuration (in project root and `backend/.env`)

```ini
# Weather API Credentials
OPEN_METEO_API_KEY=IuAdMYNB71qFJiQ9

# Application Settings
PROJECT_NAME="SoilPilot API"
VERSION="0.2.0"
API_V1_STR="/api/v1"

# Database Configuration (PostgreSQL / PostGIS with SQLite fallback)
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/soilpilot"

# CORS Allowed Origins
BACKEND_CORS_ORIGINS=["http://localhost:3000","http://127.0.0.1:3000"]
```

> [!CAUTION]
> Both `.env` and `backend/.env` are registered in `.gitignore`. Never hardcode the `OPEN_METEO_API_KEY` into frontend client code or commit `.env` to git repositories.

---

## 4. Supported Crops & Agrotechnical Criteria

The 10 crops evaluated by the engine match the official criteria document (`Crop_Wise_Suitability_Criteria_Final - Copy.pdf`):

| Crop | Scientific Name | Marathi Name | Major Limiting Factors in Deccan Vertisols |
| :--- | :--- | :--- | :--- |
| **Sugarcane** | *Saccharum officinarum* | ऊस (Us) | Water requirement (>1500mm or canal irrigation), heavy clay aeration |
| **Pomegranate** | *Punica granatum* | डाळिंब (Dalimb) | Waterlogging sensitivity, high RH during flowering |
| **Soybean** | *Glycine max* | सोयाबीन (Soybean) | Kharif moisture stress, extreme soil alkalinity (pH > 8.5) |
| **Maize** | *Zea mays* | मका (Maka) | High bulk density, nitrogen availability, water drainage |
| **Tomato** | *Solanum lycopersicum* | टोमॅटो (Tomato) | Excess humidity (bacterial wilt / blight), high temperature during fruit set |
| **Onion** | *Allium cepa* | कांदा (Kanda) | Bulb rot in heavy waterlogged soils, bulb development temperatures |
| **Banana** | *Musa acuminata* | केळी (Keli) | Heavy water requirement (>1800mm or irrigation), chilling or extreme heat |
| **Chickpea** | *Cicer arietinum* | हरभरा (Harbhara) | High humidity causing Ascochyta blight, excess soil moisture |
| **Groundnut** | *Arachis hypogaea* | भुईमूग (Bhuimug) | Soil compaction (bulk density > 1.45 hampers pegging), calcium/pH |
| **Lemon** | *Citrus limon* | लिंबू (Limbu) | Subsoil hardpan, high water table, high alkalinity (gummosis/dieback) |

### Suitability Class Definitions (FAO Framework)

- **S1 (Highly Suitable)**: Land having no significant limitations to sustained application of a given crop. Multi-criteria score 80% – 100%.
- **S2 (Moderately Suitable)**: Land having limitations which in aggregate are moderately severe for sustained production. Multi-criteria score 60% – less than 80%.
- **S3 (Marginally Suitable)**: Land having limitations which in the aggregate are severe for sustained production. Multi-criteria score 40% – less than 60%.
- **N (Not Suitable)**: Land with severe limitations that preclude sustained production. Multi-criteria score below 40% or any vital criterion falling into Class N under Liebig limitation.

---

## 5. Weather Processing Methodology

The weather processor reads Open-Meteo multi-section CSV files:
1. `open-meteo-18.10N74.49E542m.csv` (1991–2016)
2. `open-meteo-18.10N74.49E542m (1).csv` (2017–2020)
3. `open-meteo-18.10N74.49E542m (4).csv` (2016–2025)

### Validation & Normalization Rules
- **Header Separation**: Open-Meteo CSVs contain metadata comments, an hourly table starting at line 4 (`time,temperature_2m...`), followed by a daily summary table starting at a second `time,` header. The parser detects and isolates both tables.
- **WMO 30-Year Continuity**: The 1991–2016 dataset ends on `2016-12-31T23:00` and the 2017–2020 dataset begins on `2017-01-01T00:00`. Concatenating them produces an exact 30-year continuous climatological baseline (**10,958 days**, **262,992 hours**, 0 missing dates, 0 duplicate records).
- **Recent Variability Dataset**: The 2016–2025 dataset is preserved separately to compute decadal shifts in rainfall intensity, heatwave frequency, and rainy day distribution.

### Agro-Climatic Indicators Computed

1. **Mean Annual Rainfall**:
   $$\bar{P}_{\text{annual}} = \frac{1}{N_{\text{years}}} \sum_{y=1}^{N_{\text{years}}} P_y = 654.1\text{ mm/year}$$
2. **Mean Annual Temperature**:
   $$\bar{T}_{\text{annual}} = 26.6^\circ\text{C} \quad (T_{\text{max, mean}} = 33.1^\circ\text{C}, \, T_{\text{min, mean}} = 20.2^\circ\text{C})$$
3. **Reference Evapotranspiration (ET₀)**:
   Calculated via FAO-56 Penman-Monteith hourly formulation (aggregated to annual normal: **1,725.8 mm/year**).
4. **Vapour Pressure Deficit (VPD)**:
   $$e_s(T) = 0.6108 \exp\left(\frac{17.27 T}{T + 237.3}\right)$$
   $$e_a = e_s(T) \times \frac{\text{RH}}{100}, \quad \text{VPD} = e_s(T) - e_a = 1.34\text{ kPa}$$
5. **IMD Rainy Days**:
   $$\text{Rainy Days} = \text{Count of days with } P_{\text{daily}} \ge 2.5\text{ mm} = 41.5\text{ days/year}$$

---

## 6. Soil Extraction & Zonal Statistics

High-resolution DSM rasters are sampled across the 217 cadastral Gat boundaries:

| Raster Layer | Native Units | Transformation for Agronomic Engine |
| :--- | :--- | :--- |
| `pH.tif` | $-\log[H^+]$ | Arithmetic mean within Gat boundary. |
| `SOC.tif` | $\%$ | Arithmetic mean within Gat boundary. |
| `Nitrogen.tif` | $\text{mg/kg}$ | Multiplied by 20 to convert to $\text{kg/ha}$ ($\text{kg/ha} = \text{mg/kg} \times 20$). |
| `BD.tif` | $\text{g/cm}^3$ | Arithmetic mean within Gat boundary. |
| `SRTM_Slope_pct.tif` | $\%$ | Arithmetic mean within Gat boundary. |
| `Elevation.tif` | $\text{meters}$ | Arithmetic mean within Gat boundary. |
| `Soil_Texture_Class_30cm.tif` | USDA Integer Code | **Statistical Mode (Majority Class)**. Categorical integer decoded to: `1: Clay`, `2: Silty Clay`, `3: Clay Loam`, `4: Loam`, etc. |

---

## 7. Suitability Classification Algorithm

For each Gat $g$ and crop $c$:

### Step 1: Criterion-Level Evaluation
For each criterion $i$ with observed value $x_i$:
- The engine checks whether $x_i$ lies within the numerical range $[min, max]$ or matches the categorical values of $S_1$, $S_2$, $S_3$, or $N$.
- A normalized criterion score $s_i \in [0.0, 1.0]$ is assigned:
  $$s_i = \begin{cases} 1.0 & \text{if } x_i \in S_1 \\ 0.8 & \text{if } x_i \in S_2 \\ 0.5 & \text{if } x_i \in S_3 \\ 0.2 & \text{if } x_i \in N \end{cases}$$

### Step 2: Liebig Law of the Minimum (Conservative Limitation)
The most severe constraint dictates the maximum attainable class:
$$\text{Class}_{\text{Liebig}} = \min_{i} \left(\text{Class}(x_i)\right)$$
If *any* vital indicator falls into Class $N$, the crop is flagged with limiting factors and assigned Class $N$ or $S_3$.

### Step 3: Weighted Multi-Criteria Suitability Index
Using the documented weights $w_i$ from `crop_suitability_rules.json` (where $\sum w_i = 100\%$):
$$\text{Suitability Score} = \sum_{i=1}^{m} w_i \cdot s_i$$

### Step 4: Final Class Assignment
$$\text{Final Class} = \begin{cases}
N & \text{if } \text{Class}_{\text{Liebig}} = N \text{ or Score} < 40.0 \\
S3 & \text{if } \text{Class}_{\text{Liebig}} = S3 \text{ or Score} \in [40.0, 59.9] \\
S2 & \text{if } \text{Class}_{\text{Liebig}} = S2 \text{ or Score} \in [60.0, 79.9] \\
S1 & \text{if } \text{Class}_{\text{Liebig}} = S1 \text{ and Score} \ge 80.0
\end{cases}$$

---

## 8. Verification & Calculation Walkthrough (Gat 1 Audit)

### Parcel Attributes (Gat 1):
- **pH**: 8.01
- **SOC**: 0.44%
- **Nitrogen**: $15.18\text{ mg/kg} \times 20 = 303.6\text{ kg/ha}$
- **Bulk Density**: $1.39\text{ g/cm}^3$
- **Slope**: 1.54%
- **Texture**: Clay (USDA Class 1)
- **Mean Temperature**: $26.6^\circ\text{C}$
- **Annual Rainfall (Rainfed Baseline)**: $654.1\text{ mm}$
- **Annual Rainfall (Canal Irrigation Supported)**: $>1500\text{ mm}$

### Evaluation 1: Sugarcane (*Saccharum officinarum*)

| Parameter | Observed | Requirement (S1) | Requirement (S2) | Requirement (S3) | Class | Limiting Factor? |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **pH** | 8.01 | 6.5 – 7.5 | 7.5 – 8.0 | 8.0 – 8.5 | **S3** | Yes (Marginal alkalinity) |
| **SOC** | 0.44% | > 0.75% | 0.5 – 0.75% | 0.25 – 0.5% | **S3** | Yes (Low organic carbon) |
| **Available N** | 303.6 kg/ha | 280 – 560 | 140 – 280 | < 140 | **S1** | No |
| **Bulk Density**| 1.39 g/cm³| 1.1 – 1.3 | 1.3 – 1.4 | 1.4 – 1.5 | **S2** | Mild compaction |
| **Slope** | 1.54% | 0 – 2% | 2 – 5% | 5 – 8% | **S1** | No |
| **Texture** | Clay | Clay Loam / Loam| Silty Clay | Clay | **S3** | Aeration limitation |
| **Temperature** | 26.6°C | 24 – 30°C | 20 – 24°C | 15 – 20°C | **S1** | No |
| **Water (Irrig)**| Canal (>1500mm)| > 1500mm | 1200 – 1500mm | 1000 – 1200mm | **S1** | No |

- **Weighted Score**: **74.5%**
- **Liebig Constraint**: S3 (due to Soil Texture, pH 8.01, and SOC 0.44%)
- **Final Result**: **Class S2 (Score 74.5%) with S3 limitations identified**.

### Evaluation 2: Chickpea (*Cicer arietinum*)
- **pH (8.01)**: **S2** (tolerance 6.0 – 8.5)
- **SOC (0.44%)**: **S2** (legume tolerance down to 0.4%)
- **Nitrogen (303.6 kg/ha)**: **S1** (low N requirement due to rhizobial fixation)
- **Slope (1.54%)**: **S1** (flat, excellent drainage required)
- **Texture (Clay)**: **S2** (moderately well-drained vertisol)
- **Weighted Score**: **80.0%**
- **Final Result**: **Class S2 (Moderately Suitable)**.

---

## 9. API Reference

### 1. `GET /api/v1/crop-suitability/crops`
Returns metadata and local Marathi names for the 10 supported crops.

### 2. `GET /api/v1/crop-suitability/weather-summary`
Returns 30-year WMO baseline normals (1991–2020) and 2016–2025 recent variability indicators.

### 3. `GET /api/v1/crop-suitability/gat/{gat_no}?irrigation_available=true`
Evaluates all 10 crops for a single Gat.
- **Query Parameters**:
  - `gat_no` (int): Gat parcel number (e.g., 1 to 217).
  - `irrigation_available` (bool, default: `true`).

### 4. `GET /api/v1/crop-suitability/crop/{crop_code}?irrigation_available=true`
Evaluates all 217 Gats for the selected crop code (e.g. `sugarcane`, `pomegranate`, `tomato`).
Returns:
- `summary`: Total Gats and area in hectares by class (S1, S2, S3, N).
- `results`: Detailed parcel breakdown.

### 5. `GET /api/v1/crop-suitability/crop/{crop_code}/geojson?irrigation_available=true`
Returns standard GeoJSON FeatureCollection with:
- Polygon boundaries in `EPSG:4326`.
- Embedded properties: `suitability_class`, `score`, `limiting_factors`, `fill_color`, and `border_color`.

### 6. `GET /api/v1/crop-suitability/export/csv?crop_code={crop_code}&irrigation_available=true`
Exports a CSV table of all evaluated Gats, indicators, classes, and limiting factors.

### 7. `POST /api/v1/crop-suitability/refresh`
Forces a re-extraction of raster zonal statistics and regenerates the indicators cache.

---

## 10. How to Run & Validate the System

### Backend Startup

```powershell
# Navigate to backend directory
cd c:\Users\Rutuja\Downloads\market-0.2-main\market-0.2-main\backend

# Activate virtual environment
..\venv\Scripts\Activate.ps1

# Run automated GIS test suite
pytest tests\test_gis_crop_suitability.py -v

# Start FastAPI dev server on port 8000
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### Frontend Startup

```powershell
# Navigate to frontend directory
cd c:\Users\Rutuja\Downloads\market-0.2-main\market-0.2-main\frontend

# Verify TypeScript compilation
npm run typecheck

# Run test suite
npm run test

# Start Next.js development server
npm run dev
```

### Accessing the Web Application

- **Field Crop Suitability Dashboard**: [http://localhost:3000/field-suitability](http://localhost:3000/field-suitability)
- **API Swagger Documentation**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **Existing Soil Health & DSM Maps**: [http://localhost:3000/map](http://localhost:3000/map)
- **Market Intelligence**: [http://localhost:3000/market](http://localhost:3000/market)
