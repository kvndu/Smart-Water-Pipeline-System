from datetime import datetime


def calculate_risk(pipeline: dict):
    current_year = datetime.now().year

    # 1. Age Score
    pipe_age = current_year - pipeline["install_year"]
    age_score = min(pipe_age / 50, 1)

    # 2. Material Score
    material_map = {
        "HDPE": 0.2,
        "uPVC": 0.3,
        "DI": 0.6,
        "CI": 0.8,
        "Steel": 0.9
    }
    material_score = material_map.get(pipeline["material_type"], 0.5)

    # 3. Incident Score
    # Leaks increase risk, but completed repairs should reduce the effect
    leaks = int(pipeline.get("previous_leak_count", 0) or 0)
    repairs = int(pipeline.get("previous_repair_count", 0) or 0)

    raw_incident_score = ((leaks * 0.8) - (repairs * 0.25)) / 10
    incident_score = min(max(raw_incident_score, 0), 1)

    # 4. Rain Score
    rain_score = min((pipeline.get("annual_rainfall_mm", 0) or 0) / 4000, 1)

    # Base Risk Score
    base_risk_score = (
        0.35 * age_score +
        0.25 * material_score +
        0.25 * incident_score +
        0.15 * rain_score
    )

    # 5. Recent maintenance bonus
    last_maintenance_year = pipeline.get("last_maintenance_year")
    maintenance_bonus = 0.0

    if last_maintenance_year:
        years_since_maintenance = current_year - int(last_maintenance_year)
        if years_since_maintenance <= 1:
            maintenance_bonus = 0.10
        elif years_since_maintenance <= 3:
            maintenance_bonus = 0.05

    risk_score = max(0.0, min(base_risk_score - maintenance_bonus, 1.0))

    # Risk Level
    if risk_score < 0.4:
        risk_level = "Low"
    elif risk_score < 0.7:
        risk_level = "Medium"
    else:
        risk_level = "High"

    # Recommendation
    if risk_level == "High":
        recommendation = "Immediate replacement"
    elif risk_level == "Medium":
        recommendation = "Inspect soon"
    else:
        recommendation = "Routine monitoring"

    return {
        "risk_score": round(risk_score, 3),
        "risk_level": risk_level,
        "recommendation": recommendation
    }