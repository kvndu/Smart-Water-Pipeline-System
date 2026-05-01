from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from backend.db import supabase
from backend.risk_engine import calculate_risk

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

WATERLOO_LAT = 43.4643
WATERLOO_LON = -80.5204
KITCHENER_LAT = 43.4516
KITCHENER_LON = -80.4925


class PipelineCreate(BaseModel):
    WATMAINID: str | None = None
    STATUS: str | None = None
    PRESSURE_ZONE: str | None = None
    ROADSEGMENTID: str | int | None = None
    MAP_LABEL: str | None = None
    CATEGORY: str | None = None
    PIPE_SIZE: float | None = Field(None, ge=0)
    MATERIAL: str | None = None
    LINED: str | None = None
    CONDITION_SCORE: float | None = Field(None, ge=0)
    CRITICALITY: float | None = Field(None, ge=0)
    Shape__Length: float | None = Field(None, ge=0)


class RepairCompletePayload(BaseModel):
    repair_description: str = Field(..., min_length=3)
    repair_cost: float = Field(..., ge=0)
    condition_after: str = Field("Improved", min_length=2)
    status_after: str = Field("ACTIVE", min_length=2)


def safe_float(value, default=0.0):
    try:
        if value is None or value == "":
            return default
        return float(value)
    except (TypeError, ValueError):
        return default


def safe_int(value, default=0):
    try:
        if value is None or value == "":
            return default
        return int(float(value))
    except (TypeError, ValueError):
        return default


def get_pipeline_identifier(pipeline: dict) -> str:
    return str(
        pipeline.get("pipeline_id")
        or pipeline.get("WATMAINID")
        or pipeline.get("OBJECTID")
        or ""
    )


def get_condition_score(pipeline: dict):
    return (
        pipeline.get("CONDITION_SCORE")
        or pipeline.get("Condition Score")
        or pipeline.get("condition_score")
    )


def normalize_dataset_pipeline(pipeline: dict) -> dict:
    pipeline_id = get_pipeline_identifier(pipeline)

    return {
        **pipeline,
        "pipeline_id": pipeline_id,
        "area_name": (
            pipeline.get("area_name")
            or pipeline.get("MAP_LABEL")
            or pipeline.get("PRESSURE_ZONE")
            or "Waterloo/Kitchener"
        ),
        "ds_division": (
            pipeline.get("ds_division")
            or pipeline.get("PRESSURE_ZONE")
            or "Unknown"
        ),
        "material_type": (
            pipeline.get("material_type")
            or pipeline.get("MATERIAL")
            or "Unknown"
        ),
        "diameter_mm": safe_int(
            pipeline.get("diameter_mm") or pipeline.get("PIPE_SIZE"),
            0,
        ),
        "pipe_length_m": safe_int(
            pipeline.get("pipe_length_m") or pipeline.get("Shape__Length"),
            1,
        ),
        "status": pipeline.get("status") or pipeline.get("STATUS") or "Unknown",
        "condition_score": safe_float(get_condition_score(pipeline), None),
        "criticality": safe_float(pipeline.get("CRITICALITY"), None),
    }


def classify_risk_level(score: float) -> str:
    if score >= 0.7:
        return "High"
    if score >= 0.4:
        return "Medium"
    return "Low"


def get_recommendation(risk_level, risk_score=0, pipeline=None):
    risk_level = (risk_level or "").strip()

    reasons = []

    if pipeline:
        condition_score = pipeline.get("condition_score")
        criticality = pipeline.get("criticality")
        material = pipeline.get("material_type")
        status = pipeline.get("status")

        if condition_score is not None:
            reasons.append(f"Condition score is {condition_score}")

        if criticality is not None:
            reasons.append(f"Criticality value is {criticality}")

        if material and material != "Unknown":
            reasons.append(f"Material type is {material}")

        if status and status != "Unknown":
            reasons.append(f"Current status is {status}")

    if risk_level == "High":
        return {
            "action": "Immediate inspection required",
            "priority": "Critical",
            "message": "This pipeline segment has a high risk level based on condition score or criticality.",
            "reasons": reasons or ["High dataset-based risk detected"],
        }

    if risk_level == "Medium":
        return {
            "action": "Schedule inspection",
            "priority": "Moderate",
            "message": "This pipeline segment should be inspected soon.",
            "reasons": reasons or ["Moderate dataset-based risk detected"],
        }

    return {
        "action": "Routine monitoring",
        "priority": "Low",
        "message": "This pipeline segment is currently low risk.",
        "reasons": reasons or ["No major risk factors detected"],
    }


