from datetime import datetime
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from backend.db import supabase
from backend.risk_engine import calculate_risk
import requests

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

KALUTARA_LAT = 6.5854
KALUTARA_LON = 79.9607


class PipelineCreate(BaseModel):
    pipeline_id: str = Field(..., min_length=3)
    area_name: str = Field(..., min_length=2)
    ds_division: str = Field(..., min_length=2)
    material_type: str = Field(..., min_length=2)
    diameter_mm: int = Field(..., gt=0)
    pipe_length_m: int = Field(..., gt=0)
    install_year: int = Field(..., ge=1950, le=2100)
    annual_rainfall_mm: int = Field(..., ge=0)
    previous_leak_count: int = Field(0, ge=0)
    previous_repair_count: int = Field(0, ge=0)
    last_maintenance_year: int | None = Field(None, ge=1950, le=2100)


def normalize_pipeline_payload(payload: PipelineCreate) -> dict:
    current_year = datetime.now().year
    data = payload.model_dump()

    data["pipeline_id"] = data["pipeline_id"].strip().upper()
    data["area_name"] = data["area_name"].strip()
    data["ds_division"] = data["ds_division"].strip()
    data["material_type"] = data["material_type"].strip()

    if data["last_maintenance_year"] is None:
        default_year = max(data["install_year"], current_year - 1)
        data["last_maintenance_year"] = min(default_year, current_year)

    return data


def convert_rain_to_score(rain_mm: float) -> float:
    if rain_mm <= 0:
        return 0.0
    if rain_mm <= 2:
        return 0.2
    if rain_mm <= 5:
        return 0.5
    if rain_mm <= 10:
        return 0.8
    return 1.0


def get_recommendation(risk_level, risk_score=0, leaks=0, rain_mm=0):
    risk_level = (risk_level or "").strip()

    if risk_level == "High":
        action = "Immediate maintenance"
        priority = "Critical"
        message = "Urgent attention required due to high risk level."
    elif risk_level == "Medium":
        action = "Schedule inspection"
        priority = "Moderate"
        message = "Inspection recommended soon."
    else:
        action = "Routine monitoring"
        priority = "Low"
        message = "System is stable under normal conditions."

    reasons = []

    if float(risk_score or 0) >= 0.7:
        reasons.append("High risk score detected")
    elif float(risk_score or 0) >= 0.4:
        reasons.append("Moderate risk score")

    if int(leaks or 0) >= 2:
        reasons.append("Multiple past leaks")
    elif int(leaks or 0) == 1:
        reasons.append("Leak history exists")

    if float(rain_mm or 0) > 5:
        reasons.append("Heavy rainfall may increase stress")

    if not reasons:
        reasons.append("No major risk factors")

    return {
        "action": action,
        "priority": priority,
        "message": message,
        "reasons": reasons,
    }


def classify_risk_level(score: float) -> str:
    if score >= 0.7:
        return "High"
    if score >= 0.4:
        return "Medium"
    return "Low"


def safe_float(value, default=0.0) -> float:
    try:
        if value is None:
            return default
        return float(value)
    except (TypeError, ValueError):
        return default


def safe_int(value, default=0) -> int:
    try:
        if value is None:
            return default
        return int(value)
    except (TypeError, ValueError):
        return default


def fetch_live_rain_mm() -> float:
    url = (
        f"https://api.open-meteo.com/v1/forecast"
        f"?latitude={KALUTARA_LAT}"
        f"&longitude={KALUTARA_LON}"
        f"&current=rain,precipitation"
    )

    try:
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        data = response.json()
        current = data.get("current", {})
        return safe_float(current.get("rain", 0), 0.0)
    except requests.RequestException:
        return 0.0


# ------------------ GEOLOCATION ENGINE ------------------

