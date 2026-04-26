def safe_float(value, default=None):
    try:
        if value is None or value == "":
            return default
        return float(value)
    except (TypeError, ValueError):
        return default


def get_condition_score(pipeline: dict):
    return (
        pipeline.get("CONDITION_SCORE")
        or pipeline.get("Condition Score")
        or pipeline.get("condition_score")
    )


def calculate_risk(pipeline: dict):
    condition_score = safe_float(get_condition_score(pipeline), None)
    criticality = safe_float(pipeline.get("CRITICALITY"), None)

    if condition_score is not None:
        if condition_score <= 4:
            risk_score = 0.85
            risk_level = "High"
            recommendation = "Immediate inspection required"
        elif condition_score <= 7:
            risk_score = 0.55
            risk_level = "Medium"
            recommendation = "Schedule inspection"
        else:
            risk_score = 0.20
            risk_level = "Low"
            recommendation = "Routine monitoring"

    elif criticality is not None:
        if criticality >= 8:
            risk_score = 0.85
            risk_level = "High"
            recommendation = "Immediate inspection required"
        elif criticality >= 5:
            risk_score = 0.55
            risk_level = "Medium"
            recommendation = "Schedule inspection"
        else:
            risk_score = 0.20
            risk_level = "Low"
            recommendation = "Routine monitoring"

    else:
        risk_score = 0.20
        risk_level = "Low"
        recommendation = "Routine monitoring"

    return {
        "risk_score": round(risk_score, 3),
        "risk_level": risk_level,
        "recommendation": recommendation,
    }