def deterministic_unit(seed_text: str) -> float:
    seed_value = sum(ord(c) for c in seed_text)
    return (seed_value % 1000) / 1000.0


def get_base_coordinate(pipeline: dict) -> tuple[float, float]:
    label = str(pipeline.get("MAP_LABEL") or pipeline.get("area_name") or "").lower()

    if "waterloo" in label:
        return WATERLOO_LAT, WATERLOO_LON

    if "kitchener" in label:
        return KITCHENER_LAT, KITCHENER_LON

    return KITCHENER_LAT, KITCHENER_LON


def assign_pipeline_coordinates(pipeline: dict) -> dict:
    base_lat, base_lng = get_base_coordinate(pipeline)

    pipeline_id = str(pipeline.get("pipeline_id") or "")
    material = str(pipeline.get("material_type") or "")
    length = max(safe_int(pipeline.get("pipe_length_m"), 1), 1)

    seed_core = f"{pipeline_id}-{material}-{length}"

    lat_seed_1 = deterministic_unit(seed_core + "-lat1")
    lng_seed_1 = deterministic_unit(seed_core + "-lng1")
    lat_seed_2 = deterministic_unit(seed_core + "-lat2")
    lng_seed_2 = deterministic_unit(seed_core + "-lng2")

    span = min(max(length / 15000.0, 0.0025), 0.015)

    start_lat = base_lat + ((lat_seed_1 - 0.5) * span)
    start_lng = base_lng + ((lng_seed_1 - 0.5) * span)
    end_lat = base_lat + ((lat_seed_2 - 0.5) * span)
    end_lng = base_lng + ((lng_seed_2 - 0.5) * span)

    if abs(start_lat - end_lat) < 0.0005 and abs(start_lng - end_lng) < 0.0005:
        end_lat += 0.001
        end_lng -= 0.001

    return {
        "start_lat": round(start_lat, 6),
        "start_lng": round(start_lng, 6),
        "end_lat": round(end_lat, 6),
        "end_lng": round(end_lng, 6),
    }


def compute_future_metrics(base_score: float) -> dict:
    risk_30 = min(base_score + 0.03, 1.0)
    risk_90 = min(base_score + 0.08, 1.0)

    if base_score >= 0.85:
        estimated_life_months = 3
    elif base_score >= 0.55:
        estimated_life_months = 12
    else:
        estimated_life_months = 24

    return {
        "failure_probability": round(base_score * 100),
        "risk_30_day": round(risk_30, 3),
        "risk_90_day": round(risk_90, 3),
        "risk_trend": "Stable",
        "estimated_life_months": estimated_life_months,
    }


def compute_weakest_segment(pipeline: dict, base_score: float) -> dict:
    length = max(safe_int(pipeline.get("pipe_length_m"), 1), 1)

    return {
        "weakest_segment_start_m": 0,
        "weakest_segment_end_m": length,
        "weakest_segment_risk": round(base_score, 3),
    }