AREA_COORDS = {
    "Panadura Town": (6.7132, 79.9070),
    "Payagala Link": (6.5480, 79.9730),
    "Bulathsinhala Town": (6.7260, 80.0160),
    "Agalawatta Link": (6.5410, 80.1570),
    "Kalutara South": (6.5680, 79.9600),
    "Diyagama": (6.5140, 80.1160),
    "Kalutara North": (6.6000, 79.9680),
    "Aluthgama": (6.4340, 79.9950),
    "Walana": (6.6590, 79.9300),
    "Halwatura": (6.7450, 80.0620),
    "Molkawa": (6.6190, 80.1290),
    "Waskaduwa": (6.6310, 79.9550),
    "Pinwatta": (6.6530, 79.9480),
    "Millewa": (6.6610, 80.0730),
    "Yatadolawatta": (6.6890, 80.1040),
    "Moragahahena": (6.7170, 80.1000),
    "Millaniya Link": (6.6700, 80.0300),
    "Thebuwana": (6.5980, 80.1150),
    "Wewita": (6.7230, 79.9900),
    "Moragalla": (6.4780, 79.9840),
    "Bombuwala": (6.5880, 79.9940),
    "Galpatha": (6.5940, 80.0410),
    "Pokunuwita": (6.7890, 80.0930),
    "Horana Town": (6.7159, 80.0626),
    "Bandaragama Town": (6.7150, 79.9870),
    "Millaniya Link": (6.6610, 80.0320),
    "Nagoda": (6.5520, 79.9800),
    "Rajgama": (6.7040, 80.0100),
    "Agalawatta Town": (6.5400, 80.1550),
    "Kalutara South Link": (6.5670, 79.9620),
    "Aluthgama Inland": (6.4500, 80.0100),
}

DIVISION_COORDS = {
    "Panadura": (6.7100, 79.9100),
    "Dodangoda": (6.5640, 80.0100),
    "Bulathsinhala": (6.7220, 80.0180),
    "Matugama": (6.5210, 80.1140),
    "Kalutara": (6.5854, 79.9607),
    "Agalawatta": (6.5400, 80.1550),
    "Beruwala": (6.4788, 79.9828),
    "Horana": (6.7159, 80.0626),
    "Bandaragama": (6.7150, 79.9870),
}


def deterministic_unit(seed_text: str) -> float:
    seed_value = sum(ord(c) for c in seed_text)
    return (seed_value % 1000) / 1000.0


def get_base_coordinate(pipeline: dict) -> tuple[float, float]:
    area_name = str(pipeline.get("area_name", "") or "").strip()
    ds_division = str(pipeline.get("ds_division", "") or "").strip()

    if area_name in AREA_COORDS:
        return AREA_COORDS[area_name]
    if ds_division in DIVISION_COORDS:
        return DIVISION_COORDS[ds_division]

    return KALUTARA_LAT, KALUTARA_LON


def assign_pipeline_coordinates(pipeline: dict) -> dict:
    base_lat, base_lng = get_base_coordinate(pipeline)

    pipeline_id = str(pipeline.get("pipeline_id", "") or "")
    material = str(pipeline.get("material_type", "") or "")
    length = max(safe_int(pipeline.get("pipe_length_m", 0), 0), 1)
    install_year = safe_int(pipeline.get("install_year", datetime.now().year), datetime.now().year)

    seed_core = f"{pipeline_id}-{material}-{length}-{install_year}"

    # deterministic offsets around the area/division center
    lat_seed_1 = deterministic_unit(seed_core + "-lat1")
    lng_seed_1 = deterministic_unit(seed_core + "-lng1")
    lat_seed_2 = deterministic_unit(seed_core + "-lat2")
    lng_seed_2 = deterministic_unit(seed_core + "-lng2")

    # smaller pipelines = smaller visible span, longer pipelines = slightly larger span
    span = min(max(length / 12000.0, 0.0035), 0.018)

    start_lat = base_lat + ((lat_seed_1 - 0.5) * span)
    start_lng = base_lng + ((lng_seed_1 - 0.5) * span)
    end_lat = base_lat + ((lat_seed_2 - 0.5) * span)
    end_lng = base_lng + ((lng_seed_2 - 0.5) * span)

    # avoid near-zero identical line segments
    if abs(start_lat - end_lat) < 0.0008 and abs(start_lng - end_lng) < 0.0008:
        end_lat += 0.0015
        end_lng -= 0.0012

    return {
        "start_lat": round(start_lat, 6),
        "start_lng": round(start_lng, 6),
        "end_lat": round(end_lat, 6),
        "end_lng": round(end_lng, 6),
    }


