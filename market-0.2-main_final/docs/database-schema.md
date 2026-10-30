# SoilPilot Database Schema Specification (Phase 2)

## 1. Overview & Architectural Principles

The SoilPilot database is built on **PostgreSQL 16 + PostGIS**. It models the administrative geographic hierarchy and cadastral agricultural parcels required for farmer-driven access.

### Core Database Principles
1. **Normalized Geographic Hierarchy**: State → District → Taluka → Village. Relational foreign keys enforce integrity without duplicating administrative strings inside field records.
2. **Village-Scoped Gat Uniqueness**: Gat numbers are human-facing cadastral parcel identifiers that are unique **within a specific village**, not globally across the state. This is enforced by:
   ```sql
   CONSTRAINT uq_field_village_gat UNIQUE(village_id, gat_no)
   ```
   This ensures that Gat `123` can legitimately exist in Village Malegaon and also in Village Wagholi without collisions.
3. **Internal Synthetic Keys**: All relationships use internal integer primary keys (`field.id`, `village.id`). Gat numbers are stored as varchar strings (`String(50)`) to preserve parcel notation nuances (e.g. `124/A`, `45/2`).
4. **Spatial Geometry**: Parcels store boundary coordinates using PostGIS `Geometry('MULTIPOLYGON', srid=4326)` indexed with a spatial GiST index for fast polygon intersection and spatial querying.
5. **Farmer Multi-Field Ownership**: One farmer can own or manage multiple fields (`Farmer 1:N Fields`).
6. **Soft Status (`is_active`)**: Records are marked inactive rather than hard-deleted to preserve historical soil test audits.

---

## 2. Entity Relationship Diagram

```text
┌──────────────────────────────────────┐
│                states                │
├──────────────────────────────────────┤
│ id           : INTEGER PK            │
│ name         : VARCHAR(100)          │
│ code         : VARCHAR(10) UNIQUE    │
│ is_active    : BOOLEAN               │
│ created_at   : TIMESTAMPTZ           │
│ updated_at   : TIMESTAMPTZ           │
└──────────────────┬───────────────────┘
                   │ 1
                   │
                   │ N
┌──────────────────▼───────────────────┐
│              districts               │
├──────────────────────────────────────┤
│ id           : INTEGER PK            │
│ state_id     : INTEGER FK -> states  │
│ name         : VARCHAR(100)          │
│ code         : VARCHAR(10)           │
│ is_active    : BOOLEAN               │
│ created_at   : TIMESTAMPTZ           │
│ updated_at   : TIMESTAMPTZ           │
└──────────────────┬───────────────────┘
                   │ 1
                   │
                   │ N
┌──────────────────▼───────────────────┐
│               talukas                │
├──────────────────────────────────────┤
│ id           : INTEGER PK            │
│ district_id  : INTEGER FK -> dist    │
│ name         : VARCHAR(100)          │
│ code         : VARCHAR(10)           │
│ is_active    : BOOLEAN               │
│ created_at   : TIMESTAMPTZ           │
│ updated_at   : TIMESTAMPTZ           │
└──────────────────┬───────────────────┘
                   │ 1
                   │
                   │ N
┌──────────────────▼───────────────────┐
│               villages               │
├──────────────────────────────────────┤
│ id           : INTEGER PK            │
│ taluka_id    : INTEGER FK -> talukas │
│ name         : VARCHAR(100)          │
│ code         : VARCHAR(10)           │
│ is_active    : BOOLEAN               │
│ created_at   : TIMESTAMPTZ           │
│ updated_at   : TIMESTAMPTZ           │
└──────────────────┬───────────────────┘
                   │ 1
                   │
                   │ N
┌──────────────────▼───────────────────┐           ┌──────────────────────────────────────┐
│                fields                │           │               farmers                │
├──────────────────────────────────────┤           ├──────────────────────────────────────┤
│ id           : INTEGER PK            │     N     │ id           : INTEGER PK            │
│ village_id   : INTEGER FK -> village │◄──────────┤ farmer_code  : VARCHAR(50) UNIQUE    │
│ farmer_id    : INTEGER FK -> farmers │ 1         │ full_name    : VARCHAR(150)          │
│ gat_no       : VARCHAR(50)           │           │ mobile_number: VARCHAR(20)           │
│ area         : DOUBLE PRECISION      │           │ preferred_lang: VARCHAR(10)          │
│ area_unit    : VARCHAR(20)           │           │ is_active    : BOOLEAN               │
│ geometry     : GEOMETRY(MPOLY, 4326) │           │ created_at   : TIMESTAMPTZ           │
│ is_demo      : BOOLEAN               │           │ updated_at   : TIMESTAMPTZ           │
│ is_active    : BOOLEAN               │           └──────────────────────────────────────┘
│ created_at   : TIMESTAMPTZ           │
│ updated_at   : TIMESTAMPTZ           │
├──────────────────────────────────────┤
│ CONSTRAINT: UNIQUE(village_id, gat_no)│
│ INDEX: GiST(geometry)                │
└──────────────────────────────────────┘
```

---

## 3. Detailed Table Specifications

