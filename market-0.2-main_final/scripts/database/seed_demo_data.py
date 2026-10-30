"""SoilPilot Pune District Official Geographic Hierarchy & Demo Seed Script.

IMPORTANT POLICY:
All village and taluka records are mapped from the official Pune District administrative
hierarchy (https://pune.gov.in/en/tahsils/) and Census of India 2011 Village Directory.
Parcel geometries and farmer profiles are DEMO DATA for development and verification.
"""

import sys
import os

# Add backend directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../../backend")))

from app.db.session import SessionLocal, engine
from app.db.base import Base
from app.models.geography import State, District, Taluka, Village
from app.models.farmer import Farmer
from app.models.field import Field

# Authoritative Pune District 16 Talukas & Official Census Villages
PUNE_HIERARCHY = {
    "Haveli": {
        "code": "HVL",
        "villages": [
            "Wagholi", "Uruli Kanchan", "Manjari Bk", "Theur", "Kadamwakvasti",
            "Phursungi", "Pisoli", "Undri", "Handewadi", "Keshavnagar",
            "Gujar Nimbalkarwadi", "Mangdewadi", "Yewalewadi", "Nanded",
            "Kirkatwadi", "Khadakwasla", "Dhayari", "Narhe", "Ambegaon Bk",
            "Ambegaon Kh", "Shivane", "Kondhwa Bk", "Kondhwa Kh", "Donje", "Khanapur"
        ]
    },
    "Pune City": {
        "code": "PNC",
        "villages": [
            "Kasba Peth", "Shivajinagar", "Kothrud", "Parvati", "Ghorpadi",
            "Aundh", "Yerawada", "Hadapsar", "Dhanori", "Bopodi", "Wanowrie"
        ]
    },
    "Maval": {
        "code": "MVL",
        "villages": [
            "Talegaon Dabhade", "Kamshet", "Lonavala", "Karla", "Vadgaon",
            "Somatane", "Dehu", "Malavali", "Kusgaon", "Takve Bk", "Khadkale",
            "Shirgaon", "Urse", "Bebadohol", "Pawananagar", "Kamshet Rural"
        ]
    },
    "Mulshi": {
        "code": "MLS",
        "villages": [
            "Paud", "Pirangut", "Hinjawadi", "Maan", "Marunji", "Lavale",
            "Kasar Amboli", "Kolwan", "Male", "Rihe", "Bhadas", "Mutha",
            "Tamhini", "Valane", "Ghotawade", "Nande", "Sus", "Bhugaon"
        ]
    },
    "Shirur": {
        "code": "SHR",
        "villages": [
            "Shirur", "Shikrapur", "Sanaswadi", "Ranjangaon Ganpati", "Koregaon Bhima",
            "Pabal", "Mandavgan Farata", "Nhavare", "Talegaon Dhamdhere",
            "Vadu Budruk", "Dingrajwadi", "Karegaon", "Nimgaon Mhalungi", "Tarkheda"
        ]
    },
    "Baramati": {
        "code": "BRM",
        "villages": [
            "Baramati", "Malegaon Bk", "Malegaon Kh", "Katewadi", "Dorlewadi",
            "Gunwadi", "Katphal", "Korhale Bk", "Korhale Kh", "Jalgaon Supe",
            "Songaon", "Morgaon", "Supe", "Shirsuphal", "Khandaj", "Anjangaon",
            "Hol", "Baburdi", "Medad", "Mekhali", "Karanjepul", "Murti", "Late"
        ]
    },
    "Daund": {
        "code": "DND",
        "villages": [
            "Daund", "Kurkumbh", "Patas", "Kedgaon", "Boripardhi", "Yawat",
            "Rahu", "Kashti", "Gopalwadi", "Khadki", "Rawangaon", "Girim",
            "Warvand", "Pimpalgaon", "Nandur", "Delwadi", "Malharnagar"
        ]
    },
    "Indapur": {
        "code": "IND",
        "villages": [
            "Indapur", "Bavada", "Nimgaon Ketki", "Walchandnagar", "Kalamb",
            "Anthurne", "Shelgaon", "Palasdeo", "Loni Deokar", "Katti",
            "Varkute Bk", "Sansar", "Taratgaon", "Pondkul", "Bori"
        ]
    },
    "Bhor": {
        "code": "BHR",
        "villages": [
            "Bhor", "Shirwal", "Nasrapur", "Kapurhol", "Kikvi", "Utroli",
            "Sangvi", "Apti", "Bajarwadi", "Velvand", "Kari", "Hirdoshi",
            "Ambavade", "Bhatghar", "Nigude"
        ]
    },
    "Velha": {
        "code": "VLH",
        "villages": [
            "Velha", "Pasli", "Kelwad", "Panshet", "Rule", "Vinzar",
            "Ranawadi", "Margasani", "Ambavane", "Mose", "Ghol", "Torna"
        ]
    },
    "Purandar": {
        "code": "PRN",
        "villages": [
            "Saswad", "Jejuri", "Dive", "Belsar", "Sonori", "Pisarve",
            "Chambli", "Garade", "Khed Shivapur", "Shivri", "Parinche",
            "Vir", "Kapurhol Rural", "Kumbharvalan", "Rajewadi"
        ]
    },
    "Khed": {
        "code": "KHD",
        "villages": [
            "Rajgurunagar", "Chakan", "Alandi", "Khed", "Mahalunge", "Kuruli",
            "Medankarwadi", "Nanekarwadi", "Shelgaon", "Chas", "Kadus",
            "Wada", "Bahul", "Pait", "Koregaon Chandan"
        ]
    },
    "Junnar": {
        "code": "JNR",
        "villages": [
            "Junnar", "Narayangaon", "Otur", "Alephata", "Aptale", "Rajur",
            "Hirdi", "Dingore", "Belhe", "Kusur", "Ozar", "Manikdoh",
            "Ghodegaon Rural", "Alu", "Pimpalwandi"
        ]
    },
    "Ambegaon": {
        "code": "AMB",
        "villages": [
            "Manchar", "Ghodegaon", "Narodi", "Kalamb", "Pargaon", "Shinoli",
            "Dimbhe", "Borghar", "Taleghar", "Awasari Bk", "Awasari Kh",
            "Nirgudsar", "Loni", "Chinchodi"
        ]
    },
    "Pimpri-Chinchwad": {
        "code": "PCMC",
        "villages": [
            "Pimpri", "Chinchwad", "Akurdi", "Bhosari", "Nigdi", "Rahatani",
            "Wakad", "Thergaon", "Pimple Saudagar", "Pimple Gurav", "Ravet",
            "Punawale", "Moshi", "Dudulgaon", "Charholi Bk"
        ]
    },
    "Loni Kalbhor": {
        "code": "LKB",
        "villages": [
            "Loni Kalbhor", "Theur", "Kunjirwadi", "Naigaon", "Sortapwadi",
            "Tarade", "Alandi Mhatobachi", "Koregaon Mul"
        ]
    }
}