def build_enriched_pipeline(pipeline: dict) -> dict:
    pipeline = normalize_dataset_pipeline(pipeline)

    raw_risk = calculate_risk(pipeline)

    if isinstance(raw_risk, dict):
        base_score = safe_float(raw_risk.get("risk_score"), 0.0)
        risk_level = raw_risk.get("risk_level") or classify_risk_level(base_score)
    else:
        base_score = safe_float(raw_risk, 0.0)
        risk_level = classify_risk_level(base_score)

    future_metrics = compute_future_metrics(base_score)
    weakest_segment = compute_weakest_segment(pipeline, base_score)
    coordinates = assign_pipeline_coordinates(pipeline)

    recommendation = get_recommendation(
        risk_level=risk_level,
        risk_score=base_score,
        pipeline=pipeline,
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

    if enriched.get("WATMAINID"):
        supabase.table("pipelines").update(update_payload).eq(
            "WATMAINID", enriched["WATMAINID"]
        ).execute()
    elif enriched.get("OBJECTID"):
        supabase.table("pipelines").update(update_payload).eq(
            "OBJECTID", enriched["OBJECTID"]
        ).execute()
    else:
        supabase.table("pipelines").update(update_payload).eq(
            "pipeline_id", pipeline_id
        ).execute()


def generate_alert_from_pipeline(pipeline: dict):
    pipeline = normalize_dataset_pipeline(pipeline)

    risk_90 = safe_float(pipeline.get("risk_90_day"), 0.0)
    risk_level = pipeline.get("risk_level")
    condition_score = pipeline.get("condition_score")
    criticality = pipeline.get("criticality")

    if risk_level == "High" or risk_90 >= 0.8:
        return {
            "pipeline_id": pipeline["pipeline_id"],
            "alert_type": "HIGH_RISK_PIPELINE",
            "message": "High risk pipeline segment detected.",
            "priority": "HIGH",
            "status": "open",
            "risk_score": round(risk_90, 3),
        }

    if condition_score is not None and condition_score <= 7:
        return {
            "pipeline_id": pipeline["pipeline_id"],
            "alert_type": "CONDITION_WARNING",
            "message": f"Pipeline condition score is {condition_score}.",
            "priority": "MEDIUM",
            "status": "open",
            "risk_score": round(risk_90, 3),
        }

    if criticality is not None and criticality >= 5:
        return {
            "pipeline_id": pipeline["pipeline_id"],
            "alert_type": "CRITICALITY_WARNING",
            "message": f"Pipeline criticality value is {criticality}.",
            "priority": "MEDIUM",
            "status": "open",
            "risk_score": round(risk_90, 3),
        }

    return None


def save_alert_if_needed(alert: dict):
    existing = (
        supabase.table("alerts")
        .select("id")
        .eq("pipeline_id", alert["pipeline_id"])
        .eq("alert_type", alert["alert_type"])
        .eq("status", "open")
        .execute()
    )

    if existing.data:
        return

    supabase.table("alerts").insert(alert).execute()


def clear_open_alerts_for_pipeline(pipeline_id: str):
    supabase.table("alerts").update({"status": "resolved"}).eq(
        "pipeline_id", pipeline_id
    ).eq("status", "open").execute()


def refresh_alert_for_pipeline(enriched: dict):
    clear_open_alerts_for_pipeline(enriched["pipeline_id"])
    alert = generate_alert_from_pipeline(enriched)

    if alert:
        save_alert_if_needed(alert)


@app.get("/")
def root():
    return {
        "message": "Smart Water Pipeline Backend is working",
        "dataset": "Waterloo/Kitchener Water Mains",
    }


@app.get("/pipelines")
def get_pipelines(
    limit: int = Query(default=100, ge=1, le=5000),
    persist: bool = False,
):
    response = supabase.table("pipelines").select("*").limit(limit).execute()
    pipelines = response.data or []

    results = []

    for pipeline in pipelines:
        enriched = build_enriched_pipeline(pipeline)

        if persist:
            save_derived_fields(enriched["pipeline_id"], enriched)

        results.append(enriched)

    return results


@app.get("/pipelines/{pipeline_id}")
def get_pipeline(pipeline_id: str, persist: bool = False):
    response = (
        supabase.table("pipelines")
        .select("*")
        .eq("WATMAINID", pipeline_id)
        .execute()
    )

    if not response.data:
        response = (
            supabase.table("pipelines")
            .select("*")
            .eq("OBJECTID", pipeline_id)
            .execute()
        )

    if not response.data:
        raise HTTPException(status_code=404, detail="Pipeline not found")

    enriched = build_enriched_pipeline(response.data[0])

    if persist:
        save_derived_fields(enriched["pipeline_id"], enriched)

    return enriched


@app.post("/pipelines")
def create_pipeline(payload: PipelineCreate):
    data = payload.model_dump()

    if data.get("WATMAINID"):
        data["WATMAINID"] = data["WATMAINID"].strip()

        existing = (
            supabase.table("pipelines")
            .select("WATMAINID")
            .eq("WATMAINID", data["WATMAINID"])
            .execute()
        )

        if existing.data:
            raise HTTPException(status_code=409, detail="WATMAINID already exists")

    insert_response = supabase.table("pipelines").insert(data).execute()

    if not insert_response.data:
        raise HTTPException(status_code=500, detail="Failed to create pipeline")

    created = insert_response.data[0]
    enriched = build_enriched_pipeline(created)

    try:
        save_derived_fields(enriched["pipeline_id"], enriched)
    except Exception:
        pass

    return enriched


@app.get("/predict/{pipeline_id}")
def predict_pipeline(pipeline_id: str, persist: bool = False):
    response = (
        supabase.table("pipelines")
        .select("*")
        .eq("WATMAINID", pipeline_id)
        .execute()
    )

    if not response.data:
        response = (
            supabase.table("pipelines")
            .select("*")
            .eq("OBJECTID", pipeline_id)
            .execute()
        )

    if not response.data:
        raise HTTPException(status_code=404, detail="Pipeline not found")

    enriched = build_enriched_pipeline(response.data[0])

    if persist:
        save_derived_fields(enriched["pipeline_id"], enriched)

    recommendation = enriched.get("recommendation", {}) or {}

    risk_score = safe_float(enriched.get("risk_score"), 0.0)
    risk_30_day = safe_float(enriched.get("risk_30_day"), risk_score)
    risk_90_day = safe_float(enriched.get("risk_90_day"), risk_score)
    estimated_life_months = safe_float(enriched.get("estimated_life_months"), 0.0)

    condition_score = safe_float(enriched.get("condition_score"), 0.0)
    criticality_value = safe_float(enriched.get("criticality"), 0.0)
    pipe_size = safe_float(enriched.get("diameter_mm") or enriched.get("PIPE_SIZE"), 0.0)
    pipe_length = safe_float(enriched.get("pipe_length_m") or enriched.get("Shape__Length"), 0.0)
    material = enriched.get("material_type") or enriched.get("MATERIAL") or "Unknown"
    status = enriched.get("status") or enriched.get("STATUS") or "Unknown"
    pressure_zone = enriched.get("PRESSURE_ZONE") or enriched.get("ds_division") or "Unknown"
    category = enriched.get("CATEGORY") or "Unknown"

    health_score = max(0, min(100, round((1 - risk_score) * 100)))
    estimated_remaining_life_years = round(estimated_life_months / 12, 1)

    if condition_score >= 8:
        condition_category = "Good"
    elif condition_score >= 5:
        condition_category = "Fair"
    elif condition_score > 0:
        condition_category = "Poor"
    else:
        condition_category = "Unknown"

    if risk_score >= 0.7:
        likelihood_of_failure = "High"
    elif risk_score >= 0.4:
        likelihood_of_failure = "Medium"
    else:
        likelihood_of_failure = "Low"

    if criticality_value >= 8:
        consequence_of_failure = "High"
    elif criticality_value >= 5:
        consequence_of_failure = "Medium"
    else:
        consequence_of_failure = "Low"

    failure_warning_30_day = "High" if risk_30_day >= 0.7 else "Medium" if risk_30_day >= 0.4 else "Low"
    failure_warning_90_day = "High" if risk_90_day >= 0.7 else "Medium" if risk_90_day >= 0.4 else "Low"

    if failure_warning_30_day == "High" or enriched["risk_level"] == "High":
        maintenance_priority = "Urgent Inspection"
    elif failure_warning_90_day in ["High", "Medium"] or enriched["risk_level"] == "Medium":
        maintenance_priority = "Planned Inspection"
    else:
        maintenance_priority = recommendation.get("priority", "Routine Monitoring")

    # -------------------------
    # Engineering sub-scores
    # -------------------------
    condition_risk_score = max(0, min(1, (10 - condition_score) / 10)) if condition_score else 0.5
    criticality_risk_score = max(0, min(1, criticality_value / 10)) if criticality_value else 0.3

    material_upper = str(material).upper()
    if any(x in material_upper for x in ["CI", "CAST", "IRON"]):
        material_risk_score = 0.70
        material_risk_level = "High"
        material_note = "Material type may have higher deterioration sensitivity."
    elif any(x in material_upper for x in ["DI", "DUCTILE"]):
        material_risk_score = 0.45
        material_risk_level = "Medium"
        material_note = "Ductile iron material indicates moderate material risk."
    elif any(x in material_upper for x in ["PVC", "HDPE", "PLASTIC"]):
        material_risk_score = 0.25
        material_risk_level = "Low"
        material_note = "Material type indicates lower material-related risk."
    else:
        material_risk_score = 0.40
        material_risk_level = "Medium"
        material_note = "Material risk is estimated because material information is limited."

    status_upper = str(status).upper()
    if status_upper in ["ABANDONED", "RETIRED", "INACTIVE"]:
        status_risk_score = 0.80
        status_risk_level = "High"
        status_note = "Asset status indicates a non-active or degraded operational state."
    elif status_upper == "ACTIVE":
        status_risk_score = 0.20
        status_risk_level = "Low"
        status_note = "Asset is currently active."
    else:
        status_risk_score = 0.40
        status_risk_level = "Medium"
        status_note = "Status information is uncertain."

    length_impact_score = min(1, pipe_length / 1000) if pipe_length else 0.2
    diameter_impact_score = min(1, pipe_size / 600) if pipe_size else 0.2
    pressure_zone_impact_score = 0.55 if pressure_zone not in ["Unknown", "-", ""] else 0.35

    current_condition = {
        "condition_score": condition_score,
        "health_score": health_score,
        "condition_category": condition_category,
        "explanation": (
            f"Condition score {condition_score} is classified as {condition_category}. "
            f"The derived health score is {health_score}%."
        ),
    }

    failure_likelihood = {
        "overall": likelihood_of_failure,
        "age_risk": "Estimated from deterioration and remaining life because installation age is not available.",

        # UI display fields - these remove N/A in RiskCalculator.jsx
        "condition_risk": likelihood_of_failure,
        "material_risk": material_risk_level,
        "environment_risk": "Moderate",
        "status_risk": status_risk_level,

        # Numeric calculation fields
        "condition_risk_score": round(condition_risk_score, 3),
        "material_risk_score": round(material_risk_score, 3),
        "status_risk_score": round(status_risk_score, 3),

        "explanation": [
            f"Condition deterioration contribution is {round(condition_risk_score, 3)}.",
            material_note,
            status_note,
            "Environmental/location risk is treated as moderate when detailed soil or climate fields are unavailable.",
        ],
    }

    failure_consequence = {
        "overall": consequence_of_failure,

        # UI display fields - these remove N/A in RiskCalculator.jsx
        "criticality_impact": consequence_of_failure,
        "pipe_size_impact": f"{pipe_size} mm",
        "pipe_length_impact": f"{round(pipe_length, 1)} m",
        "pressure_zone_impact": f"{pressure_zone} / {category}",

        # Numeric calculation fields
        "criticality_score": criticality_value,
        "criticality_risk_score": round(criticality_risk_score, 3),
        "pipe_size_impact_score": round(diameter_impact_score, 3),
        "pipe_length_impact_score": round(length_impact_score, 3),
        "pressure_zone_impact_score": round(pressure_zone_impact_score, 3),
        "category_impact": category,

        "explanation": [
            f"Criticality value {criticality_value} drives the consequence level.",
            f"Pipe size {pipe_size} mm and length {round(pipe_length, 1)} m affect repair impact and service disruption.",
            f"Pressure zone/category context: {pressure_zone} / {category}.",
        ],
    }

    future_warning = {
        # UI display field - this removes N/A in RiskCalculator.jsx
        "remaining_useful_life": f"{estimated_remaining_life_years} years",

        # Numeric calculation field
        "estimated_remaining_useful_life_years": estimated_remaining_life_years,

        "warning_30_day": failure_warning_30_day,
        "warning_90_day": failure_warning_90_day,
        "risk_30_day_score": round(risk_30_day, 3),
        "risk_90_day_score": round(risk_90_day, 3),
        "risk_trend": enriched.get("risk_trend", "Stable"),
        "explanation": (
            f"Short-term warning is based on the current risk score {round(risk_score, 3)}, "
            f"30-day projected risk {round(risk_30_day, 3)}, and 90-day projected risk {round(risk_90_day, 3)}."
        ),
    }

    if enriched["risk_level"] == "High":
        recommended_action = "Immediate inspection and maintenance planning required."
        engineering_note = (
            "This pipeline shows a high engineering risk profile. Immediate inspection is recommended because "
            "failure likelihood and/or consequence indicators are elevated."
        )
    elif enriched["risk_level"] == "Medium":
        recommended_action = "Schedule preventive inspection within the next maintenance cycle."
        engineering_note = (
            "This pipeline is not in immediate failure condition, but deterioration and operational importance "
            "indicate that it should not be left under routine monitoring only."
        )
    else:
        recommended_action = "Continue routine monitoring and include in the normal inspection cycle."
        engineering_note = (
            "This pipeline currently shows a low risk profile. Routine monitoring is suitable unless field "
            "inspection or new incident data indicates deterioration."
        )

    action_plan = {
        "priority_level": maintenance_priority,
        "recommended_action": recommended_action,
        "reason_notes": recommendation.get("reasons", []),
        "engineering_note": engineering_note,
    }

    main_risk_reasons = [
        f"Condition score is {condition_score}, classified as {condition_category}.",
        f"Criticality value is {criticality_value}, giving {consequence_of_failure.lower()} consequence of failure.",
        f"Material type is {material}.",
        f"Current status is {status}.",
        f"Pipe size is {pipe_size} mm and pipe length is {round(pipe_length, 1)} m, affecting failure impact.",
    ]

    return {
        # Final engineering decision report fields
        "pipeline_id": enriched["pipeline_id"],
        "overall_risk_level": enriched["risk_level"],
        "overall_risk_score": round(risk_score, 3),
        "likelihood_of_failure": likelihood_of_failure,
        "consequence_of_failure": consequence_of_failure,
        "health_score": health_score,
        "estimated_remaining_life_years": estimated_remaining_life_years,
        "failure_warning_30_day": failure_warning_30_day,
        "failure_warning_90_day": failure_warning_90_day,
        "maintenance_priority": maintenance_priority,
        "main_risk_reasons": main_risk_reasons,
        "recommended_action": recommended_action,
        "engineering_note": engineering_note,

        # Full structured diagnosis for UI explanation
        "diagnosis": {
            "current_condition": current_condition,
            "failure_likelihood": failure_likelihood,
            "failure_consequence": failure_consequence,
            "future_warning": future_warning,
            "action_plan": action_plan,
        },

        # Legacy / other page compatibility fields
        "WATMAINID": enriched.get("WATMAINID"),
        "OBJECTID": enriched.get("OBJECTID"),
        "STATUS": enriched.get("STATUS"),
        "PRESSURE_ZONE": enriched.get("PRESSURE_ZONE"),
        "MAP_LABEL": enriched.get("MAP_LABEL"),
        "CATEGORY": enriched.get("CATEGORY"),
        "PIPE_SIZE": enriched.get("PIPE_SIZE"),
        "MATERIAL": enriched.get("MATERIAL"),
        "LINED": enriched.get("LINED"),
        "CONDITION_SCORE": enriched.get("CONDITION_SCORE"),
        "CRITICALITY": enriched.get("CRITICALITY"),
        "Shape__Length": enriched.get("Shape__Length"),
        "risk_score": round(risk_score, 3),
        "risk_level": enriched["risk_level"],
        "failure_probability": enriched["failure_probability"],
        "risk_30_day": risk_30_day,
        "risk_90_day": risk_90_day,
        "risk_trend": enriched["risk_trend"],
        "estimated_life_months": enriched["estimated_life_months"],
        "weakest_segment_start_m": enriched["weakest_segment_start_m"],
        "weakest_segment_end_m": enriched["weakest_segment_end_m"],
        "weakest_segment_risk": enriched["weakest_segment_risk"],
        "start_lat": enriched["start_lat"],
        "start_lng": enriched["start_lng"],
        "end_lat": enriched["end_lat"],
        "end_lng": enriched["end_lng"],
        "recommendation": recommendation,
    }


@app.get("/pipelines-with-risk")
def get_pipelines_with_risk(
    limit: int = Query(default=100, ge=1, le=5000),
    persist: bool = False,
):
    response = supabase.table("pipelines").select("*").limit(limit).execute()
    pipelines = response.data or []

    results = []

    for pipeline in pipelines:
        enriched = build_enriched_pipeline(pipeline)

        if persist:
            save_derived_fields(enriched["pipeline_id"], enriched)

        results.append(enriched)

    return results


@app.post("/pipelines/{pipeline_id}/repair-complete")
def complete_pipeline_repair(pipeline_id: str, payload: RepairCompletePayload):
    response = (
        supabase.table("pipelines")
        .select("*")
        .eq("WATMAINID", pipeline_id)
        .execute()
    )

    if not response.data:
        response = (
            supabase.table("pipelines")
            .select("*")
            .eq("OBJECTID", pipeline_id)
            .execute()
        )

    if not response.data:
        raise HTTPException(status_code=404, detail="Pipeline not found")

    current_pipeline = response.data[0]
    before_enriched = build_enriched_pipeline(current_pipeline)

    update_payload = {
        "STATUS": payload.status_after.strip(),
    }

    if payload.condition_after.strip().lower() in ["improved", "good", "repaired"]:
        update_payload["CONDITION_SCORE"] = 8

    elif payload.condition_after.strip().lower() in ["replaced", "fully replaced", "renewed"]:
        update_payload["CONDITION_SCORE"] = 10

    if current_pipeline.get("WATMAINID"):
        update_result = (
            supabase.table("pipelines")
            .update(update_payload)
            .eq("WATMAINID", current_pipeline["WATMAINID"])
            .execute()
        )
    else:
        update_result = (
            supabase.table("pipelines")
            .update(update_payload)
            .eq("OBJECTID", current_pipeline["OBJECTID"])
            .execute()
        )

    if not update_result.data:
        raise HTTPException(status_code=500, detail="Failed to update repaired pipeline")

    after_enriched = build_enriched_pipeline(update_result.data[0])

    try:
        save_derived_fields(after_enriched["pipeline_id"], after_enriched)
        refresh_alert_for_pipeline(after_enriched)
    except Exception:
        pass

    log_payload = {
        "pipeline_id": after_enriched["pipeline_id"],
        "area_name": after_enriched.get("area_name"),
        "ds_division": after_enriched.get("ds_division"),
        "date_completed": "manual",
        "repair_description": payload.repair_description.strip(),
        "old_risk_score": before_enriched["risk_score"],
        "old_risk_level": before_enriched["risk_level"],
        "new_risk_score": after_enriched["risk_score"],
        "new_risk_level": after_enriched["risk_level"],
        "condition_after": payload.condition_after.strip(),
        "status_after": payload.status_after.strip(),
        "repair_cost": payload.repair_cost,
    }

    try:
        supabase.table("maintenance_logs").insert(log_payload).execute()
    except Exception:
        pass

    return {
        "message": "Pipeline marked as repaired and risk recalculated",
        "pipeline_id": after_enriched["pipeline_id"],
        "before": {
            "risk_score": before_enriched["risk_score"],
            "risk_level": before_enriched["risk_level"],
            "condition_score": before_enriched.get("condition_score"),
        },
        "after": {
            "risk_score": after_enriched["risk_score"],
            "risk_level": after_enriched["risk_level"],
            "condition_score": after_enriched.get("condition_score"),
            "status": after_enriched.get("status"),
        },
        "pipeline": after_enriched,
        "maintenance_log": log_payload,
    }


@app.get("/maintenance-logs")
def get_maintenance_logs():
    response = (
        supabase.table("maintenance_logs")
        .select("*")
        .order("id", desc=True)
        .execute()
    )

    return response.data or []


@app.post("/recalculate-all")
def recalculate_all(limit: int = Query(default=100, ge=1, le=5000)):
    try:
        response = supabase.table("pipelines").select("*").limit(limit).execute()
        rows = response.data or []

        updated = 0
        errors = []

        for row in rows:
            try:
                enriched = build_enriched_pipeline(row)
                save_derived_fields(enriched["pipeline_id"], enriched)
                refresh_alert_for_pipeline(enriched)
                updated += 1

            except Exception as e:
                errors.append(
                    {
                        "pipeline_id": get_pipeline_identifier(row),
                        "error": str(e),
                    }
                )

        return {
            "message": "Recalculation completed",
            "updated": updated,
            "errors": errors,
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/alerts")
def get_alerts():
    response = (
        supabase.table("alerts")
        .select("*")
        .order("id", desc=True)
        .execute()
    )

    return response.data or []


@app.post("/alerts/{alert_id}/resolve")
def resolve_alert(alert_id: str):
    supabase.table("alerts").update({"status": "resolved"}).eq(
        "id", alert_id
    ).execute()

    return {"message": "Alert resolved"}


@app.get("/recommendation")
def recommendation_api(
    risk_level: str,
    risk_score: float = 0,
):
    return get_recommendation(risk_level, risk_score)