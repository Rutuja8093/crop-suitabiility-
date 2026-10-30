"""Market data ingestion service for AGMARKNET / Open Government Data (data.gov.in).
SoilPilot Phase 4: Ingestion, validation, deduplication, and persistence.
"""

from datetime import date, datetime, timezone
from decimal import Decimal, InvalidOperation
import hashlib
import json
import logging
from typing import Dict, Any, List, Optional, Tuple
import urllib.request
import urllib.error
import urllib.parse

from sqlalchemy.orm import Session
from sqlalchemy import select, and_, desc, func

from app.core.config import settings
from app.models.geography import State, District, Taluka
from app.models.market_intelligence import (
    DataSourceRegistry,
    Commodity,
    MarketApmc,
    CommodityMarketMapping,
    MarketPriceObservation,
)

logger = logging.getLogger(__name__)


# Standard Maharashtra Reference Commodities
DEFAULT_COMMODITIES = [
    {
        "code": "SOYBEAN",
        "name": "Soybean",
        "name_mr": "सोयाबीन",
        "category": "OILSEEDS",
        "standard_unit": "QUINTAL",
        "crop_duration_min_days": 90,
        "crop_duration_max_days": 110,
        "aliases": ["soyabean", "soybean", "सोयाबीन"]
    },
    {
        "code": "ONION",
        "name": "Onion",
        "name_mr": "कांदा",
        "category": "VEGETABLES",
        "standard_unit": "QUINTAL",
        "crop_duration_min_days": 120,
        "crop_duration_max_days": 150,
        "aliases": ["onion", "onion red", "कांदा"]
    },
    {
        "code": "COTTON",
        "name": "Cotton",
        "name_mr": "कापूस",
        "category": "CASH_CROPS",
        "standard_unit": "QUINTAL",
        "crop_duration_min_days": 150,
        "crop_duration_max_days": 180,
        "aliases": ["cotton", "कापूस"]
    },
    {
        "code": "GRAM",
        "name": "Bengal Gram",
        "name_mr": "हरभरा",
        "category": "PULSES",
        "standard_unit": "QUINTAL",
        "crop_duration_min_days": 95,
        "crop_duration_max_days": 115,
        "aliases": ["gram", "bengal gram", "chana", "हरभरा", "चना"]
    },
    {
        "code": "WHEAT",
        "name": "Wheat",
        "name_mr": "गहू",
        "category": "CEREALS",
        "standard_unit": "QUINTAL",
        "crop_duration_min_days": 105,
        "crop_duration_max_days": 125,
        "aliases": ["wheat", "गहू"]
    },
    {
        "code": "MAIZE",
        "name": "Maize",
        "name_mr": "मका",
        "category": "CEREALS",
        "standard_unit": "QUINTAL",
        "crop_duration_min_days": 85,
        "crop_duration_max_days": 105,
        "aliases": ["maize", "corn", "मका"]
    },
    {
        "code": "TUR",
        "name": "Pigeon Pea",
        "name_mr": "तूर",
        "category": "PULSES",
        "standard_unit": "QUINTAL",
        "crop_duration_min_days": 150,
        "crop_duration_max_days": 180,
        "aliases": ["tur", "arhar", "red gram", "तूर"]
    },
    {
        "code": "SUGARCANE",
        "name": "Sugarcane",
        "name_mr": "ऊस",
        "category": "CASH_CROPS",
        "standard_unit": "TONNE",
        "crop_duration_min_days": 300,
        "crop_duration_max_days": 365,
        "aliases": ["sugarcane", "ऊस"]
    },
    {
        "code": "TOMATO",
        "name": "Tomato",
        "name_mr": "टोमॅटो",
        "category": "VEGETABLES",
        "standard_unit": "QUINTAL",
        "crop_duration_min_days": 80,
        "crop_duration_max_days": 100,
        "aliases": ["tomato", "टोमॅटो"]
    },
    {
        "code": "BAJRA",
        "name": "Pearl Millet",
        "name_mr": "बाजरी",
        "category": "CEREALS",
        "standard_unit": "QUINTAL",
        "crop_duration_min_days": 80,
        "crop_duration_max_days": 95,
        "aliases": ["bajra", "pearl millet", "बाजरी"]
    },
    {
        "code": "JOWAR",
        "name": "Sorghum",
        "name_mr": "ज्वारी",
        "category": "CEREALS",
        "standard_unit": "QUINTAL",
        "crop_duration_min_days": 100,
        "crop_duration_max_days": 120,
        "aliases": ["jowar", "sorghum", "ज्वारी"]
    },
    {
        "code": "POMEGRANATE",
        "name": "Pomegranate",
        "name_mr": "डाळिंब",
        "category": "FRUITS",
        "standard_unit": "QUINTAL",
        "crop_duration_min_days": 150,
        "crop_duration_max_days": 180,
        "aliases": ["pomegranate", "डाळिंब"]
    },
    {
        "code": "BANANA",
        "name": "Banana",
        "name_mr": "केळी",
        "category": "FRUITS",
        "standard_unit": "QUINTAL",
        "crop_duration_min_days": 330,
        "crop_duration_max_days": 390,
        "aliases": ["banana", "केळी"]
    }
]

