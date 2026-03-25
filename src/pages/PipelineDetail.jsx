import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api from "../utils/api.js";

function getMaterialScore(material) {
  const value = String(material || "").trim().toLowerCase();

  if (value === "hdpe") return 0.2;
  if (value === "upvc" || value === "pvc") return 0.3;
  if (value === "di") return 0.6;
  if (value === "ci") return 0.8;
  if (value === "steel") return 0.9;

  return 0.5;
}

function convertRainToScore(rainMm) {
  const value = Number(rainMm || 0);

  if (value <= 0) return 0.0;
  if (value <= 2) return 0.2;
  if (value <= 5) return 0.5;
  if (value <= 10) return 0.8;
  return 1.0;
}

function getRiskLevel(score) {
  if (score >= 0.7) return "High";
  if (score >= 0.4) return "Medium";
  return "Low";
}

function getRiskBadgeClass(level) {
  if (level === "High") return "detailBadgeHigh";
  if (level === "Medium") return "detailBadgeMedium";
  return "detailBadgeLow";
}

export default function PipelineDetail() {
  const { id } = useParams();

  const [pipeline, setPipeline] = useState(null);
  const [liveRain, setLiveRain] = useState(null);
  const [loading, setLoading] = useState(true);
  const [rainLoading, setRainLoading] = useState(true);
  const [error, setError] = useState("");
  const [rainError, setRainError] = useState("");

  useEffect(() => {
    async function fetchPipeline() {
      try {
        setLoading(true);
        setError("");

        const res = await api.get("/pipelines-with-risk?limit=2000");
        const data = Array.isArray(res.data) ? res.data : [];
        const found = data.find((p) => String(p.pipeline_id) === String(id)) || null;

        if (!found) {
          setError("Pipeline record not found.");
          setPipeline(null);
        } else {
          setPipeline(found);
        }
      } catch (err) {
        console.error(err);
        setError("Failed to load pipeline details.");
      } finally {
        setLoading(false);
      }
    }

    fetchPipeline();
  }, [id]);

  useEffect(() => {
    async function fetchRain() {
      try {
        setRainLoading(true);
        setRainError("");
        const res = await api.get("/live-rain");
        setLiveRain(res.data || null);
      } catch (err) {
        console.error(err);
        setRainError("Failed to load live rain data.");
      } finally {
        setRainLoading(false);
      }
    }

    fetchRain();
  }, []);

  const breakdown = useMemo(() => {
    if (!pipeline) return null;

    const currentYear = new Date().getFullYear();
    const installYear = Number(pipeline.install_year || currentYear);
    const age = Math.max(currentYear - installYear, 0);

    const ageScore = Math.min(age / 50, 1);
    const materialScore = getMaterialScore(pipeline.material_type);
    const incidentScore = Math.min(
      (Number(pipeline.previous_leak_count || 0) * 0.7 +
        Number(pipeline.previous_repair_count || 0) * 0.3) / 10,
      1
    );

    const rainMm = Number(liveRain?.rain_mm || pipeline.annual_rainfall_mm || 0);
    const rainScore = convertRainToScore(rainMm);

    const finalScore =
      0.35 * ageScore +
      0.25 * materialScore +
      0.25 * incidentScore +
      0.15 * rainScore;

    const riskLevel = getRiskLevel(finalScore);

    return {
      age,
      ageScore: ageScore.toFixed(3),
      materialScore: materialScore.toFixed(3),
      incidentScore: incidentScore.toFixed(3),
      rainScore: rainScore.toFixed(3),
      finalScore: finalScore.toFixed(3),
      riskLevel,
      rainMm: Number(rainMm).toFixed(1),
    };
  }, [pipeline, liveRain]);

  return (
    <div className="container" style={{ animation: "fadeIn 0.35s ease" }}>
      <div className="pageHero pageHeroCompact">
        <div>
          <div className="heroEyebrow">Pipeline Detail</div>
          <div className="pageTitle">Pipeline detail page</div>
          <div className="pageSubtitle">
            View one pipeline in detail, including score breakdown and maintenance recommendation.
          </div>
        </div>

        <div className="pageActions">
          <Link to="/pipelines" className="btn btnSecondary">
            ← Back to pipelines
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="card card-pad">Loading pipeline details...</div>
      ) : error ? (
        <div className="card card-pad" style={{ color: "var(--danger)" }}>
          {error}
        </div>
      ) : (
        <>
          <div className="detailTopGrid" style={{ marginBottom: 18 }}>
            <div className="card card-pad">
              <div className="sectionHeader">
                <div>
                  <div className="sectionTitle">Basic information</div>
                  <div className="sectionSubtitle">Core details for the selected pipeline.</div>
                </div>
                {breakdown && (
                  <span className={`detailRiskBadge ${getRiskBadgeClass(breakdown.riskLevel)}`}>
                    {breakdown.riskLevel}
                  </span>
                )}
              </div>

              <div className="detailGrid">
                <div className="detailItem">
                  <div className="detailLabel">Pipeline ID</div>
                  <div className="detailValue">{pipeline.pipeline_id}</div>
                </div>
                <div className="detailItem">
                  <div className="detailLabel">Area</div>
                  <div className="detailValue">{pipeline.area_name || "-"}</div>
                </div>
                <div className="detailItem">
                  <div className="detailLabel">Division</div>
                  <div className="detailValue">{pipeline.ds_division || "-"}</div>
                </div>
                <div className="detailItem">
                  <div className="detailLabel">Material</div>
                  <div className="detailValue">{pipeline.material_type || "-"}</div>
                </div>
                <div className="detailItem">
                  <div className="detailLabel">Install year</div>
                  <div className="detailValue">{pipeline.install_year || "-"}</div>
                </div>
                <div className="detailItem">
                  <div className="detailLabel">Pipe age</div>
                  <div className="detailValue">{breakdown?.age ?? 0} years</div>
                </div>
                <div className="detailItem">
                  <div className="detailLabel">Leak count</div>
                  <div className="detailValue">{pipeline.previous_leak_count || 0}</div>
                </div>
                <div className="detailItem">
                  <div className="detailLabel">Repair count</div>
                  <div className="detailValue">{pipeline.previous_repair_count || 0}</div>
                </div>
                <div className="detailItem">
                  <div className="detailLabel">Pipe length</div>
                  <div className="detailValue">{pipeline.pipe_length_m || "-"} m</div>
                </div>
                <div className="detailItem">
                  <div className="detailLabel">Diameter</div>
                  <div className="detailValue">{pipeline.diameter_mm || "-"} mm</div>
                </div>
                <div className="detailItem">
                  <div className="detailLabel">Last maintenance year</div>
                  <div className="detailValue">{pipeline.last_maintenance_year || "Not recorded"}</div>
                </div>
                <div className="detailItem">
                  <div className="detailLabel">Live rain</div>
                  <div className="detailValue">
                    {rainLoading ? "Loading..." : `${breakdown?.rainMm || "0.0"} mm`}
                  </div>
                </div>
              </div>

              {rainError ? (
                <div className="small" style={{ marginTop: 12, color: "var(--danger)" }}>
                  {rainError}
                </div>
              ) : null}
            </div>

            <div className="card card-pad">
              <div className="sectionHeader">
                <div>
                  <div className="sectionTitle">Risk result</div>
                  <div className="sectionSubtitle">Final calculated output for this pipeline.</div>
                </div>
              </div>

              <div className="vstack">
                <div className="detailItem">
                  <div className="detailLabel">Final risk score</div>
                  <div className="detailValue">{breakdown?.finalScore || "0.000"}</div>
                </div>
                <div className="detailItem">
                  <div className="detailLabel">Risk level</div>
                  <div className="detailValue">{breakdown?.riskLevel || "Low"}</div>
                </div>
                <div className="detailItem">
                  <div className="detailLabel">Current system risk</div>
                  <div className="detailValue">{pipeline.risk_level || "-"}</div>
                </div>
                <div className="detailItem">
                  <div className="detailLabel">Stored risk score</div>
                  <div className="detailValue">{Number(pipeline.risk_score || 0).toFixed(3)}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="panelGrid">
            <div className="card card-pad">
              <div className="sectionHeader">
                <div>
                  <div className="sectionTitle">Score breakdown</div>
                  <div className="sectionSubtitle">Why this pipeline received this risk result.</div>
                </div>
              </div>

              <div className="detailGrid">
                <div className="detailItem">
                  <div className="detailLabel">Age Score</div>
                  <div className="detailValue">{breakdown?.ageScore || "0.000"}</div>
                </div>
                <div className="detailItem">
                  <div className="detailLabel">Material Score</div>
                  <div className="detailValue">{breakdown?.materialScore || "0.000"}</div>
                </div>
                <div className="detailItem">
                  <div className="detailLabel">Incident Score</div>
                  <div className="detailValue">{breakdown?.incidentScore || "0.000"}</div>
                </div>
                <div className="detailItem">
                  <div className="detailLabel">Rain Score</div>
                  <div className="detailValue">{breakdown?.rainScore || "0.000"}</div>
                </div>
              </div>
            </div>

            <div className="card card-pad">
              <div className="sectionHeader">
                <div>
                  <div className="sectionTitle">Recommended action</div>
                  <div className="sectionSubtitle">Recommendation returned by the backend API.</div>
                </div>
              </div>

              {pipeline.recommendation ? (
                <div className="vstack" style={{ gap: 12 }}>
                  <div className="detailItem">
                    <div className="detailLabel">Action</div>
                    <div className="detailValue">{pipeline.recommendation.action || "-"}</div>
                  </div>

                  <div className="detailItem">
                    <div className="detailLabel">Priority</div>
                    <div className="detailValue">{pipeline.recommendation.priority || "-"}</div>
                  </div>

                  <div className="detailItem">
                    <div className="detailLabel">Message</div>
                    <div className="detailValue">
                      {pipeline.recommendation.message || "No message available."}
                    </div>
                  </div>

                  <div className="detailItem">
                    <div className="detailLabel">Reasons</div>
                    <div className="detailValue">
                      {Array.isArray(pipeline.recommendation.reasons) &&
                      pipeline.recommendation.reasons.length > 0 ? (
                        <ul style={{ margin: "8px 0 0 18px", padding: 0 }}>
                          {pipeline.recommendation.reasons.map((reason, index) => (
                            <li key={index} style={{ marginBottom: 6 }}>
                              {reason}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        "No reasons available."
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="emptyState" style={{ textAlign: "left" }}>
                  No recommendation available.
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}