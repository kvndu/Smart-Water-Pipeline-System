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
    leaks = pipeline["previous_leak_count"]
    repairs = pipeline["previous_repair_count"]
    incident_score = min((leaks * 0.7 + repairs * 0.3) / 10, 1)

    # 4. Rain Score
    rain_score = min(pipeline["annual_rainfall_mm"] / 4000, 1)

    # Final Risk Score
    risk_score = (
        0.35 * age_score +
        0.25 * material_score +
        0.25 * incident_score +
        0.15 * rain_score
    )

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