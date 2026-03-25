from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
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


# ------------------ RECOMMENDATION ENGINE ------------------

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


# ------------------ ROOT ------------------

@app.get("/")
def root():
    return {"message": "Backend is working"}


# ------------------ PIPELINES ------------------

@app.get("/pipelines")
def get_pipelines(limit: int = 100):
    response = supabase.table("pipelines").select("*").limit(limit).execute()
    return response.data


@app.get("/pipelines/{pipeline_id}")
def get_pipeline(pipeline_id: str):
    response = (
        supabase
        .table("pipelines")
        .select("*")
        .eq("pipeline_id", pipeline_id)
        .execute()
    )

    if response.data:
        return response.data[0]

    return {"error": "Pipeline not found"}


# ------------------ LIVE RAIN ------------------

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
        rain_mm = float(current.get("rain", 0) or 0)
        precipitation_mm = float(current.get("precipitation", 0) or 0)
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


# ------------------ PREDICT SINGLE ------------------

@app.get("/predict/{pipeline_id}")
def predict_pipeline(pipeline_id: str):
    response = (
        supabase
        .table("pipelines")
        .select("*")
        .eq("pipeline_id", pipeline_id)
        .execute()
    )

    if not response.data:
        return {"error": "Pipeline not found"}

    pipeline = response.data[0]
    risk = calculate_risk(pipeline)

    # live rain
    rain_data = get_live_rain()
    rain_mm = rain_data.get("rain_mm", 0)

    recommendation = get_recommendation(
        risk["risk_level"],
        risk["risk_score"],
        pipeline.get("previous_leak_count", 0),
        rain_mm
    )

    return {
        "pipeline_id": pipeline_id,
        "risk_score": risk["risk_score"],
        "risk_level": risk["risk_level"],
        "recommendation": recommendation,
    }


# ------------------ PIPELINES WITH RISK ------------------

@app.get("/pipelines-with-risk")
def get_pipelines_with_risk(limit: int = 100):
    response = supabase.table("pipelines").select("*").limit(limit).execute()
    pipelines = response.data or []

    rain_data = get_live_rain()
    rain_mm = rain_data.get("rain_mm", 0)

    results = []

    for pipeline in pipelines:
        risk = calculate_risk(pipeline)

        recommendation = get_recommendation(
            risk["risk_level"],
            risk["risk_score"],
            pipeline.get("previous_leak_count", 0),
            rain_mm
        )

        results.append({
            **pipeline,
            "risk_score": risk["risk_score"],
            "risk_level": risk["risk_level"],
            "recommendation": recommendation,
        })

    return results


# ------------------ DIRECT RECOMMENDATION API ------------------

@app.get("/recommendation")
def recommendation_api(
    risk_level: str,
    risk_score: float = 0,
    leaks: int = 0,
    rain_mm: float = 0
):
    return get_recommendation(risk_level, risk_score, leaks, rain_mm)