# Standard Pune & Maharashtra Reference APMC Mandis
DEFAULT_MARKETS = [
    {
        "code": "MH_BARAMATI_APMC",
        "name": "Baramati APMC",
        "name_mr": "बारामती कृषी उत्पन्न बाजार समिती",
        "taluka": "Baramati",
        "district": "Pune",
        "agmarknet_id": "AGM_MH_BARAMATI",
        "market_type": "PRINCIPAL_MARKET"
    },
    {
        "code": "MH_PUNE_GULTEKDI",
        "name": "Pune APMC (Gultekdi)",
        "name_mr": "पुणे कृषी उत्पन्न बाजार समिती (गुलटेकडी)",
        "taluka": "Haveli",
        "district": "Pune",
        "agmarknet_id": "AGM_MH_PUNE",
        "market_type": "PRINCIPAL_MARKET"
    },
    {
        "code": "MH_INDAPUR_APMC",
        "name": "Indapur APMC",
        "name_mr": "इंदापूर कृषी उत्पन्न बाजार समिती",
        "taluka": "Indapur",
        "district": "Pune",
        "agmarknet_id": "AGM_MH_INDAPUR",
        "market_type": "PRINCIPAL_MARKET"
    },
    {
        "code": "MH_DAUND_APMC",
        "name": "Daund APMC",
        "name_mr": "दौंड कृषी उत्पन्न बाजार समिती",
        "taluka": "Daund",
        "district": "Pune",
        "agmarknet_id": "AGM_MH_DAUND",
        "market_type": "PRINCIPAL_MARKET"
    },
    {
        "code": "MH_SHIRUR_APMC",
        "name": "Shirur APMC",
        "name_mr": "शिरूर कृषी उत्पन्न बाजार समिती",
        "taluka": "Shirur",
        "district": "Pune",
        "agmarknet_id": "AGM_MH_SHIRUR",
        "market_type": "PRINCIPAL_MARKET"
    },
    {
        "code": "MH_LASALGAON_APMC",
        "name": "Lasalgaon APMC",
        "name_mr": "लासलगाव कृषी उत्पन्न बाजार समिती (कांदा बाजार)",
        "taluka": "Niphad",
        "district": "Nashik",
        "agmarknet_id": "AGM_MH_LASALGAON",
        "market_type": "PRINCIPAL_MARKET"
    }
]


