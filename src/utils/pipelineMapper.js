function cleanText(value, fallback = "-") {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value).trim();
}

function toNumber(value, fallback = 0) {
  if (value === null || value === undefined || value === "") return fallback;
  const match = String(value).replace(/,/g, "").match(/-?\d+(\.\d+)?/);
  if (!match) return fallback;
  const number = Number(match[0]);
  return Number.isFinite(number) ? number : fallback;
}

function extractDiameter(row) {
  const fromPipeSize = toNumber(row.PIPE_SIZE, 0);
  if (fromPipeSize > 0) return fromPipeSize;
  return toNumber(row.MAP_LABEL, 0);
}

function extractLength(row) {
  const label = cleanText(row.MAP_LABEL, "");
  const lengthMatch = label.match(/(\d+(?:\.\d+)?)\s*m\b/i);
  if (lengthMatch) return Number(lengthMatch[1]);
  return toNumber(row.Shape__Length, 0);
}

function extractInstallYear(row) {
  const raw = cleanText(row.INSTALLATION_DATE, "");
  const yearMatch = raw.match(/(19|20)\d{2}/);
  if (yearMatch) return Number(yearMatch[0]);
  return null;
}

function normalizeRisk(value) {
  const risk = cleanText(value, "").toLowerCase();
  if (risk === "high") return "High";
  if (risk === "medium") return "Medium";
  if (risk === "low") return "Low";
  return "";
}

function calculateRisk(row) {
  const dbRisk = normalizeRisk(row.risk_level);
  if (dbRisk) return dbRisk;

  const conditionScore = toNumber(row["Condition Score"] ?? row.CONDITION_SCORE,0);
  const criticality = toNumber(row.CRITICALITY, 0);

  if ((conditionScore > 0 && conditionScore <= 4) || criticality >= 8) return "High";
  if ((conditionScore > 0 && conditionScore <= 7) || criticality >= 5) return "Medium";
  return "Low";
}

function calculateRiskScore(row, installYear) {
  const currentYear = new Date().getFullYear();
  const age = installYear ? Math.max(0, currentYear - installYear) : 0;
  const conditionScore = toNumber(row["Condition Score"], 8);
  const criticality = toNumber(row.CRITICALITY, 1);
  const diameter = extractDiameter(row);

  const ageScore = Math.min(age / 80, 1);
  const conditionRisk = conditionScore > 0 ? Math.max(0, (10 - conditionScore) / 10) : 0.35;
  const criticalityScore = Math.min(criticality / 10, 1);
  const diameterScore = diameter >= 300 ? 0.6 : diameter >= 150 ? 0.35 : 0.2;

  const score = ageScore * 0.3 + conditionRisk * 0.4 + criticalityScore * 0.2 + diameterScore * 0.1;
  return Math.max(0.05, Math.min(0.98, Number(score.toFixed(3))));
}

function hashUnit(seed) {
  let hash = 0;
  const text = String(seed || "pipeline");
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash << 5) - hash + text.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash % 10000) / 10000;
}

function buildSyntheticCoordinates(row) {
  // Approximate Kitchener/Waterloo center. The CSV has pipe details but not visible latitude/longitude columns.
  const seed = `${row.OBJECTID}-${row.WATMAINID}-${row.ROADSEGMENTID}`;
  const u1 = hashUnit(seed + "lat");
  const u2 = hashUnit(seed + "lng");
  const u3 = hashUnit(seed + "lat2");
  const u4 = hashUnit(seed + "lng2");

  const baseLat = 43.4516;
  const baseLng = -80.4925;
  const start_lat = baseLat + (u1 - 0.5) * 0.16;
  const start_lng = baseLng + (u2 - 0.5) * 0.20;
  const end_lat = start_lat + (u3 - 0.5) * 0.01;
  const end_lng = start_lng + (u4 - 0.5) * 0.01;

  return { start_lat, start_lng, end_lat, end_lng };
}

function buildRecommendation(riskLevel, material, conditionScore) {
  if (riskLevel === "High") {
    return {
      action: "Schedule priority inspection",
      priority: "High",
      message: "This pipeline has a high calculated risk based on condition and criticality values.",
      reasons: ["High risk score", material ? `${material} material` : "Material available", `Condition ${conditionScore || "N/A"}`],
    };
  }

  if (riskLevel === "Medium") {
    return {
      action: "Plan preventive maintenance",
      priority: "Medium",
      message: "Monitor this pipeline and include it in the next maintenance cycle.",
      reasons: ["Moderate risk", "Preventive maintenance"],
    };
  }

  return {
    action: "Routine monitoring",
    priority: "Low",
    message: "No urgent action is required based on the current dataset values.",
    reasons: ["Low calculated risk"],
  };
}

export function mapPipelineRow(row) {
  const installYear = extractInstallYear(row);
  const length = extractLength(row);
  const diameter = extractDiameter(row);
  const material = cleanText(row.MATERIAL, "Unknown");
  const riskLevel = calculateRisk(row);
  const riskScore = calculateRiskScore(row, installYear);
  const failureProbability = Math.round(riskScore * 100);
  const conditionScore = toNumber(row["Condition Score"], 0);
  const coords = buildSyntheticCoordinates(row);
  const weakStart = length > 0 ? Math.round(length * 0.35) : 0;
  const weakEnd = length > 0 ? Math.round(length * 0.65) : 0;

  return {
    raw: row,
    id: cleanText(row.OBJECTID),
    pipeline_id: cleanText(row.WATMAINID, cleanText(row.OBJECTID)),
    object_id: cleanText(row.OBJECTID),
    area_name: cleanText(row.PRESSURE_ZONE, cleanText(row.CATEGORY, "Kitchener/Waterloo")),
    ds_division: cleanText(row.CATEGORY, cleanText(row.STATUS, "Water Main")),
    status: cleanText(row.STATUS, "ACTIVE"),
    material_type: material,
    material,
    diameter_mm: diameter,
    length_m: length,
    pipe_length_m: length,
    install_year: installYear,
    condition_score: conditionScore,
    criticality: toNumber(row.CRITICALITY, 0),
    road_segment_id: cleanText(row.ROADSEGMENTID),
    map_label: cleanText(row.MAP_LABEL),
    risk_level: riskLevel,
    corrosion_risk: riskLevel,
    risk_score: riskScore,
    risk_30_day: Number(Math.min(0.99, riskScore + 0.04).toFixed(3)),
    risk_90_day: Number(Math.min(0.99, riskScore + 0.1).toFixed(3)),
    failure_probability: failureProbability,
    risk_trend: riskLevel === "High" ? "Increasing" : riskLevel === "Medium" ? "Stable" : "Decreasing",
    estimated_life_months: Math.max(6, Math.round((1 - riskScore) * 84)),
    previous_leak_count: 0,
    previous_repair_count: 0,
    leak_count: 0,
    last_maintenance_year: extractInstallYear({ INSTALLATION_DATE: row.LINED_DATE }) || "Not recorded",
    last_maintenance_date: cleanText(row.LINED_DATE, "Not recorded"),
    annual_rainfall_mm: 900,
    weakest_segment_start_m: weakStart,
    weakest_segment_end_m: weakEnd,
    weakest_segment_risk: Number(Math.min(0.99, riskScore + 0.12).toFixed(3)),
    recommendation: buildRecommendation(riskLevel, material, conditionScore),
    ...coords,
  };
}