### 3.1. `states`
| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | INTEGER | PRIMARY KEY, AUTOINCREMENT | Unique state identifier |
| `name` | VARCHAR(100) | NOT NULL, INDEX | State name (e.g. Maharashtra) |
| `code` | VARCHAR(10) | NOT NULL, UNIQUE, INDEX | State ISO/short code (e.g. MH) |
| `is_active` | BOOLEAN | NOT NULL, DEFAULT true | Liveness flag |
| `created_at` | TIMESTAMPTZ | NOT NULL | Record creation timestamp |
| `updated_at` | TIMESTAMPTZ | NOT NULL | Record update timestamp |

### 3.2. `districts`
| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | INTEGER | PRIMARY KEY, AUTOINCREMENT | Unique district identifier |
| `state_id` | INTEGER | NOT NULL, FK -> states(id) ON DELETE RESTRICT | Owning state reference |
| `name` | VARCHAR(100) | NOT NULL, INDEX | District name (e.g. Pune) |
| `code` | VARCHAR(10) | NULLABLE, INDEX | Short code (e.g. PN) |
| `is_active` | BOOLEAN | NOT NULL, DEFAULT true | Liveness flag |
| `created_at` | TIMESTAMPTZ | NOT NULL | Record creation timestamp |
| `updated_at` | TIMESTAMPTZ | NOT NULL | Record update timestamp |

### 3.3. `talukas`
| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | INTEGER | PRIMARY KEY, AUTOINCREMENT | Unique taluka identifier |
| `district_id`| INTEGER | NOT NULL, FK -> districts(id) ON DELETE RESTRICT | Owning district reference |
| `name` | VARCHAR(100) | NOT NULL, INDEX | Taluka/Tehsil name (e.g. Baramati) |
| `code` | VARCHAR(10) | NULLABLE, INDEX | Short code (e.g. BRM) |
| `is_active` | BOOLEAN | NOT NULL, DEFAULT true | Liveness flag |
| `created_at` | TIMESTAMPTZ | NOT NULL | Record creation timestamp |
| `updated_at` | TIMESTAMPTZ | NOT NULL | Record update timestamp |

### 3.4. `villages`
| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | INTEGER | PRIMARY KEY, AUTOINCREMENT | Unique village identifier |
| `taluka_id` | INTEGER | NOT NULL, FK -> talukas(id) ON DELETE RESTRICT | Owning taluka reference |
| `name` | VARCHAR(100) | NOT NULL, INDEX | Village name (e.g. Malegaon) |
| `code` | VARCHAR(10) | NULLABLE, INDEX | Census/cadastral code (e.g. MLG) |
| `is_active` | BOOLEAN | NOT NULL, DEFAULT true | Liveness flag |
| `created_at` | TIMESTAMPTZ | NOT NULL | Record creation timestamp |
| `updated_at` | TIMESTAMPTZ | NOT NULL | Record update timestamp |

### 3.5. `farmers`
| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | INTEGER | PRIMARY KEY, AUTOINCREMENT | Unique farmer identifier |
| `farmer_code`| VARCHAR(50) | NOT NULL, UNIQUE, INDEX | Landholder registration code |
| `full_name` | VARCHAR(150) | NOT NULL, INDEX | Landholder full name |
| `mobile_number`| VARCHAR(20)| NULLABLE, INDEX | Contact mobile number |
| `preferred_language`| VARCHAR(10)| NOT NULL, DEFAULT 'mr' | Language preference (en/mr) |
| `is_active` | BOOLEAN | NOT NULL, DEFAULT true | Liveness flag |
| `created_at` | TIMESTAMPTZ | NOT NULL | Record creation timestamp |
| `updated_at` | TIMESTAMPTZ | NOT NULL | Record update timestamp |

### 3.6. `fields`
| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | INTEGER | PRIMARY KEY, AUTOINCREMENT | Unique internal field identifier |
| `village_id`| INTEGER | NOT NULL, FK -> villages(id) ON DELETE RESTRICT | Cadastral village location |
| `farmer_id` | INTEGER | NULLABLE, FK -> farmers(id) ON DELETE RESTRICT | Owning landholder |
| `gat_no` | VARCHAR(50) | NOT NULL, INDEX | Cadastral Gat parcel number |
| `area` | FLOAT | NULLABLE | Measured farm acreage |
| `area_unit` | VARCHAR(20) | NOT NULL, DEFAULT 'hectare' | Unit of measurement |
| `geometry` | GEOMETRY(MPOLY, 4326)| NULLABLE, SPATIAL INDEX (GiST) | PostGIS spatial boundary |
| `is_demo` | BOOLEAN | NOT NULL, DEFAULT true | Demo flag for testing |
| `is_active` | BOOLEAN | NOT NULL, DEFAULT true | Liveness flag |
| `created_at` | TIMESTAMPTZ | NOT NULL | Record creation timestamp |
| `updated_at` | TIMESTAMPTZ | NOT NULL | Record update timestamp |

**Composite Constraints**:
- `UNIQUE (village_id, gat_no)` — Named `uq_field_village_gat`
- `INDEX (village_id, gat_no)` — Named `ix_fields_village_gat`