class MarketIngestionService:
    """Service orchestrating agricultural market data ingestion, validation, and retrieval."""

    def ensure_seed_metadata(self, db: Session) -> DataSourceRegistry:
        """Ensure AGMARKNET source, commodities, and core APMCs are initialized in the database."""
        # 1. Ensure DataSourceRegistry record
        source = db.scalar(select(DataSourceRegistry).filter_by(code="AGMARKNET"))
        if not source:
            source = DataSourceRegistry(
                code="AGMARKNET",
                name="Agmarknet - Agricultural Marketing Information Network",
                source_type="GOVERNMENT_PORTAL",
                official_url="https://agmarknet.gov.in",
                access_method="REST_API",
                licensing_notes="Open Data under National Data Sharing and Accessibility Policy (NDSAP) India",
                update_frequency="DAILY",
                operational_status="PENDING_INTEGRATION" if not settings.DATA_GOV_IN_API_KEY else "ACTIVE"
            )
            db.add(source)
            db.flush()

        # 2. Ensure default commodities
        for c in DEFAULT_COMMODITIES:
            existing = db.scalar(select(Commodity).filter_by(code=c["code"]))
            if not existing:
                comm = Commodity(
                    code=c["code"],
                    name=c["name"],
                    name_mr=c["name_mr"],
                    category=c["category"],
                    standard_unit=c["standard_unit"],
                    crop_duration_min_days=c.get("crop_duration_min_days"),
                    crop_duration_max_days=c.get("crop_duration_max_days"),
                    is_active=True
                )
                db.add(comm)
        db.flush()

        # 3. Ensure State & Districts exist
        mh_state = db.scalar(select(State).filter_by(name="Maharashtra"))
        if not mh_state:
            mh_state = State(name="Maharashtra", code="MH", is_active=True)
            db.add(mh_state)
            db.flush()

        pune_dist = db.scalar(select(District).filter_by(name="Pune", state_id=mh_state.id))
        if not pune_dist:
            pune_dist = District(name="Pune", code="PN", state_id=mh_state.id, is_active=True)
            db.add(pune_dist)
            db.flush()

        # 4. Ensure reference APMC markets exist
        for m in DEFAULT_MARKETS:
            m_code = m["code"]
            existing_mkt = db.scalar(select(MarketApmc).filter_by(market_code=m_code))
            if not existing_mkt:
                # Find or assign district
                dist = db.scalar(select(District).filter_by(name=m["district"], state_id=mh_state.id))
                if not dist:
                    dist = District(name=m["district"], code=m["district"][:3].upper(), state_id=mh_state.id, is_active=True)
                    db.add(dist)
                    db.flush()

                # Find taluka if specified
                taluka = None
                if m.get("taluka"):
                    taluka = db.scalar(select(Taluka).filter_by(name=m["taluka"], district_id=dist.id))

                mkt = MarketApmc(
                    market_code=m_code,
                    name=m["name"],
                    name_mr=m["name_mr"],
                    state_id=mh_state.id,
                    district_id=dist.id,
                    taluka_id=taluka.id if taluka else None,
                    agmarknet_market_id=m.get("agmarknet_id"),
                    market_type=m.get("market_type", "PRINCIPAL_MARKET"),
                    is_active=True
                )
                db.add(mkt)
        db.commit()
        return source

    def resolve_commodity(self, db: Session, raw_name: str) -> Optional[Commodity]:
        """Resolve a raw commodity string from an APMC bulletin to a canonical Commodity."""
        if not raw_name:
            return None
        clean = raw_name.strip().lower()

        # 1. Exact match on code or name
        for c in DEFAULT_COMMODITIES:
            for alias in c["aliases"]:
                if alias in clean or clean in alias:
                    comm = db.scalar(select(Commodity).filter_by(code=c["code"]))
                    if comm:
                        return comm

        # 2. Case-insensitive substring match in DB
        comm = db.scalar(select(Commodity).filter(func.lower(Commodity.name).contains(clean)))
        if comm:
            return comm

        # 3. Fallback: create dynamic commodity record if genuinely new
        slug = clean.replace(" ", "_").replace("(", "").replace(")", "").upper()[:50]
        new_comm = Commodity(
            code=slug,
            name=raw_name.strip().title(),
            name_mr=raw_name.strip(),
            category="OTHER",
            standard_unit="QUINTAL",
            is_active=True
        )
        db.add(new_comm)
        db.flush()
        return new_comm

    def resolve_market(self, db: Session, market_name: str, district_name: Optional[str] = "Pune", state_name: str = "Maharashtra") -> MarketApmc:
        """Resolve or dynamically register an APMC market under Maharashtra."""
        clean_name = market_name.strip()
        # Look up existing
        mkt = db.scalar(select(MarketApmc).filter(func.lower(MarketApmc.name).contains(clean_name.lower())))
        if mkt:
            return mkt

        # Find or create State & District
        state = db.scalar(select(State).filter_by(name=state_name))
        if not state:
            state = State(name=state_name, code="MH", is_active=True)
            db.add(state)
            db.flush()

        dist_name = district_name.strip() if district_name else "Pune"
        dist = db.scalar(select(District).filter_by(name=dist_name, state_id=state.id))
        if not dist:
            dist = District(name=dist_name, code=dist_name[:3].upper(), state_id=state.id, is_active=True)
            db.add(dist)
            db.flush()

        code = f"MH_{dist_name.upper()}_{clean_name.replace(' ', '_').upper()}"[:50]
        mkt = MarketApmc(
            market_code=code,
            name=f"{clean_name} APMC",
            name_mr=f"{clean_name} बाजार समिती",
            state_id=state.id,
            district_id=dist.id,
            is_active=True
        )
        db.add(mkt)
        db.flush()
        return mkt

    def parse_date(self, raw_date: Any) -> Optional[date]:
        """Parse date string safely across common Indian bulletin formats (DD/MM/YYYY, YYYY-MM-DD)."""
        if not raw_date:
            return None
        if isinstance(raw_date, date):
            return raw_date

        date_str = str(raw_date).strip()
        # Try DD/MM/YYYY
        for fmt in ("%d/%m/%Y", "%Y-%m-%d", "%d-%m-%Y", "%d/%m/%y"):
            try:
                return datetime.strptime(date_str, fmt).date()
            except ValueError:
                continue
        return None

    def parse_price(self, val: Any) -> Optional[Decimal]:
        """Safely clean and parse numeric price strings into 2-decimal Decimals."""
        if val is None or val == "" or str(val).strip().lower() in ("null", "none", "-", "—", "na"):
            return None
        try:
            clean_str = str(val).replace(",", "").replace("₹", "").strip()
            num = Decimal(clean_str)
            return round(num, 2)
        except (InvalidOperation, ValueError):
            return None

    def validate_observation_record(
        self,
        min_p: Optional[Decimal],
        modal_p: Optional[Decimal],
        max_p: Optional[Decimal],
        arrival_q: Optional[Decimal]
    ) -> Tuple[str, Optional[str]]:
        """
        Validate logical consistency and nonnegativity.
        Returns (validation_status, validation_notes).
        """
        # 1. Nonnegativity checks
        if min_p is not None and min_p < 0:
            return "FLAGGED_NEGATIVE", f"Negative min_price ({min_p}) not allowed"
        if modal_p is not None and modal_p < 0:
            return "FLAGGED_NEGATIVE", f"Negative modal_price ({modal_p}) not allowed"
        if max_p is not None and max_p < 0:
            return "FLAGGED_NEGATIVE", f"Negative max_price ({max_p}) not allowed"

        if arrival_q is not None and arrival_q < 0:
            return "FLAGGED_NEGATIVE", f"Negative arrival quantity ({arrival_q}) not allowed"

        # 2. Spread checks: min <= max
        if min_p is not None and max_p is not None and min_p > max_p:
            return "SUSPECT_INVERTED", f"Inconsistent spread: min_price ({min_p}) > max_price ({max_p})"

        # 3. Modal price bounds
        if modal_p is not None:
            if min_p is not None and modal_p < min_p:
                return "FLAGGED_OUTLIER", f"Inconsistent modal_price ({modal_p}) < min_price ({min_p})"
            if max_p is not None and modal_p > max_p:
                return "FLAGGED_OUTLIER", f"Inconsistent modal_price ({modal_p}) > max_price ({max_p})"

        return "VERIFIED", None

    def ingest_records(
        self,
        db: Session,
        records: List[Dict[str, Any]],
        source_code: str = "AGMARKNET"
    ) -> Dict[str, Any]:
        """
        Ingest a list of raw mandi bulletin records with idempotency, validation, and deduplication.
        """
        source = self.ensure_seed_metadata(db)
        now_utc = datetime.now(timezone.utc)

        stats = {
            "source": source.name if source else "AGMARKNET / OGD India",
            "records_fetched": len(records),
            "records_validated": 0,
            "records_inserted": 0,
            "records_updated": 0,
            "records_skipped": 0,
            "records_rejected": 0,
            "errors": [],
            "status": "SUCCESS"
        }

        for idx, row in enumerate(records):
            try:
                raw_commodity = row.get("commodity") or row.get("Commodity") or ""
                raw_market = row.get("market") or row.get("Market") or ""
                raw_district = row.get("district") or row.get("District") or "Pune"
                raw_state = row.get("state") or row.get("State") or "Maharashtra"
                raw_date = row.get("arrival_date") or row.get("Arrival_Date") or row.get("date")

                obs_date = self.parse_date(raw_date)
                if not obs_date:
                    stats["records_rejected"] += 1
                    stats["errors"].append(f"Row {idx}: Missing or invalid arrival_date '{raw_date}'")
                    continue

                if not raw_commodity or not raw_market:
                    stats["records_rejected"] += 1
                    stats["errors"].append(f"Row {idx}: Missing commodity or market name")
                    continue

                # Parse prices
                min_p = self.parse_price(row.get("min_price") or row.get("Min_Price"))
                modal_p = self.parse_price(row.get("modal_price") or row.get("Modal_Price"))
                max_p = self.parse_price(row.get("max_price") or row.get("Max_Price"))
                arrival_q = self.parse_price(row.get("arrival_quantity") or row.get("Arrival_Quantity"))

                # Validate
                val_status, val_notes = self.validate_observation_record(min_p, modal_p, max_p, arrival_q)
                if val_status in ("SUSPECT_INVERTED", "FLAGGED_NEGATIVE", "FLAGGED_OUTLIER"):
                    stats["records_rejected"] += 1
                    stats["errors"].append(f"Row {idx} ({raw_market} - {raw_commodity}): {val_notes}")
                    continue

                stats["records_validated"] += 1

                # Resolve relations
                commodity = self.resolve_commodity(db, raw_commodity)
                market = self.resolve_market(db, raw_market, raw_district, raw_state)

                variety = str(row.get("variety") or row.get("Variety") or "").strip()
                grade = str(row.get("grade") or row.get("Grade") or "").strip()

                # Deterministic record hash for duplicate matching
                source_record_id = row.get("source_record_id") or hashlib.sha256(
                    f"{market.market_code}|{commodity.code}|{obs_date.isoformat()}|{variety}|{grade}".encode("utf-8")
                ).hexdigest()[:32]

                # Check for existing observation (idempotency check)
                existing = db.scalar(
                    select(MarketPriceObservation).filter(
                        and_(
                            MarketPriceObservation.commodity_id == commodity.id,
                            MarketPriceObservation.market_id == market.id,
                            MarketPriceObservation.observation_date == obs_date,
                            MarketPriceObservation.source_record_id == source_record_id
                        )
                    )
                )

                if existing:
                    # If prices are identical, skip as duplicate
                    if existing.modal_price == modal_p and existing.min_price == min_p and existing.max_price == max_p:
                        stats["records_skipped"] += 1
                        continue
                    else:
                        # Price bulletin revised / corrected
                        existing.min_price = min_p
                        existing.modal_price = modal_p
                        existing.max_price = max_p
                        existing.arrival_quantity = arrival_q
                        existing.retrieval_timestamp = now_utc
                        existing.validation_status = val_status
                        existing.validation_notes = val_notes
                        existing.raw_payload = row
                        stats["records_updated"] += 1
                else:
                    new_obs = MarketPriceObservation(
                        commodity_id=commodity.id,
                        market_id=market.id,
                        source_id=source.id,
                        source_record_id=source_record_id,
                        observation_date=obs_date,
                        retrieval_timestamp=now_utc,
                        min_price=min_p,
                        modal_price=modal_p,
                        max_price=max_p,
                        currency="INR",
                        price_unit="RS_PER_QUINTAL",
                        arrival_quantity=arrival_q,
                        arrival_unit="TONNE",
                        raw_payload=row,
                        validation_status=val_status,
                        validation_notes=val_notes,
                        is_active=True
                    )
                    db.add(new_obs)
                    stats["records_inserted"] += 1

            except Exception as e:
                stats["records_rejected"] += 1
                stats["errors"].append(f"Row {idx} exception: {str(e)}")
                logger.error(f"Error ingesting row {idx}: {e}", exc_info=True)

        # Update source registry operational metadata
        source.last_attempted_retrieval_at = now_utc
        if stats["records_inserted"] > 0 or stats["records_updated"] > 0 or stats["records_skipped"] > 0:
            source.last_successful_retrieval_at = now_utc
            source.operational_status = "ACTIVE"

        db.commit()
        return stats

    def fetch_and_ingest_data_gov_in(
        self,
        db: Session,
        district: Optional[str] = "Pune",
        market: Optional[str] = None,
        commodity: Optional[str] = None,
        limit: int = 100
    ) -> Dict[str, Any]:
        """
        Fetch real daily market observations from the official data.gov.in AGMARKNET API.
        Respects credentials, handles network timeouts gracefully, and returns honest status.
        """
        source = self.ensure_seed_metadata(db)
        now_utc = datetime.now(timezone.utc)
        source.last_attempted_retrieval_at = now_utc

        api_key = settings.DATA_GOV_IN_API_KEY
        if not api_key:
            source.operational_status = "CREDENTIALS_REQUIRED"
            db.commit()
            return {
                "status": "NOT_CONFIGURED",
                "source": "AGMARKNET / OGD India",
                "detail": (
                    "DATA_GOV_IN_API_KEY is not configured in the backend environment. "
                    "To enable automatic daily AGMARKNET synchronization, register at https://data.gov.in "
                    "and provide your key in .env or the system environment variables."
                ),
                "records_fetched": 0,
                "records_validated": 0,
                "records_inserted": 0,
                "records_updated": 0,
                "records_skipped": 0,
                "records_rejected": 0,
                "errors": ["Missing DATA_GOV_IN_API_KEY"],
                "timestamp": now_utc.isoformat()
            }

        # Build query parameters
        params = {
            "api-key": api_key,
            "format": "json",
            "offset": 0,
            "limit": limit,
            "filters[state]": "Maharashtra"
        }
        if district:
            params["filters[district]"] = district
        if market:
            params["filters[market]"] = market
        if commodity:
            params["filters[commodity]"] = commodity

        query_string = urllib.parse.urlencode(params)
        url = f"{settings.AGMARKNET_API_BASE_URL}/{settings.AGMARKNET_RESOURCE_ID}?{query_string}"

        req = urllib.request.Request(
            url,
            headers={
                "User-Agent": "SoilPilot-AgriDSM-MarketService/1.0",
                "Accept": "application/json"
            }
        )

        try:
            with urllib.request.urlopen(req, timeout=12) as response:
                if response.status != 200:
                    source.operational_status = "DEGRADED"
                    db.commit()
                    return {
                        "status": "HTTP_ERROR",
                        "source": "AGMARKNET / OGD India",
                        "detail": f"data.gov.in returned HTTP {response.status}",
                        "records_fetched": 0,
                        "records_validated": 0,
                        "records_inserted": 0,
                        "records_updated": 0,
                        "records_skipped": 0,
                        "records_rejected": 0,
                        "errors": [f"HTTP {response.status}"],
                        "timestamp": now_utc.isoformat()
                    }

                payload = json.loads(response.read().decode("utf-8"))
                records = payload.get("records", [])
                stats = self.ingest_records(db, records, source_code="AGMARKNET")
                stats["timestamp"] = now_utc.isoformat()
                return stats

        except urllib.error.HTTPError as e:
            source.operational_status = "DEGRADED"
            db.commit()
            return {
                "status": "HTTP_ERROR",
                "source": "AGMARKNET / OGD India",
                "detail": f"data.gov.in error ({e.code}): Check API key permissions and quota",
                "records_fetched": 0,
                "records_validated": 0,
                "records_inserted": 0,
                "records_updated": 0,
                "records_skipped": 0,
                "records_rejected": 0,
                "errors": [str(e)],
                "timestamp": now_utc.isoformat()
            }
        except Exception as e:
            source.operational_status = "TEMPORARILY_UNAVAILABLE"
            db.commit()
            return {
                "status": "NETWORK_UNAVAILABLE",
                "source": "AGMARKNET / OGD India",
                "detail": "AGMARKNET endpoint is currently unreachable or timed out from the network environment.",
                "records_fetched": 0,
                "records_validated": 0,
                "records_inserted": 0,
                "records_updated": 0,
                "records_skipped": 0,
                "records_rejected": 0,
                "errors": [str(e)],
                "timestamp": now_utc.isoformat()
            }

    def get_observations(
        self,
        db: Session,
        commodity_id: Optional[int] = None,
        market_id: Optional[int] = None,
        district_name: Optional[str] = None,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        page: int = 1,
        limit: int = 50
    ) -> Dict[str, Any]:
        """Query and paginate verified market price observations from the database."""
        self.ensure_seed_metadata(db)

        query = select(MarketPriceObservation).join(
            MarketPriceObservation.commodity
        ).join(
            MarketPriceObservation.market
        ).join(
            MarketPriceObservation.source
        ).filter(
            MarketPriceObservation.is_active == True  # noqa: E712
        )

        if commodity_id:
            query = query.filter(MarketPriceObservation.commodity_id == commodity_id)
        if market_id:
            query = query.filter(MarketPriceObservation.market_id == market_id)
        if district_name:
            query = query.join(MarketApmc.district).filter(func.lower(District.name) == district_name.strip().lower())
        if start_date:
            query = query.filter(MarketPriceObservation.observation_date >= start_date)
        if end_date:
            query = query.filter(MarketPriceObservation.observation_date <= end_date)

        # Count total matching
        count_query = select(func.count()).select_from(query.subquery())
        total = db.scalar(count_query) or 0

        # Order by newest observation first
        query = query.order_by(desc(MarketPriceObservation.observation_date), desc(MarketPriceObservation.id))
        offset = (max(page, 1) - 1) * limit
        items = db.scalars(query.offset(offset).limit(limit)).all()

        # Find newest observation date overall
        latest_date_query = select(func.max(MarketPriceObservation.observation_date))
        latest_date = db.scalar(latest_date_query)

        # Source operational status
        source = db.scalar(select(DataSourceRegistry).filter_by(code="AGMARKNET"))
        src_status = source.operational_status if source else "PENDING_INTEGRATION"

        freshness_status = "NO_DATA"
        if latest_date:
            delta = (date.today() - latest_date).days
            freshness_status = "FRESH" if delta <= 2 else ("STALE" if delta <= 14 else "HISTORICAL")

        result_items = []
        for o in items:
            result_items.append({
                "id": o.id,
                "commodity_id": o.commodity_id,
                "commodity_name": o.commodity.name,
                "commodity_name_mr": o.commodity.name_mr,
                "commodity_category": o.commodity.category,
                "market_id": o.market_id,
                "market_name": o.market.name,
                "market_name_mr": o.market.name_mr,
                "district_name": o.market.district.name if o.market.district else None,
                "source_record_id": o.source_record_id,
                "observation_date": o.observation_date.isoformat(),
                "retrieval_timestamp": o.retrieval_timestamp.isoformat(),
                "min_price": float(o.min_price) if o.min_price is not None else None,
                "modal_price": float(o.modal_price) if o.modal_price is not None else None,
                "max_price": float(o.max_price) if o.max_price is not None else None,
                "currency": o.currency,
                "price_unit": o.price_unit,
                "arrival_quantity": float(o.arrival_quantity) if o.arrival_quantity is not None else None,
                "arrival_unit": o.arrival_unit,
                "validation_status": o.validation_status,
                "source_name": o.source.name if o.source else "AGMARKNET"
            })

        return {
            "total": total,
            "page": page,
            "limit": limit,
            "items": result_items,
            "latest_observation_date": latest_date.isoformat() if latest_date else None,
            "source_status": src_status,
            "data_freshness_status": freshness_status,
            "summary_message": (
                f"Retrieved {len(result_items)} verified observations."
                if total > 0
                else "No verified market observations are available for this selection yet."
            )
        }


market_ingestion_service = MarketIngestionService()
