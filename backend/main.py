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

    return {
        "pipeline_id": enriched["pipeline_id"],
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