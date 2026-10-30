import sys
sys.stdout.reconfigure(encoding='utf-8')
sys.path.insert(0, 'backend')

from app.gis.gat_soil_extractor import gat_soil_extractor
from app.gis.weather_processor import weather_processor
from app.gis.crop_suitability_engine import crop_suitability_engine

soil = gat_soil_extractor.get_soil_indicators_for_gat('1')
wn = weather_processor.compute_climatological_normals()['historical_30yr']
weather = {
    'annual_rainfall': wn['annual_rainfall_mm'],
    'kharif_rainfall': wn['kharif_rainfall_mm'],
    'rabi_rainfall': wn['rabi_rainfall_mm'],
    'mean_temperature': wn['mean_temperature_c'],
    'relative_humidity': wn['relative_humidity_pct'],
}

for crop_code in ['sugarcane', 'tomato', 'chickpea']:
    res = crop_suitability_engine.evaluate_crop_suitability(crop_code, soil, weather, gat_no='1')
    print('======================================================================')
    print(f"MANUAL VERIFICATION: CROP = {res['crop_name']} ({res['crop_name_mr']}) on GAT 1")
    print(f"Tolerance: {res['tolerance']}")
    print("Criteria Breakdown:")
    for c in res['evaluated_criteria']:
        print(f"  • {c['parameter_name']}: Value = {c['value']} {c['unit']}, Weight = {c['weight']}%, Class = {c['suitability_class']}, Score = {c['score']}")
        print(f"    -> {c['explanation']}")
    print(f"Final Class (Liebig Minimum): {res['final_suitability_class']}")
    print(f"Suitability Weighted Score: {res['suitability_score']} / 100%")
    lims = [f"{lf['parameter']} ({lf['class']})" for lf in res['limiting_factors']]
    print(f"Limiting Factors: {lims}")