def compute_future_metrics(pipeline: dict, base_score: float) -> dict:
    leaks = safe_int(pipeline.get("previous_leak_count", 0), 0)
    repairs = safe_int(pipeline.get("previous_repair_count", 0), 0)
    current_year = datetime.now().year
    maintenance_year = safe_int(
        pipeline.get("last_maintenance_year", current_year),
        current_year,
    )

    maintenance_gap = max(current_year - maintenance_year, 0)
    leak_pressure_bonus = min((leaks * 0.015) + (repairs * 0.008), 0.18)
    maintenance_bonus = min(maintenance_gap * 0.01, 0.12)

    risk_30 = min(base_score + 0.04 + leak_pressure_bonus + maintenance_bonus, 1.0)
    risk_90 = min(base_score + 0.10 + leak_pressure_bonus + maintenance_bonus, 1.0)

    if risk_30 > base_score + 0.02:
        trend = "Increasing"
    elif risk_30 < base_score - 0.02:
        trend = "Decreasing"
    else:
        trend = "Stable"

    if base_score >= 0.85:
        estimated_life_months = 3
    elif base_score >= 0.7:
        estimated_life_months = 6
    elif base_score >= 0.5:
        estimated_life_months = 12
    else:
        estimated_life_months = 24

    return {
        "failure_probability": round(base_score * 100),
        "risk_30_day": round(risk_30, 3),
        "risk_90_day": round(risk_90, 3),
        "risk_trend": trend,
        "estimated_life_months": estimated_life_months,
    }


