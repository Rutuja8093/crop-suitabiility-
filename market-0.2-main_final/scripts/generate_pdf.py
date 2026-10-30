import sys
import os
import argparse
from pathlib import Path

# Add backend directory to path
backend_dir = Path(__file__).resolve().parent.parent / "backend"
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

def main():
    parser = argparse.ArgumentParser(description="SoilPilot Standalone PDF Generator Fallback")
    parser.add_argument("--type", choices=["detailed", "soil-health-card"], default="detailed", help="Report type")
    parser.add_argument("--field", default="104", help="Field identifier or Gat number")
    parser.add_argument("--lang", default="en", help="Language code ('en' or 'mr')")
    parser.add_argument("--farmer-name", default=None, help="Optional farmer name override")
    parser.add_argument("--base-url", default="http://localhost:3000", help="Base URL for QR codes and verification")
    parser.add_argument("--output", default="-", help="Output file path or '-' for stdout")

    args = parser.parse_args()

    from app.services.report_service import report_service
    from app.db.session import SessionLocal

    db = SessionLocal()
    try:
        if args.type == "soil-health-card":
            pdf_bytes, filename = report_service.generate_soil_health_card_pdf(
                db=db,
                field_identifier=args.field,
                lang=args.lang,
                base_url=args.base_url,
                farmer_name=args.farmer_name,
            )
        else:
            pdf_bytes, filename = report_service.generate_detailed_soil_report_pdf(
                db=db,
                field_identifier=args.field,
                lang=args.lang,
                base_url=args.base_url,
                farmer_name=args.farmer_name,
            )

        if args.output == "-" or not args.output:
            sys.stdout.buffer.write(pdf_bytes)
        else:
            out_path = Path(args.output)
            out_path.parent.mkdir(parents=True, exist_ok=True)
            out_path.write_bytes(pdf_bytes)
            # Print filename to stdout for the caller to parse
            print(f"FILENAME:{filename}")
    finally:
        db.close()

if __name__ == "__main__":
    main()
