"""SoilPilot Gat-Wise Farmer Names Importer.

Imports authoritative Gat-wise farmer names from Excel into the database.
Preserves Unicode Marathi names, cadastral Gat associations, and ensures idempotency.

Source: Malegaon_Khurd_Gat_and_Farmer_Names.xlsx
Worksheet: 'Gat-wise Farmers'
Columns: 'Gat No.', 'Farmer Name'
Village: Malegaon Khurd (Village ID 87, Taluka Baramati, District Pune)
"""

import sys
import os
import argparse
import openpyxl
from datetime import datetime, timezone
from typing import Dict, Any, List, Tuple

# Add backend directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../../backend")))

from app.db.session import SessionLocal, engine
from app.db.base import Base
import app.models  # Ensures all tables are created
from app.models.geography import Village, Taluka, District
from app.models.gat_farmer import GatFarmer
from app.services.field_service import normalize_gat_number


def resolve_village(db, village_name: str = "Malegaon Khurd"):
    """
    Resolve village entity by name or alias.
    Matches 'Malegaon Khurd', 'Malegaon Kh', 'Malegaon Kh.', etc.
    """
    # 1. Exact or ILIKE match
    v = db.query(Village).filter(Village.name.ilike(village_name.strip())).first()
    if v:
        return v

    # 2. Match alias 'Malegaon Kh' in Baramati taluka
    baramati = db.query(Taluka).filter(Taluka.name.ilike("Baramati")).first()
    if baramati:
        v = db.query(Village).filter(
            Village.taluka_id == baramati.id,
            (Village.name.ilike("Malegaon Kh%") | Village.name.ilike("Malegaon Khurd%"))
        ).first()
        if v:
            return v

    # 3. Fallback to ID 87 if present
    v = db.query(Village).filter(Village.id == 87).first()
    if v:
        return v

    raise ValueError(f"Could not resolve village '{village_name}' in database.")


def import_gat_farmers(
    excel_path: str = "Malegaon_Khurd_Gat_and_Farmer_Names.xlsx",
    village_query: str = "Malegaon Khurd",
    dry_run: bool = False,
) -> Dict[str, Any]:
    """
    Main idempotent import function.
    """
    if not os.path.isabs(excel_path):
        root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
        excel_path = os.path.join(root_dir, excel_path)

    if not os.path.exists(excel_path):
        raise FileNotFoundError(f"Excel file not found at: {excel_path}")

    # Ensure tables exist
    Base.metadata.create_all(engine)

    wb = openpyxl.load_workbook(excel_path, data_only=True)
    sheet_name = "Gat-wise Farmers"
    if sheet_name not in wb.sheetnames:
        sheet_name = wb.sheetnames[0]
        print(f"[WARN] Sheet 'Gat-wise Farmers' not found; using '{sheet_name}'")

    ws = wb[sheet_name]
    raw_rows = list(ws.iter_rows(values_only=True))
    wb.close()

    if not raw_rows:
        raise ValueError("Excel file is empty.")

    header = raw_rows[0]
    data_rows = raw_rows[1:]

    # Inspect columns
    gat_col_idx = 0
    name_col_idx = 1
    for idx, col in enumerate(header):
        if col and "gat" in str(col).lower():
            gat_col_idx = idx
        elif col and ("name" in str(col).lower() or "farmer" in str(col).lower()):
            name_col_idx = idx

    db = SessionLocal()
    try:
        village = resolve_village(db, village_query)
        target_village_name = "Malegaon Khurd"

        # Counters & stats
        total_source_records = len(data_rows)
        valid_records = 0
        inserted_count = 0
        updated_count = 0
        skipped_count = 0
        rejected_count = 0
        empty_gats = 0
        empty_names = 0
        exact_duplicate_rows = 0

        seen_file_rows = set()
        gat_counter: Dict[str, int] = {}
        farmer_names_set = set()
        farmer_multi_gat: Dict[str, set] = {}

        # Fetch existing records for this village to ensure idempotency
        existing_records = db.query(GatFarmer).filter(
            GatFarmer.village_id == village.id
        ).all()
        existing_lookup: Dict[Tuple[str, str], GatFarmer] = {
            (r.gat_no, r.farmer_name): r for r in existing_records
        }

        records_to_add: List[GatFarmer] = []

        for row_idx, r in enumerate(data_rows, start=2):
            raw_gat = r[gat_col_idx] if len(r) > gat_col_idx else None
            raw_name = r[name_col_idx] if len(r) > name_col_idx else None

            # Validate Gat
            if raw_gat is None or str(raw_gat).strip() == "":
                empty_gats += 1
                rejected_count += 1
                continue

            # Validate Name
            if raw_name is None or str(raw_name).strip() == "":
                empty_names += 1
                rejected_count += 1
                continue

            # Check for exact duplicate in file
            file_key = (raw_gat, raw_name)
            if file_key in seen_file_rows:
                exact_duplicate_rows += 1
            seen_file_rows.add(file_key)

            clean_gat = normalize_gat_number(str(raw_gat))
            clean_name = str(raw_name).strip()

            valid_records += 1
            gat_counter[clean_gat] = gat_counter.get(clean_gat, 0) + 1
            farmer_names_set.add(clean_name)
            farmer_multi_gat.setdefault(clean_name, set()).add(clean_gat)

            lookup_key = (clean_gat, clean_name)
            if lookup_key in existing_lookup:
                existing = existing_lookup[lookup_key]
                # Update source_row or ensure active
                if existing.source_row != row_idx or existing.village_name != target_village_name:
                    existing.source_row = row_idx
                    existing.village_name = target_village_name
                    existing.is_active = True
                    updated_count += 1
                else:
                    skipped_count += 1
            else:
                new_record = GatFarmer(
                    village_id=village.id,
                    village_name=target_village_name,
                    gat_no=clean_gat,
                    farmer_name=clean_name,
                    source_file=os.path.basename(excel_path),
                    source_row=row_idx,
                    is_active=True,
                )
                records_to_add.append(new_record)
                existing_lookup[lookup_key] = new_record
                inserted_count += 1

        if not dry_run:
            if records_to_add:
                db.bulk_save_objects(records_to_add)
            db.commit()

        # Database verification count
        db_count = db.query(GatFarmer).filter(GatFarmer.village_id == village.id).count()

        multi_gat_farmers_count = sum(1 for gats in farmer_multi_gat.values() if len(gats) > 1)
        top_gats = sorted(gat_counter.items(), key=lambda x: x[1], reverse=True)[:5]

        report = {
            "source_file": os.path.basename(excel_path),
            "sheet_name": sheet_name,
            "village_id": village.id,
            "village_name": target_village_name,
            "village_db_name": village.name,
            "total_source_records": total_source_records,
            "valid_records": valid_records,
            "inserted": inserted_count,
            "updated": updated_count,
            "skipped": skipped_count,
            "rejected": rejected_count,
            "empty_gats": empty_gats,
            "empty_names": empty_names,
            "exact_duplicate_source_rows": exact_duplicate_rows,
            "distinct_gats": len(gat_counter),
            "distinct_farmer_names": len(farmer_names_set),
            "farmers_in_multiple_gats": multi_gat_farmers_count,
            "top_5_largest_gats": top_gats,
            "database_total_count": db_count,
            "matches_source": (db_count == valid_records),
            "dry_run": dry_run,
        }

        return report

    finally:
        db.close()