def compute_weakest_segment(pipeline: dict, base_score: float) -> dict:
    length = max(safe_int(pipeline.get("pipe_length_m", 0), 0), 1)
    leaks = safe_int(pipeline.get("previous_leak_count", 0), 0)
    repairs = safe_int(pipeline.get("previous_repair_count", 0), 0)
    install_year = safe_int(
        pipeline.get("install_year", datetime.now().year),
        datetime.now().year,
    )
    material = str(pipeline.get("material_type", "") or "").strip().upper()
    pressure_variation = str(pipeline.get("pressure_variation", "") or "").strip().lower()
    rainfall = safe_float(pipeline.get("annual_rainfall_mm", 0), 0.0)

    segment_count = 5
    segment_length = max(length // segment_count, 1)

    seed_text = f"{pipeline.get('pipeline_id', '')}-{install_year}-{material}-{leaks}-{repairs}-{length}"
    seed_value = sum(ord(c) for c in seed_text)

    hotspot_index = seed_value % segment_count

    material_bonus = {
        "CI": 0.10,
        "DI": 0.08,
        "STEEL": 0.06,
        "UPVC": 0.04,
        "HDPE": 0.03,
    }.get(material, 0.05)

    variation_bonus = 0.0
    if pressure_variation == "high":
        variation_bonus = 0.10
    elif pressure_variation == "medium":
        variation_bonus = 0.05

    rainfall_bonus = min(rainfall / 10000, 0.08)
    leak_bonus = min(leaks * 0.025, 0.15)
    repair_bonus = min(repairs * 0.015, 0.08)
    age_bonus = min((datetime.now().year - install_year) / 100, 0.10)

    best_risk = -1.0
    best_start = 0
    best_end = segment_length

    for i in range(segment_count):
        start = i * segment_length
        end = length if i == segment_count - 1 else min((i + 1) * segment_length, length)

        distance_from_hotspot = abs(i - hotspot_index)
        hotspot_bonus = max(0.0, 0.12 - (distance_from_hotspot * 0.04))

        segment_variation = ((seed_value + i * 17) % 9) / 100.0

        segment_risk = min(
            base_score
            + hotspot_bonus
            + segment_variation
            + material_bonus
            + variation_bonus
            + rainfall_bonus
            + leak_bonus
            + repair_bonus
            + age_bonus,
            1.0,
        )

        if segment_risk > best_risk:
            best_risk = segment_risk
            best_start = start
            best_end = end

    return {
        "weakest_segment_start_m": best_start,
        "weakest_segment_end_m": best_end,
        "weakest_segment_risk": round(best_risk, 3),
    }


def build_enriched_pipeline(pipeline: dict, rain_mm: float | None = None) -> dict:
    raw_risk = calculate_risk(pipeline)

    if isinstance(raw_risk, dict):
        base_score = safe_float(raw_risk.get("risk_score", 0), 0.0)
        risk_level = raw_risk.get("risk_level") or classify_risk_level(base_score)
    else:
        base_score = safe_float(raw_risk, 0.0)
        risk_level = classify_risk_level(base_score)

    future_metrics = compute_future_metrics(pipeline, base_score)
    weakest_segment = compute_weakest_segment(pipeline, base_score)
    coordinates = assign_pipeline_coordinates(pipeline)

    if rain_mm is None:
        rain_mm = 0.0

    recommendation = get_recommendation(
        risk_level,
        base_score,
        pipeline.get("previous_leak_count", 0),
        rain_mm,
    )

    derived_fields = {
        "risk_score": round(base_score, 3),
        "failure_probability": future_metrics["failure_probability"],
        "risk_30_day": future_metrics["risk_30_day"],
        "risk_90_day": future_metrics["risk_90_day"],
        "risk_trend": future_metrics["risk_trend"],
        "estimated_life_months": future_metrics["estimated_life_months"],
        "weakest_segment_start_m": weakest_segment["weakest_segment_start_m"],
        "weakest_segment_end_m": weakest_segment["weakest_segment_end_m"],
        "weakest_segment_risk": weakest_segment["weakest_segment_risk"],
        "start_lat": coordinates["start_lat"],
        "start_lng": coordinates["start_lng"],
        "end_lat": coordinates["end_lat"],
        "end_lng": coordinates["end_lng"],
    }

    return {
        **pipeline,
        **derived_fields,
        "risk_level": risk_level,
        "recommendation": recommendation,
    }


def save_derived_fields(pipeline_id: str, enriched: dict) -> None:
    update_payload = {
        "risk_score": enriched["risk_score"],
        "failure_probability": enriched["failure_probability"],
        "risk_30_day": enriched["risk_30_day"],
        "risk_90_day": enriched["risk_90_day"],
        "risk_trend": enriched["risk_trend"],
        "estimated_life_months": enriched["estimated_life_months"],
        "weakest_segment_start_m": enriched["weakest_segment_start_m"],
        "weakest_segment_end_m": enriched["weakest_segment_end_m"],
        "weakest_segment_risk": enriched["weakest_segment_risk"],
        "start_lat": enriched["start_lat"],
        "start_lng": enriched["start_lng"],
        "end_lat": enriched["end_lat"],
        "end_lng": enriched["end_lng"],
    }

    supabase.table("pipelines").update(update_payload).eq("pipeline_id", pipeline_id).execute()


@app.get("/")
def root():
    return {"message": "Backend is working"}


@app.get("/pipelines")
def get_pipelines(limit: int = Query(default=100, ge=1, le=5000), persist: bool = False):
    response = supabase.table("pipelines").select("*").limit(limit).execute()
    pipelines = response.data or []

    rain_mm = fetch_live_rain_mm()
    results = []

    for pipeline in pipelines:
        enriched = build_enriched_pipeline(pipeline, rain_mm=rain_mm)
        if persist:
            save_derived_fields(pipeline["pipeline_id"], enriched)
        results.append(enriched)

    return results


@app.get("/pipelines/{pipeline_id}")
def get_pipeline(pipeline_id: str, persist: bool = False):
    response = (
        supabase
        .table("pipelines")
        .select("*")
        .eq("pipeline_id", pipeline_id)
        .execute()
    )

    if not response.data:
        raise HTTPException(status_code=404, detail="Pipeline not found")

    rain_mm = fetch_live_rain_mm()
    enriched = build_enriched_pipeline(response.data[0], rain_mm=rain_mm)

    if persist:
        save_derived_fields(pipeline_id, enriched)

    return enriched


@app.post("/pipelines")
def create_pipeline(payload: PipelineCreate):
    data = normalize_pipeline_payload(payload)

    existing = (
        supabase
        .table("pipelines")
        .select("pipeline_id")
        .eq("pipeline_id", data["pipeline_id"])
        .execute()
    )

    if existing.data:
        raise HTTPException(status_code=409, detail="Pipeline ID already exists")

    insert_response = supabase.table("pipelines").insert(data).execute()

    if not insert_response.data:
        raise HTTPException(status_code=500, detail="Failed to create pipeline")

    created = insert_response.data[0]

    rain_mm = fetch_live_rain_mm()
    enriched = build_enriched_pipeline(created, rain_mm=rain_mm)
    save_derived_fields(created["pipeline_id"], enriched)

    return enriched


@app.get("/live-rain")
def get_live_rain():
    url = (
        f"https://api.open-meteo.com/v1/forecast"
        f"?latitude={KALUTARA_LAT}"
        f"&longitude={KALUTARA_LON}"
        f"&current=rain,precipitation"
    )

    try:
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        data = response.json()

        current = data.get("current", {})
        rain_mm = safe_float(current.get("rain", 0), 0.0)
        precipitation_mm = safe_float(current.get("precipitation", 0), 0.0)
        updated_time = current.get("time")

        rain_score = convert_rain_to_score(rain_mm)

        return {
            "district": "Kalutara",
            "latitude": KALUTARA_LAT,
            "longitude": KALUTARA_LON,
            "rain_mm": rain_mm,
            "precipitation_mm": precipitation_mm,
            "rain_score": rain_score,
            "updated_time": updated_time,
        }

    except requests.RequestException as e:
        return {
            "error": "Failed to fetch live rain data",
            "details": str(e),
            "district": "Kalutara",
            "latitude": KALUTARA_LAT,
            "longitude": KALUTARA_LON,
        }


@app.get("/predict/{pipeline_id}")
def predict_pipeline(pipeline_id: str, persist: bool = False):
    response = (
        supabase
        .table("pipelines")
        .select("*")
        .eq("pipeline_id", pipeline_id)
        .execute()
    )

    if not response.data:
        raise HTTPException(status_code=404, detail="Pipeline not found")

    rain_mm = fetch_live_rain_mm()
    enriched = build_enriched_pipeline(response.data[0], rain_mm=rain_mm)

    if persist:
        save_derived_fields(pipeline_id, enriched)

    return {
        "pipeline_id": enriched["pipeline_id"],
        "risk_score": enriched["risk_score"],
        "risk_level": enriched["risk_level"],
        "failure_probability": enriched["failure_probability"],
        "risk_30_day": enriched["risk_30_day"],
        "risk_90_day": enriched["risk_90_day"],
        "risk_trend": enriched["risk_trend"],
        "estimated_life_months": enriched["estimated_life_months"],
        "weakest_segment_start_m": enriched["weakest_segment_start_m"],
        "weakest_segment_end_m": enriched["weakest_segment_end_m"],
        "weakest_segment_risk": enriched["weakest_segment_risk"],
        "start_lat": enriched["start_lat"],
        "start_lng": enriched["start_lng"],
        "end_lat": enriched["end_lat"],
        "end_lng": enriched["end_lng"],
        "recommendation": enriched["recommendation"],
    }


@app.get("/pipelines-with-risk")
def get_pipelines_with_risk(limit: int = Query(default=100, ge=1, le=5000), persist: bool = False):
    response = supabase.table("pipelines").select("*").limit(limit).execute()
    pipelines = response.data or []

    rain_mm = fetch_live_rain_mm()
    results = []

    for pipeline in pipelines:
        enriched = build_enriched_pipeline(pipeline, rain_mm=rain_mm)
        if persist:
            save_derived_fields(pipeline["pipeline_id"], enriched)
        results.append(enriched)

    return results


@app.post("/recalculate-all")
def recalculate_all(limit: int = Query(default=5000, ge=1, le=50000)):
    response = supabase.table("pipelines").select("*").limit(limit).execute()
    pipelines = response.data or []

    if not pipelines:
        return {
            "message": "No pipelines found",
            "updated_count": 0,
        }

    rain_mm = fetch_live_rain_mm()
    updated_count = 0

    for pipeline in pipelines:
        enriched = build_enriched_pipeline(pipeline, rain_mm=rain_mm)
        save_derived_fields(pipeline["pipeline_id"], enriched)
        updated_count += 1

    return {
        "message": "All pipelines recalculated successfully",
        "updated_count": updated_count,
    }


@app.get("/recommendation")
def recommendation_api(
    risk_level: str,
    risk_score: float = 0,
    leaks: int = 0,
    rain_mm: float = 0
):
    return get_recommendation(risk_level, risk_score, leaks, rain_mm)