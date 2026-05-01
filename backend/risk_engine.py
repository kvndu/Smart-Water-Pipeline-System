from datetime import datetime


CURRENT_YEAR = datetime.now().year


def safe_float(value, default=None):
    try:
        if value is None or value == "":
            return default
        return float(str(value).replace(",", ""))
    except (TypeError, ValueError):
        return default


def safe_text(value, default="Unknown"):
    if value is None or value == "":
        return default
    return str(value).strip()


def clamp(value, min_value=0.0, max_value=1.0):
    return max(min_value, min(max_value, value))


def get_pipeline_id(pipeline):
    return (
        pipeline.get("WATMAINID")
        or pipeline.get("OBJECTID")
        or pipeline.get("pipeline_id")
        or "N/A"
    )


def get_condition_score(pipeline):
    return safe_float(
        pipeline.get("CONDITION_SCORE")
        or pipeline.get("Condition Score")
        or pipeline.get("condition_score"),
        None,
    )


def get_install_year(pipeline):
    raw = (
        pipeline.get("INSTALLATION_DATE")
        or pipeline.get("install_year")
        or pipeline.get("INSTALL_YEAR")
    )

    if raw is None:
        return None

    text = str(raw)
    for token in text.replace("/", "-").split("-"):
        if token.isdigit() and len(token) == 4:
            year = int(token)
            if 1800 <= year <= CURRENT_YEAR:
                return year

    try:
        year = int(float(text))
        if 1800 <= year <= CURRENT_YEAR:
            return year
    except Exception:
        return None

    return None


def get_age(pipeline):
    year = get_install_year(pipeline)
    if year:
        return max(0, CURRENT_YEAR - year)
    return safe_float(pipeline.get("age"), 0) or 0


def get_design_life(material):
    m = safe_text(material, "").upper()

    if "PVC" in m or "HDPE" in m or "PE" == m:
        return 80
    if "DI" in m or "DUCTILE" in m:
        return 70
    if "CI" in m or "CAST" in m:
        return 60
    if "AC" in m or "ASBESTOS" in m:
        return 55
    if "STEEL" in m or "ST" == m:
        return 55

    return 65


def get_material_risk(material):
    m = safe_text(material, "").upper()

    if "PVC" in m or "HDPE" in m:
        return 0.20
    if "DI" in m or "DUCTILE" in m:
        return 0.35
    if "CI" in m or "CAST" in m:
        return 0.60
    if "AC" in m or "ASBESTOS" in m:
        return 0.70
    if "STEEL" in m or "ST" == m:
        return 0.65

    return 0.45


def get_status_risk(status, lined):
    status_text = safe_text(status, "").upper()
    lined_text = safe_text(lined, "").upper()

    risk = 0.35

    if "ABANDON" in status_text or "RETIRED" in status_text:
        risk += 0.35
    elif "ACTIVE" in status_text:
        risk += 0.00
    else:
        risk += 0.10

    if lined_text in ["YES", "Y", "TRUE", "1"]:
        risk -= 0.15
    elif lined_text in ["NO", "N", "FALSE", "0"]:
        risk += 0.10

    return clamp(risk)


def get_environment_risk(pipeline):
    area = safe_float(pipeline.get("REL_CLEANING_AREA"), None)
    subarea = safe_float(pipeline.get("REL_CLEANING_SUBAREA"), None)

    values = []

    if area is not None:
        values.append(clamp(area / 10))
    if subarea is not None:
        values.append(clamp(subarea / 10))

    zone = safe_text(pipeline.get("PRESSURE_ZONE"), "").upper()
    category = safe_text(pipeline.get("CATEGORY"), "").upper()

    location_risk = 0.35

    high_terms = ["HIGH", "PRESSURE", "INDUSTRIAL", "DOWNTOWN", "MAIN", "TRUNK"]
    medium_terms = ["RESIDENTIAL", "URBAN", "COMMERCIAL"]

    if any(term in zone or term in category for term in high_terms):
        location_risk = 0.70
    elif any(term in zone or term in category for term in medium_terms):
        location_risk = 0.50

    values.append(location_risk)

    return clamp(sum(values) / len(values)) if values else 0.40