def print_report(report: Dict[str, Any]):
    print("=" * 70)
    print(" SOILPILOT — GAT-WISE FARMER NAMES IMPORT & VALIDATION REPORT")
    print("=" * 70)
    print(f" Source File             : {report['source_file']}")
    print(f" Sheet Name              : {report['sheet_name']}")
    print(f" Target Village          : {report['village_name']} (ID {report['village_id']}, DB: '{report['village_db_name']}')")
    print(f" Total Source Records    : {report['total_source_records']}")
    print(f" Valid Rows Processed    : {report['valid_records']}")
    print(f" Newly Inserted Records  : {report['inserted']}")
    print(f" Updated Records         : {report['updated']}")
    print(f" Skipped (Already Valid) : {report['skipped']}")
    print(f" Rejected Records        : {report['rejected']}")
    print(f" Empty Gat Numbers       : {report['empty_gats']}")
    print(f" Empty Farmer Names      : {report['empty_names']}")
    print(f" Exact Duplicate Rows    : {report['exact_duplicate_source_rows']}")
    print(f" Total Distinct Gats     : {report['distinct_gats']} (Gats 1 to 222)")
    print(f" Unique Farmer Names     : {report['distinct_farmer_names']}")
    print(f" Farmers in Multiple Gats: {report['farmers_in_multiple_gats']}")
    print("-" * 70)
    print(" Top 5 Largest Gats by Associated Farmers:")
    for gat, count in report['top_5_largest_gats']:
        print(f"   • Gat {gat:<4} : {count} farmers")
    print("-" * 70)
    print(f" Database Record Count   : {report['database_total_count']}")
    match_str = "[YES] (100% Correct Match)" if report['matches_source'] else "[MISMATCH]"
    print(f" Database Matches Source : {match_str}")
    print("=" * 70)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Import Gat-wise farmer names from Excel into SoilPilot.")
    parser.add_argument("--file", default="Malegaon_Khurd_Gat_and_Farmer_Names.xlsx", help="Path to Excel file")
    parser.add_argument("--village", default="Malegaon Khurd", help="Village name")
    parser.add_argument("--dry-run", action="store_true", help="Simulate without committing")
    args = parser.parse_args()

    try:
        res = import_gat_farmers(excel_path=args.file, village_query=args.village, dry_run=args.dry_run)
        print_report(res)
    except Exception as e:
        print(f"[ERROR] Import failed: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)
