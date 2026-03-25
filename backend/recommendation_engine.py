def get_recommendation(risk_level, risk_score=0, leaks=0, live_rain_mm=0):
    risk_level = (risk_level or "").strip()

    if risk_level == "High":
        action = "Immediate maintenance"
        priority = "Critical"
        message = "This pipeline requires urgent inspection and maintenance due to high calculated risk."
    elif risk_level == "Medium":
        action = "Schedule inspection"
        priority = "Moderate"
        message = "This pipeline should be inspected soon and monitored closely."
    else:
        action = "Routine monitoring"
        priority = "Low"
        message = "This pipeline can remain under normal monitoring conditions."

    reasons = []

    if float(risk_score or 0) >= 0.7:
        reasons.append("High overall risk score")
    elif float(risk_score or 0) >= 0.4:
        reasons.append("Moderate overall risk score")

    if int(leaks or 0) >= 2:
        reasons.append("Repeated leak history")
    elif int(leaks or 0) == 1:
        reasons.append("Leak history detected")

    if float(live_rain_mm or 0) > 5:
        reasons.append("Heavy current rainfall may increase environmental stress")

    if not reasons:
        reasons.append("No immediate high-risk trigger detected")

    return {
        "risk_level": risk_level,
        "risk_score": round(float(risk_score or 0), 3),
        "action": action,
        "priority": priority,
        "message": message,
        "reasons": reasons,
    }