def get_impact_risk(pipe_size, length):
    size_risk = clamp((pipe_size or 0) / 600)
    length_risk = clamp((length or 0) / 300)

    return clamp((size_risk * 0.45) + (length_risk * 0.55))


def calculate_lof(pipeline):
    condition = get_condition_score(pipeline)
    material = safe_text(pipeline.get("MATERIAL") or pipeline.get("material_type"))
    age = get_age(pipeline)
    design_life = get_design_life(material)

    condition_risk = 0.50 if condition is None else clamp((10 - condition) / 10)
    age_risk = clamp(age / design_life)
    material_risk = get_material_risk(material)
    environment_risk = get_environment_risk(pipeline)
    status_risk = get_status_risk(pipeline.get("STATUS"), pipeline.get("LINED"))

    lof_score = (
        condition_risk * 0.35
        + age_risk * 0.25
        + material_risk * 0.15
        + environment_risk * 0.15
        + status_risk * 0.10
    )

    return {
        "score": round(clamp(lof_score), 3),
        "components": {
            "condition_risk": round(condition_risk, 3),
            "age_risk": round(age_risk, 3),
            "material_risk": round(material_risk, 3),
            "environment_risk": round(environment_risk, 3),
            "status_risk": round(status_risk, 3),
        },
    }


def calculate_cof(pipeline):
    criticality = safe_float(pipeline.get("CRITICALITY") or pipeline.get("criticality"), 0) or 0
    pipe_size = safe_float(pipeline.get("PIPE_SIZE") or pipeline.get("diameter_mm"), 0) or 0
    length = safe_float(pipeline.get("Shape__Length") or pipeline.get("pipe_length_m"), 0) or 0

    criticality_risk = clamp(criticality / 10)
    size_impact = clamp(pipe_size / 600)
    length_impact = clamp(length / 300)
    location_impact = get_environment_risk(pipeline)

    cof_score = (
        criticality_risk * 0.40
        + size_impact * 0.25
        + length_impact * 0.20
        + location_impact * 0.15
    )

    return {
        "score": round(clamp(cof_score), 3),
        "components": {
            "criticality_risk": round(criticality_risk, 3),
            "pipe_size_impact": round(size_impact, 3),
            "length_impact": round(length_impact, 3),
            "location_impact": round(location_impact, 3),
        },
    }


def get_risk_level(score):
    if score >= 0.70:
        return "High"
    if score >= 0.40:
        return "Medium"
    return "Low"


def get_warning_level(score):
    if score >= 0.70:
        return "High"
    if score >= 0.40:
        return "Medium"
    return "Low"


def estimate_remaining_life(pipeline, risk_score):
    condition = get_condition_score(pipeline)
    material = safe_text(pipeline.get("MATERIAL") or pipeline.get("material_type"))
    age = get_age(pipeline)
    design_life = get_design_life(material)

    base_remaining = max(0, design_life - age)
    condition_factor = 0.50 if condition is None else clamp(condition / 10)
    risk_factor = clamp(1 - risk_score, 0.10, 1.0)

    estimated_years = base_remaining * condition_factor * risk_factor

    return max(0, round(estimated_years, 1))


def get_priority(risk_level, remaining_life):
    if risk_level == "High" or remaining_life <= 2:
        return "Immediate Inspection"
    if risk_level == "Medium" or remaining_life <= 10:
        return "Planned Inspection"
    return "Routine Monitoring"


def get_recommendation(risk_level, remaining_life):
    if risk_level == "High" or remaining_life <= 2:
        return "Immediate inspection and repair planning required."
    if risk_level == "Medium" or remaining_life <= 10:
        return "Schedule preventive inspection within the next maintenance cycle."
    return "Continue routine monitoring and periodic condition assessment."


