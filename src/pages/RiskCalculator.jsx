import { useEffect, useMemo, useState } from "react";
import api from "../utils/api.js";

const KALUTARA_AREAS = [
  "kalutara",
  "panadura",
  "beruwala",
  "agalawatta",
  "bulathsinhala",
  "horana",
  "mathugama",
  "matugama",
  "aluthgama",
  "walana",
  "payagala",
  "molkawa",
  "waskaduwa",
  "halwatura",
  "millawa",
  "pinwatta",
  "dodangoda",
];

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

function getRainStatus(rainMm) {
  const value = Number(rainMm || 0);

  if (value <= 0) return "No rain";
  if (value <= 2) return "Light rain";
  if (value <= 5) return "Moderate rain";
  if (value <= 10) return "Heavy rain";
  return "Very heavy rain";
}

function isKalutaraPipeline(pipeline) {
  const text = `${pipeline.area_name || ""} ${pipeline.ds_division || ""}`.toLowerCase();
  return KALUTARA_AREAS.some((area) => text.includes(area));
}

function getRiskBadgeClass(level) {
  if (level === "High") return "calcBadgeHigh";
  if (level === "Medium") return "calcBadgeMedium";
  return "calcBadgeLow";
}

export default function RiskCalculator() {
  const [allPipelines, setAllPipelines] = useState([]);
  const [selectedPipelineId, setSelectedPipelineId] = useState("");
  const [selectedPipeline, setSelectedPipeline] = useState(null);

  const [liveRain, setLiveRain] = useState(null);
  const [loading, setLoading] = useState(true);
  const [rainLoading, setRainLoading] = useState(true);
  const [error, setError] = useState("");
  const [rainError, setRainError] = useState("");

  const [result, setResult] = useState(null);

  useEffect(() => {
    async function fetchPipelines() {
      try {
        setLoading(true);
        setError("");

        const res = await api.get("/pipelines-with-risk?limit=1000");
        const data = Array.isArray(res.data) ? res.data : [];
        setAllPipelines(data);
      } catch (err) {
        console.error(err);
        setError("Failed to load pipeline records.");
      } finally {
        setLoading(false);
      }
    }

    fetchPipelines();
  }, []);

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

  const kalutaraPipelines = useMemo(() => {
    return allPipelines.filter(isKalutaraPipeline);
  }, [allPipelines]);

  useEffect(() => {
    if (!kalutaraPipelines.length) return;

    if (!selectedPipelineId) {
      setSelectedPipelineId(kalutaraPipelines[0].pipeline_id);
      setSelectedPipeline(kalutaraPipelines[0]);
      return;
    }

    const found =
      kalutaraPipelines.find((p) => p.pipeline_id === selectedPipelineId) || null;
    setSelectedPipeline(found);
  }, [kalutaraPipelines, selectedPipelineId]);

  const currentYear = new Date().getFullYear();

  const pipelineValues = useMemo(() => {
    if (!selectedPipeline) {
      return {
        pipelineAge: 0,
        materialType: "",
        leaks: 0,
        repairs: 0,
        areaName: "",
        division: "",
      };
    }

    const installYear = Number(selectedPipeline.install_year || currentYear);
    const pipelineAge = Math.max(currentYear - installYear, 0);

    return {
      pipelineAge,
      materialType: selectedPipeline.material_type || "",
      leaks: Number(selectedPipeline.previous_leak_count || 0),
      repairs: Number(selectedPipeline.previous_repair_count || 0),
      areaName: selectedPipeline.area_name || "-",
      division: selectedPipeline.ds_division || "-",
    };
  }, [selectedPipeline, currentYear]);

  const calculateRisk = () => {
    if (!selectedPipeline) return;

    const ageScore = Math.min(pipelineValues.pipelineAge / 50, 1);
    const materialScore = getMaterialScore(pipelineValues.materialType);
    const incidentScore = Math.min(
      (pipelineValues.leaks * 0.7 + pipelineValues.repairs * 0.3) / 10,
      1
    );
    const rainMm = Number(liveRain?.rain_mm || 0);
    const rainScore = convertRainToScore(rainMm);

    const riskScore =
      0.35 * ageScore +
      0.25 * materialScore +
      0.25 * incidentScore +
      0.15 * rainScore;

    let riskLevel = "Low";
    if (riskScore >= 0.7) riskLevel = "High";
    else if (riskScore >= 0.4) riskLevel = "Medium";

    setResult({
      pipelineId: selectedPipeline.pipeline_id,
      areaName: pipelineValues.areaName,
      division: pipelineValues.division,
      ageScore: ageScore.toFixed(3),
      materialScore: materialScore.toFixed(3),
      incidentScore: incidentScore.toFixed(3),
      rainScore: rainScore.toFixed(3),
      riskScore: riskScore.toFixed(3),
      riskLevel,
      rainStatus: getRainStatus(rainMm),
    });
  };

  return (
    <div className="calcPageWrap">
      <div className="calcCardCompact">
        <div className="calcHeaderCompact">
          <div>
            <h2>Kalutara Pipeline Risk Calculator</h2>
            <p>Select a real Kalutara pipeline and calculate its current risk score.</p>
          </div>

          <div className="calcTopStats">
            <div className="calcMiniStat">
              <span>Pipelines</span>
              <strong>{loading ? "..." : kalutaraPipelines.length}</strong>
            </div>
            <div className="calcMiniStat">
              <span>Live Rain</span>
              <strong>
                {rainLoading ? "..." : `${Number(liveRain?.rain_mm || 0).toFixed(1)} mm`}
              </strong>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="calcInfoBar">Loading Kalutara pipeline records...</div>
        ) : error ? (
          <div className="calcInfoBar calcErrorText">{error}</div>
        ) : (
          <>
            <div className="calcInfoGrid">
              <div className="calcInfoItem">
                <span>District</span>
                <strong>Kalutara</strong>
              </div>
              <div className="calcInfoItem">
                <span>Rain Status</span>
                <strong>{rainLoading ? "Loading..." : getRainStatus(liveRain?.rain_mm || 0)}</strong>
              </div>
              <div className="calcInfoItem">
                <span>Rain Score</span>
                <strong>{rainLoading ? "..." : Number(liveRain?.rain_score || 0).toFixed(2)}</strong>
              </div>
              <div className="calcInfoItem">
                <span>Updated</span>
                <strong>{rainLoading ? "..." : liveRain?.updated_time || "-"}</strong>
              </div>
            </div>

            {rainError ? <div className="calcInfoBar calcErrorText">{rainError}</div> : null}

            <div className="calcMainGrid">
              <div className="calcFormCompact">
                <div className="calcFieldFull">
                  <label>Select Pipeline</label>
                  <select
                    value={selectedPipelineId}
                    onChange={(e) => setSelectedPipelineId(e.target.value)}
                  >
                    {kalutaraPipelines.map((pipeline) => (
                      <option key={pipeline.pipeline_id} value={pipeline.pipeline_id}>
                        {pipeline.pipeline_id} - {pipeline.area_name || pipeline.ds_division || "Unknown Area"}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label>Area</label>
                  <input type="text" value={pipelineValues.areaName} readOnly />
                </div>

                <div>
                  <label>Division</label>
                  <input type="text" value={pipelineValues.division} readOnly />
                </div>

                <div>
                  <label>Pipe Age (years)</label>
                  <input type="text" value={pipelineValues.pipelineAge} readOnly />
                </div>

                <div>
                  <label>Material Type</label>
                  <input type="text" value={pipelineValues.materialType} readOnly />
                </div>

                <div>
                  <label>Previous Leak Count</label>
                  <input type="text" value={pipelineValues.leaks} readOnly />
                </div>

                <div>
                  <label>Previous Repair Count</label>
                  <input type="text" value={pipelineValues.repairs} readOnly />
                </div>

                <div className="calcFieldFull">
                  <label>Live Rainfall (mm)</label>
                  <input
                    type="text"
                    value={rainLoading ? "Loading..." : Number(liveRain?.rain_mm || 0).toFixed(1)}
                    readOnly
                  />
                </div>

                <div className="calcFieldFull">
                  <button
                    onClick={calculateRisk}
                    disabled={!selectedPipeline || rainLoading}
                    className="calcButtonCompact"
                  >
                    Calculate Risk
                  </button>
                </div>
              </div>

              <div className="calcResultCompact">
                <div className="calcResultHeader">
                  <h3>Calculation Result</h3>
                  {result ? (
                    <span className={`calcRiskBadge ${getRiskBadgeClass(result.riskLevel)}`}>
                      {result.riskLevel}
                    </span>
                  ) : null}
                </div>

                {!result ? (
                  <div className="calcResultPlaceholder">
                    Select a pipeline and click <b>Calculate Risk</b> to view the score breakdown.
                  </div>
                ) : (
                  <div className="calcResultList">
                    <div className="calcResultRow">
                      <span>Pipeline ID</span>
                      <strong>{result.pipelineId}</strong>
                    </div>
                    <div className="calcResultRow">
                      <span>Area</span>
                      <strong>{result.areaName}</strong>
                    </div>
                    <div className="calcResultRow">
                      <span>Division</span>
                      <strong>{result.division}</strong>
                    </div>
                    <div className="calcResultRow">
                      <span>Age Score</span>
                      <strong>{result.ageScore}</strong>
                    </div>
                    <div className="calcResultRow">
                      <span>Material Score</span>
                      <strong>{result.materialScore}</strong>
                    </div>
                    <div className="calcResultRow">
                      <span>Incident Score</span>
                      <strong>{result.incidentScore}</strong>
                    </div>
                    <div className="calcResultRow">
                      <span>Rain Score</span>
                      <strong>{result.rainScore}</strong>
                    </div>
                    <div className="calcResultRow">
                      <span>Rain Status</span>
                      <strong>{result.rainStatus}</strong>
                    </div>
                    <div className="calcResultRow calcResultFinal">
                      <span>Final Risk Score</span>
                      <strong>{result.riskScore}</strong>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}