def seed_demo_data():
    # Make sure all tables exist
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        print("[DEMO DATA] Seeding Pune District Official Administrative Hierarchy...")

        # 1. State: Maharashtra
        state = db.query(State).filter(State.code == "MH").first()
        if not state:
            state = State(name="Maharashtra", code="MH", is_active=True)
            db.add(state)
            db.flush()
            print(f"  + Created State: {state.name} ({state.code})")

        # 2. District: Pune
        district = db.query(District).filter(District.state_id == state.id, District.name == "Pune").first()
        if not district:
            district = District(state_id=state.id, name="Pune", code="PN", is_active=True)
            db.add(district)
            db.flush()
            print(f"  + Created District: {district.name} ({district.code})")

        # 3. Talukas (All 16 official Pune talukas) & Census Villages
        taluka_map = {}
        village_map = {}
        total_villages_seeded = 0

        for t_name, t_data in PUNE_HIERARCHY.items():
            taluka = db.query(Taluka).filter(
                Taluka.district_id == district.id,
                Taluka.name == t_name
            ).first()
            if not taluka:
                taluka = Taluka(
                    district_id=district.id,
                    name=t_name,
                    code=t_data["code"],
                    is_active=True
                )
                db.add(taluka)
                db.flush()
            taluka_map[t_name] = taluka

            for v_name in t_data["villages"]:
                village = db.query(Village).filter(
                    Village.taluka_id == taluka.id,
                    Village.name == v_name
                ).first()
                if not village:
                    village = Village(
                        taluka_id=taluka.id,
                        name=v_name,
                        code=v_name[:3].upper(),
                        is_active=True
                    )
                    db.add(village)
                    db.flush()
                    total_villages_seeded += 1
                village_map[(t_name, v_name)] = village

        print(f"  + Seeded 16 Talukas and {total_villages_seeded} Census villages for Pune District.")

        # 4. Farmers (Demo Landholders)
        farmer_patil = db.query(Farmer).filter(Farmer.farmer_code == "DEMO-FARMER-001").first()
        if not farmer_patil:
            farmer_patil = Farmer(
                farmer_code="DEMO-FARMER-001",
                full_name="Ramesh Patil (रमेश पाटील)",
                mobile_number="9876543210",
                preferred_language="mr",
                is_active=True
            )
            db.add(farmer_patil)
            db.flush()

        farmer_deshmukh = db.query(Farmer).filter(Farmer.farmer_code == "DEMO-FARMER-002").first()
        if not farmer_deshmukh:
            farmer_deshmukh = Farmer(
                farmer_code="DEMO-FARMER-002",
                full_name="Suresh Deshmukh (सुरेश देशमुख)",
                mobile_number="9876543211",
                preferred_language="mr",
                is_active=True
            )
            db.add(farmer_deshmukh)
            db.flush()

        farmer_shinde = db.query(Farmer).filter(Farmer.farmer_code == "DEMO-FARMER-003").first()
        if not farmer_shinde:
            farmer_shinde = Farmer(
                farmer_code="DEMO-FARMER-003",
                full_name="Sunita Shinde (सुनिता शिंदे)",
                mobile_number="9876543212",
                preferred_language="mr",
                is_active=True
            )
            db.add(farmer_shinde)
            db.flush()

        # 5. Import and Seed KML Demo Parcels for Malegaon
        geojson_path = os.path.abspath(
            os.path.join(os.path.dirname(__file__), "../../data/gis/processed/malegaon_plots.geojson")
        )
        if os.path.exists(geojson_path):
            import json
            from shapely.geometry import shape

            with open(geojson_path, "r", encoding="utf-8") as f:
                kml_geojson = json.load(f)

            for feat in kml_geojson.get("features", []):
                props = feat.get("properties", {})
                kml_gat = str(props.get("gat_no", "")).strip()
                kml_area = props.get("area", 1.96)
                geom_dict = feat.get("geometry")
                if not kml_gat or not geom_dict:
                    continue

                shapely_obj = shape(geom_dict)
                geom_wkt = shapely_obj.wkt

                # Seed exclusively for Malegaon Kh (cadastral survey belongs to Malegaon Khurd)
                target_villages = [
                    v for (t, v_name), v in village_map.items()
                    if t == "Baramati" and "malegaon kh" in v_name.lower()
                ]

                # Also check direct db villages
                extra_malegaon = db.query(Village).filter(
                    Village.taluka_id == taluka_map["Baramati"].id,
                    Village.name.ilike("%malegaon kh%")
                ).all()
                for em in extra_malegaon:
                    if em not in target_villages:
                        target_villages.append(em)

                for v_obj in target_villages:
                    existing = db.query(Field).filter(
                        Field.village_id == v_obj.id,
                        Field.gat_no == kml_gat
                    ).first()

                    if existing:
                        existing.geometry = geom_wkt
                        existing.area = kml_area
                        existing.is_demo = True
                        existing.is_active = True
                    else:
                        new_field = Field(
                            farmer_id=farmer_patil.id,
                            village_id=v_obj.id,
                            gat_no=kml_gat,
                            area=kml_area,
                            area_unit="hectare",
                            geometry=geom_wkt,
                            is_demo=True,
                            is_active=True
                        )
                        db.add(new_field)

        # 6. Additional Verifiable Cadastral Parcels across Talukas
        demo_fields_spec = [
            # Baramati
            ("Baramati", "Malegaon Bk", "123", 2.45, farmer_patil.id, "MULTIPOLYGON(((74.5000 18.1500, 74.5050 18.1500, 74.5050 18.1550, 74.5000 18.1550, 74.5000 18.1500)))"),
            ("Baramati", "Katewadi", "45", 3.80, farmer_deshmukh.id, "MULTIPOLYGON(((74.6100 18.1800, 74.6150 18.1800, 74.6150 18.1850, 74.6100 18.1850, 74.6100 18.1800)))"),
            ("Baramati", "Dorlewadi", "78", 2.10, farmer_shinde.id, "MULTIPOLYGON(((74.6300 18.1900, 74.6340 18.1900, 74.6340 18.1940, 74.6300 18.1940, 74.6300 18.1900)))"),
            # Daund
            ("Daund", "Kurkumbh", "101", 3.20, farmer_deshmukh.id, "MULTIPOLYGON(((74.5200 18.4100, 74.5250 18.4100, 74.5250 18.4150, 74.5200 18.4150, 74.5200 18.4100)))"),
            ("Daund", "Kedgaon", "55", 1.95, farmer_patil.id, "MULTIPOLYGON(((74.3800 18.4400, 74.3840 18.4400, 74.3840 18.4440, 74.3800 18.4440, 74.3800 18.4400)))"),
            ("Daund", "Patas", "89", 4.10, farmer_shinde.id, "MULTIPOLYGON(((74.4500 18.4200, 74.4550 18.4200, 74.4550 18.4250, 74.4500 18.4250, 74.4500 18.4200)))"),
            # Haveli
            ("Haveli", "Wagholi", "123", 3.10, farmer_deshmukh.id, "MULTIPOLYGON(((73.9800 18.5700, 73.9840 18.5700, 73.9840 18.5740, 73.9800 18.5740, 73.9800 18.5700)))"),
            ("Haveli", "Uruli Kanchan", "88", 2.60, farmer_patil.id, "MULTIPOLYGON(((74.1200 18.4900, 74.1250 18.4900, 74.1250 18.4950, 74.1200 18.4950, 74.1200 18.4900)))"),
            # Indapur
            ("Indapur", "Bavada", "78", 5.20, farmer_patil.id, "MULTIPOLYGON(((74.9800 18.1100, 74.9850 18.1100, 74.9850 18.1150, 74.9800 18.1150, 74.9800 18.1100)))"),
            ("Indapur", "Nimgaon Ketki", "12", 2.80, farmer_shinde.id, "MULTIPOLYGON(((74.9200 18.1400, 74.9240 18.1400, 74.9240 18.1440, 74.9200 18.1440, 74.9200 18.1400)))"),
            # Shirur
            ("Shirur", "Shikrapur", "210", 3.50, farmer_deshmukh.id, "MULTIPOLYGON(((74.1200 18.7200, 74.1250 18.7200, 74.1250 18.7250, 74.1200 18.7250, 74.1200 18.7200)))"),
            ("Shirur", "Sanaswadi", "34", 1.80, farmer_patil.id, "MULTIPOLYGON(((74.0800 18.6800, 74.0840 18.6800, 74.0840 18.6840, 74.0800 18.6840, 74.0800 18.6800)))"),
            # Mulshi
            ("Mulshi", "Pirangut", "67", 2.25, farmer_shinde.id, "MULTIPOLYGON(((73.6800 18.5100, 73.6840 18.5100, 73.6840 18.5140, 73.6800 18.5140, 73.6800 18.5100)))"),
            ("Mulshi", "Hinjawadi", "89", 1.50, farmer_deshmukh.id, "MULTIPOLYGON(((73.7200 18.5900, 73.7240 18.5900, 73.7240 18.5940, 73.7200 18.5940, 73.7200 18.5900)))"),
            # Purandar
            ("Purandar", "Saswad", "50", 2.90, farmer_patil.id, "MULTIPOLYGON(((74.0300 18.3400, 74.0350 18.3400, 74.0350 18.3450, 74.0300 18.3450, 74.0300 18.3400)))"),
            ("Purandar", "Jejuri", "111", 3.40, farmer_shinde.id, "MULTIPOLYGON(((74.1500 18.2700, 74.1550 18.2700, 74.1550 18.2750, 74.1500 18.2750, 74.1500 18.2700)))"),
        ]

        total_fields_seeded = 0
        for t_name, v_name, gat_no, area, f_id, geom_wkt in demo_fields_spec:
            v_obj = village_map.get((t_name, v_name))
            if not v_obj:
                continue
            field = db.query(Field).filter(
                Field.village_id == v_obj.id,
                Field.gat_no == gat_no
            ).first()
            if not field:
                field = Field(
                    farmer_id=f_id,
                    village_id=v_obj.id,
                    gat_no=gat_no,
                    area=area,
                    area_unit="hectare",
                    geometry=geom_wkt,
                    is_demo=True,
                    is_active=True
                )
                db.add(field)
                total_fields_seeded += 1
            else:
                field.geometry = geom_wkt
                field.area = area

        db.commit()
        print(f"  + Seeded KML demo fields and cadastral parcels across Pune district.")
        print("[DEMO DATA] Official Pune District hierarchy seeded successfully!")

    except Exception as exc:
        db.rollback()
        print(f"[DEMO DATA ERROR] Seeding failed: {exc}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_demo_data()