def generate_reasons(pipeline, lof, cof, remaining_life):
    reasons = []

    condition = get_condition_score(pipeline)
    age = get_age(pipeline)
    material = safe_text(pipeline.get("MATERIAL") or pipeline.get("material_type"))
    design_life = get_design_life(material)
    criticality = safe_float(pipeline.get("CRITICALITY"), 0) or 0
    length = safe_float(pipeline.get("Shape__Length") or pipeline.get("pipe_length_m"), 0) or 0
    pipe_size = safe_float(pipeline.get("PIPE_SIZE") or pipeline.get("diameter_mm"), 0) or 0

    if age / design_life >= 0.75:
        reasons.append("Pipe age is high compared to expected material design life.")
    elif age / design_life >= 0.45:
        reasons.append("Pipe age is moderate compared to expected material design life.")

    if condition is not None:
        if condition <= 4:
            reasons.append("Condition score indicates poor physical condition.")
        elif condition <= 7:
            reasons.append("Condition score shows moderate deterioration.")
        else:
            reasons.append("Condition score indicates currently healthy pipe condition.")

    if criticality >= 8:
        reasons.append("Criticality is high, meaning failure would have major service impact.")
    elif criticality >= 5:
        reasons.append("Criticality is medium-high and should be considered in maintenance planning.")

    if lof["components"]["environment_risk"] >= 0.55:
        reasons.append("Environmental/location risk is moderate to high.")

    if pipe_size >= 300 or length >= 150:
        reasons.append("Pipe length or diameter increases the impact of a possible failure.")

    if remaining_life <= 5:
        reasons.append("Estimated remaining useful life is low and requires early attention.")

    if not reasons:
        reasons.append("No major risk drivers were detected from the available dataset fields.")

    return reasons


def build_engineering_note(risk_level, remaining_life):
    if risk_level == "High":
        return (
            "This pipeline shows a high engineering risk profile. "
            "It should be prioritized for inspection and repair planning before failure occurs."
        )

    if risk_level == "Medium":
        return (
            "This pipeline is not in immediate failure condition, but deterioration and operational importance "
            "indicate that it should not be left under routine monitoring only."
        )

    return (
        "This pipeline is currently low risk based on available data, but periodic monitoring should continue."
    )


def build_pipeline_report(pipeline):
    lof = calculate_lof(pipeline)
    cof = calculate_cof(pipeline)

    risk_score = clamp(lof["score"] * cof["score"])
    risk_level = get_risk_level(risk_score)

    health_score = round((1 - risk_score) * 100)
    remaining_life = estimate_remaining_life(pipeline, risk_score)

    warning_30_score = clamp(risk_score + 0.05)
    warning_90_score = clamp(risk_score + 0.12)

    warning_30 = get_warning_level(warning_30_score)
    warning_90 = get_warning_level(warning_90_score)

    priority = get_priority(risk_level, remaining_life)
    recommendation = get_recommendation(risk_level, remaining_life)
    reasons = generate_reasons(pipeline, lof, cof, remaining_life)
    note = build_engineering_note(risk_level, remaining_life)

    return {
        "pipeline_id": str(get_pipeline_id(pipeline)),
        "overall_risk_level": risk_level,
        "overall_risk_score": round(risk_score, 3),
        "likelihood_of_failure": lof["score"],
        "consequence_of_failure": cof["score"],
        "health_score": health_score,
        "estimated_remaining_life_years": remaining_life,
        "failure_warning_30_day": warning_30,
        "failure_warning_90_day": warning_90,
        "maintenance_priority": priority,
        "main_risk_reasons": reasons,
        "recommended_action": recommendation,
        "engineering_note": note,
        "details": {
            "lof_components": lof["components"],
            "cof_components": cof["components"],
            "condition_score": get_condition_score(pipeline),
            "age": get_age(pipeline),
            "material": safe_text(pipeline.get("MATERIAL") or pipeline.get("material_type")),
            "criticality": safe_float(pipeline.get("CRITICALITY"), None),
        },
    }


def calculate_risk(pipeline):
    report = build_pipeline_report(pipeline)

    return {
        "risk_score": report["overall_risk_score"],
        "risk_level": report["overall_risk_level"],
        "recommendation": report["recommended_action"],
        "full_report": report,
    }