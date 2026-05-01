import { useEffect, useMemo, useState } from "react";
import { supabase } from "../utils/supabaseClient";

const PAGE_SIZE = 1000;
const API_BASE_URL = "http://127.0.0.1:8000";

async function fetchAllPipelines() {
  let allRows = [];
  let from = 0;

  while (true) {
    const to = from + PAGE_SIZE - 1;

    const { data, error } = await supabase
      .from("pipelines")
      .select("*")
      .range(from, to);

    if (error) throw error;

    allRows = [...allRows, ...(data || [])];

    if (!data || data.length < PAGE_SIZE) break;

    from += PAGE_SIZE;
  }

  return allRows;
}

function toNumber(value, fallback = null) {
  if (value === null || value === undefined || value === "") return fallback;
  const n = Number(String(value).replace(/,/g, ""));
  return Number.isNaN(n) ? fallback : n;
}

function getConditionScore(row) {
  return toNumber(row["Condition Score"] ?? row.CONDITION_SCORE ?? row.condition_score, null);
}

function getCriticality(row) {
  return toNumber(row.CRITICALITY ?? row.criticality, null);
}

function getPipeLength(row) {
  return toNumber(row.Shape__Length ?? row.shape__length, 0);
}

function getPipeSize(row) {
  return toNumber(row.PIPE_SIZE ?? row.pipe_size, 0);
}

function calculateDatasetRisk({ conditionScore, criticality }) {
  if (conditionScore !== null) {
    if (conditionScore <= 4) return { level: "High", score: 0.85, reason: "Condition score is poor and requires immediate attention." };
    if (conditionScore <= 7) return { level: "Medium", score: 0.55, reason: "Condition score shows moderate deterioration." };
    return { level: "Low", score: 0.2, reason: "Condition score is healthy." };
  }

  if (criticality !== null) {
    if (criticality >= 8) return { level: "High", score: 0.85, reason: "Criticality is high and asset impact is significant." };
    if (criticality >= 5) return { level: "Medium", score: 0.55, reason: "Criticality indicates moderate operational importance." };
    return { level: "Low", score: 0.2, reason: "Criticality is low." };
  }

  return {
    level: "Low",
    score: 0.2,
    reason: "No condition score or criticality available, defaulting to low risk.",
  };
}

function getBadgeClass(level) {
  if (level === "High") return "calcBadgeHigh";
  if (level === "Medium") return "calcBadgeMedium";
  return "calcBadgeLow";
}

function getAction(level) {
  if (level === "High") return "Immediate inspection and maintenance planning required.";
  if (level === "Medium") return "Schedule preventive inspection in the next maintenance cycle.";
  return "Continue routine monitoring.";
}

export default function RiskCalculator() {
  const [pipelines, setPipelines] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [manualMode, setManualMode] = useState(false);
  const [loading, setLoading] = useState(true);

  const [manual, setManual] = useState({
    conditionScore: "",
    criticality: "",
    material: "",
    pipeSize: "",
    length: "",
    status: "ACTIVE",
  });

  const [result, setResult] = useState(null);

  useEffect(() => {
    async function loadPipelines() {
      try {
        setLoading(true);
        const rows = await fetchAllPipelines();
        setPipelines(rows);
      } catch (error) {
        console.error("Risk calculator fetch error:", error);
        setPipelines([]);
      } finally {
        setLoading(false);
      }
    }

    loadPipelines();
  }, []);

  useEffect(() => {
    if (!pipelines.length || selectedId) return;
    const first = pipelines[0];
    setSelectedId(String(first.WATMAINID || first.OBJECTID || ""));
  }, [pipelines, selectedId]);

  const selectedPipeline = useMemo(() => {
    return (
      pipelines.find(
        (p) =>
          String(p.WATMAINID) === String(selectedId) ||
          String(p.OBJECTID) === String(selectedId)
      ) || null
    );
  }, [pipelines, selectedId]);

  const selectedValues = useMemo(() => {
    if (manualMode) {
      return {
        id: "Manual Input",
        status: manual.status || "ACTIVE",
        material: manual.material || "Unknown",
        pipeSize: toNumber(manual.pipeSize, 0),
        length: toNumber(manual.length, 0),
        conditionScore: toNumber(manual.conditionScore, null),
        criticality: toNumber(manual.criticality, null),
        pressureZone: "Manual",
        category: "Manual Calculation",
      };
    }

    if (!selectedPipeline) {
      return {
        id: "-",
        status: "-",
        material: "-",
        pipeSize: 0,
        length: 0,
        conditionScore: null,
        criticality: null,
        pressureZone: "-",
        category: "-",
      };
    }

    return {
      id: selectedPipeline.WATMAINID || selectedPipeline.OBJECTID || "-",
      status: selectedPipeline.STATUS || "-",
      material: selectedPipeline.MATERIAL || "Unknown",
      pipeSize: getPipeSize(selectedPipeline),
      length: getPipeLength(selectedPipeline),
      conditionScore: getConditionScore(selectedPipeline),
      criticality: getCriticality(selectedPipeline),
      pressureZone: selectedPipeline.PRESSURE_ZONE || "-",
      category: selectedPipeline.CATEGORY || "-",
    };
  }, [manualMode, manual, selectedPipeline]);

  const datasetStats = useMemo(() => {
    const high = pipelines.filter((p) => {
      const r = calculateDatasetRisk({
        conditionScore: getConditionScore(p),
        criticality: getCriticality(p),
      });
      return r.level === "High";
    }).length;

    const medium = pipelines.filter((p) => {
      const r = calculateDatasetRisk({
        conditionScore: getConditionScore(p),
        criticality: getCriticality(p),
      });
      return r.level === "Medium";
    }).length;

    return {
      total: pipelines.length,
      high,
      medium,
    };
  }, [pipelines]);

  async function handleCalculate() {
    try {
      setLoading(true);

      // Manual mode fallback only
      if (manualMode) {
        const risk = calculateDatasetRisk({
          conditionScore: selectedValues.conditionScore,
          criticality: selectedValues.criticality,
        });

        setResult({
          ...selectedValues,
          riskLevel: risk.level,
          riskScore: risk.score,
          failureProbability: Math.round(risk.score * 100),
          risk30: risk.level,
          risk90: risk.level,
          reason: risk.reason,
          reasons: [risk.reason],
          action: getAction(risk.level),
          engineeringReport: null,
        });

        return;
      }

      const response = await fetch(`${API_BASE_URL}/predict/${selectedValues.id}`);

      if (!response.ok) {
        throw new Error("Backend prediction failed");
      }

      const report = await response.json();

      setResult({
        ...selectedValues,

        riskLevel: report.overall_risk_level,
        riskScore: Number(report.overall_risk_score ?? 0),

        likelihoodOfFailure: report.likelihood_of_failure,
        consequenceOfFailure: report.consequence_of_failure,
        healthScore: report.health_score,
        remainingLife: report.estimated_remaining_life_years,

        warning30: report.failure_warning_30_day,
        warning90: report.failure_warning_90_day,
        priority: report.maintenance_priority,

        reasons: report.main_risk_reasons || [],
        action: report.recommended_action,
        note: report.engineering_note,

        engineeringReport: report,
      });
    } catch (error) {
      console.error(error);
      alert("Failed to calculate engineering risk. Make sure backend is running.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="calcPageWrap">
      <div className="calcHero">
        <div>
          <div className="heroEyebrow">Dataset Risk Engine</div>
          <h1>Water Main Risk Calculator</h1>
          <p>
            Calculate risk using real Waterloo/Kitchener dataset fields:
            Condition Score first, then Criticality as fallback.
          </p>
        </div>

        <div className="calcHeroStats">
          <MiniStat label="Assets" value={loading ? "..." : datasetStats.total.toLocaleString()} />
          <MiniStat label="High Risk" value={datasetStats.high.toLocaleString()} tone="danger" />
          <MiniStat label="Medium Risk" value={datasetStats.medium.toLocaleString()} tone="warn" />
        </div>
      </div>

      <div className="calcShell">
        <div className="calcInputPanel">
          <div className="calcModeSwitch">
            <button
              className={!manualMode ? "active" : ""}
              onClick={() => {
                setManualMode(false);
                setResult(null);
              }}
            >
              Select Dataset Pipeline
            </button>
            <button
              className={manualMode ? "active" : ""}
              onClick={() => {
                setManualMode(true);
                setResult(null);
              }}
            >
              Manual Calculation
            </button>
          </div>

          {!manualMode ? (
            <>
              <label className="calcField full">
                Select Pipeline
                <select
                  value={selectedId}
                  onChange={(e) => {
                    setSelectedId(e.target.value);
                    setResult(null);
                  }}
                >
                  {pipelines.map((p) => (
                    <option
                      key={p.OBJECTID || p.WATMAINID}
                      value={p.WATMAINID || p.OBJECTID}
                    >
                      {p.WATMAINID || p.OBJECTID} • {p.MATERIAL || "Unknown"} •{" "}
                      {p.PIPE_SIZE || p.MAP_LABEL || "N/A"} •{" "}
                      {p.PRESSURE_ZONE || "Zone N/A"}
                    </option>
                  ))}
                </select>
              </label>

              {loading ? (
                <div className="calcInfoBox">Loading all pipeline records...</div>
              ) : (
                <PipelinePreview values={selectedValues} />
              )}
            </>
          ) : (
            <div className="manualGrid">
              <label className="calcField">
                Condition Score
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  placeholder="Example: 4"
                  value={manual.conditionScore}
                  onChange={(e) =>
                    setManual((p) => ({ ...p, conditionScore: e.target.value }))
                  }
                />
              </label>

              <label className="calcField">
                Criticality
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  placeholder="Example: 8"
                  value={manual.criticality}
                  onChange={(e) =>
                    setManual((p) => ({ ...p, criticality: e.target.value }))
                  }
                />
              </label>

              <label className="calcField">
                Material
                <input
                  placeholder="Example: DI"
                  value={manual.material}
                  onChange={(e) =>
                    setManual((p) => ({ ...p, material: e.target.value }))
                  }
                />
              </label>

              <label className="calcField">
                Pipe Size
                <input
                  type="number"
                  placeholder="Example: 150"
                  value={manual.pipeSize}
                  onChange={(e) =>
                    setManual((p) => ({ ...p, pipeSize: e.target.value }))
                  }
                />
              </label>

              <label className="calcField">
                Length
                <input
                  type="number"
                  placeholder="Shape Length"
                  value={manual.length}
                  onChange={(e) =>
                    setManual((p) => ({ ...p, length: e.target.value }))
                  }
                />
              </label>

              <label className="calcField">
                Status
                <select
                  value={manual.status}
                  onChange={(e) =>
                    setManual((p) => ({ ...p, status: e.target.value }))
                  }
                >
                  <option>ACTIVE</option>
                  <option>ABANDONED</option>
                  <option>RETIRED</option>
                  <option>UNKNOWN</option>
                </select>
              </label>
            </div>
          )}

          <div className="ruleCard">
            <h3>Risk Rule</h3>
            <div className="ruleGrid">
              <span>Condition ≤ 4</span>
              <b className="dangerText">High</b>
              <span>Condition ≤ 7</span>
              <b className="warnText">Medium</b>
              <span>Condition &gt; 7</span>
              <b className="okText">Low</b>
              <span>Criticality ≥ 8</span>
              <b className="dangerText">High</b>
              <span>Criticality ≥ 5</span>
              <b className="warnText">Medium</b>
            </div>
          </div>

          <button
            className="calculateBtn"
            onClick={handleCalculate}
            disabled={loading && !manualMode}
          >
            Calculate Risk
          </button>
        </div>

        <div className="calcResultPanel">
          {!result ? (
            <div className="resultPlaceholder">
              <div className="placeholderIcon">🧮</div>
              <h2>Ready to calculate</h2>
              <p>Select a pipeline or enter manual values, then click Calculate Risk.</p>
            </div>
          ) : (
            <>
              <div className="resultTop">
                <div>
                  <p>Risk Result</p>
                  <h2>{result.riskLevel}</h2>
                </div>

                <span className={`calcRiskBadge ${getBadgeClass(result.riskLevel)}`}>
                  {result.riskLevel}
                </span>
              </div>

              <div
                className="scoreCircle"
                style={{ "--score": Math.round(result.riskScore * 100) }}
              >
                <div>
                  <strong>{Math.round(result.riskScore * 100)}%</strong>
                  <span>Overall Risk</span>
                </div>
              </div>

              <div className="resultRows">
                <ResultRow label="Pipeline ID" value={result.id} />
                <ResultRow label="Material" value={result.material} />
                <ResultRow label="Pipe Size" value={result.pipeSize || "N/A"} />
                <ResultRow
                  label="Length"
                  value={result.length ? `${result.length.toFixed(1)} m` : "N/A"}
                />
                <ResultRow label="Condition Score" value={result.conditionScore ?? "N/A"} />
                <ResultRow label="Criticality" value={result.criticality ?? "N/A"} />
                <ResultRow
                  label="Overall Risk Score"
                  value={`${Number(result.riskScore ?? 0).toFixed(3)} / 1.00`}
                />
                <ResultRow label="Likelihood of Failure" value={result.likelihoodOfFailure ?? "N/A"} />
                <ResultRow label="Consequence of Failure" value={result.consequenceOfFailure ?? "N/A"} />
                <ResultRow label="Health Score" value={`${result.healthScore ?? "N/A"}%`} />
                <ResultRow
                  label="Estimated Remaining Life"
                  value={`${result.remainingLife ?? "N/A"} years`}
                />
                <ResultRow label="30-Day Failure Warning" value={result.warning30 ?? "N/A"} />
                <ResultRow label="90-Day Failure Warning" value={result.warning90 ?? "N/A"} />
                <ResultRow label="Maintenance Priority" value={result.priority ?? "N/A"} />
              </div>

              <div className="recommendBox">
                <h3>Main Risk Reasons</h3>

                {result.reasons?.length ? (
                  <ol>
                    {result.reasons.map((reason, index) => (
                      <li key={index}>{reason}</li>
                    ))}
                  </ol>
                ) : (
                  <p>No major risk reasons detected.</p>
                )}

                <h3>Recommended Action</h3>
                <b>{result.action}</b>

                {result.note && (
                  <>
                    <h3>Engineering Note</h3>
                    <p>{result.note}</p>
                  </>
                )}
              </div>

              <EngineeringDiagnosisReport report={result.engineeringReport} />
            </>
          )}
        </div>
      </div>

      <style>{`
        .calcPageWrap {
          width: 100%;
          padding: 28px;
          animation: fadeIn 0.35s ease;
        }

        .calcHero {
          background: linear-gradient(135deg, #ffffff, #eef8fc, #dff2fa);
          border: 1px solid #c8e3ef;
          border-radius: 22px;
          padding: 28px;
          display: flex;
          justify-content: space-between;
          gap: 20px;
          margin-bottom: 22px;
          box-shadow: 0 12px 30px rgba(20, 65, 90, 0.08);
        }

        .heroEyebrow {
          display: inline-block;
          background: #e2f4fb;
          color: #0b6fa4;
          border: 1px solid #b9ddeb;
          font-weight: 900;
          font-size: 12px;
          letter-spacing: 1px;
          padding: 7px 12px;
          border-radius: 999px;
          text-transform: uppercase;
          margin-bottom: 10px;
        }

        .calcHero h1 {
          margin: 0;
          font-size: 30px;
          color: #123047;
        }

        .calcHero p {
          margin: 8px 0 0;
          max-width: 720px;
          color: #5f7688;
          font-weight: 600;
          line-height: 1.6;
        }

        .calcHeroStats {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        .miniStat {
          min-width: 120px;
          background: white;
          border: 1px solid #d7e6ef;
          border-radius: 16px;
          padding: 14px;
          box-shadow: 0 8px 22px rgba(20, 65, 90, 0.06);
        }

        .miniStat span {
          display: block;
          color: #5f7688;
          font-size: 12px;
          font-weight: 900;
          margin-bottom: 6px;
        }

        .miniStat strong {
          color: #123047;
          font-size: 24px;
          font-weight: 950;
        }

        .miniStat.danger strong {
          color: #dc2626;
        }

        .miniStat.warn strong {
          color: #d97706;
        }

        .calcShell {
          display: grid;
          grid-template-columns: 1.15fr 0.85fr;
          gap: 22px;
        }

        .calcInputPanel,
        .calcResultPanel {
          background: white;
          border: 1px solid #d7e6ef;
          border-radius: 22px;
          padding: 22px;
          box-shadow: 0 10px 26px rgba(20, 65, 90, 0.08);
        }

        .calcModeSwitch {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          margin-bottom: 18px;
          background: #f6fafc;
          border: 1px solid #d7e6ef;
          padding: 6px;
          border-radius: 16px;
        }

        .calcModeSwitch button {
          border: none;
          border-radius: 12px;
          background: transparent;
          color: #5f7688;
          font-weight: 900;
          height: 42px;
          cursor: pointer;
        }

        .calcModeSwitch button.active {
          background: #0b6fa4;
          color: white;
          box-shadow: 0 8px 20px rgba(11, 111, 164, 0.18);
        }

        .calcField {
          display: grid;
          gap: 7px;
          color: #31546a;
          font-size: 13px;
          font-weight: 900;
        }

        .calcField.full {
          margin-bottom: 18px;
        }

        .calcField input,
        .calcField select {
          height: 46px;
          border: 1px solid #cbdde7;
          border-radius: 12px;
          padding: 0 14px;
          background: white;
          color: #123047;
          font-weight: 700;
        }

        .manualGrid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px;
        }

        .previewGrid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
          margin-bottom: 18px;
        }

        .previewItem {
          background: #f6fafc;
          border: 1px solid #d7e6ef;
          border-radius: 16px;
          padding: 14px;
        }

        .previewItem span {
          display: block;
          color: #5f7688;
          font-size: 12px;
          font-weight: 900;
          margin-bottom: 6px;
        }

        .previewItem strong {
          color: #123047;
          font-size: 15px;
          font-weight: 950;
        }

        .calcInfoBox {
          background: #f6fafc;
          border: 1px dashed #b9ddeb;
          border-radius: 16px;
          padding: 20px;
          color: #5f7688;
          font-weight: 900;
          text-align: center;
        }

        .ruleCard {
          margin-top: 18px;
          background: #f6fafc;
          border: 1px solid #d7e6ef;
          border-radius: 18px;
          padding: 16px;
        }

        .ruleCard h3 {
          margin: 0 0 12px;
          color: #123047;
        }

        .ruleGrid {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 9px 14px;
          color: #5f7688;
          font-size: 13px;
          font-weight: 800;
        }

        .dangerText { color: #dc2626; }
        .warnText { color: #d97706; }
        .okText { color: #16875d; }

        .calculateBtn {
          margin-top: 18px;
          width: 100%;
          height: 50px;
          border: none;
          border-radius: 14px;
          background: #0b6fa4;
          color: white;
          font-size: 16px;
          font-weight: 950;
          cursor: pointer;
          box-shadow: 0 8px 20px rgba(11, 111, 164, 0.2);
        }

        .calculateBtn:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        .calcResultPanel {
          min-height: 520px;
        }

        .resultPlaceholder {
          height: 100%;
          min-height: 480px;
          display: grid;
          place-items: center;
          text-align: center;
          align-content: center;
          color: #5f7688;
        }

        .placeholderIcon {
          font-size: 52px;
          margin-bottom: 12px;
        }

        .resultPlaceholder h2 {
          margin: 0;
          color: #123047;
        }

        .resultPlaceholder p {
          max-width: 320px;
          line-height: 1.6;
          font-weight: 600;
        }

        .resultTop {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          align-items: flex-start;
        }

        .resultTop p {
          margin: 0;
          color: #5f7688;
          font-weight: 900;
        }

        .resultTop h2 {
          margin: 6px 0 0;
          font-size: 36px;
          color: #123047;
        }

        .calcRiskBadge {
          color: white;
          border-radius: 999px;
          padding: 8px 14px;
          font-size: 12px;
          font-weight: 950;
        }

        .calcBadgeHigh { background: #dc2626; }
        .calcBadgeMedium { background: #d97706; }
        .calcBadgeLow { background: #16875d; }

        .scoreCircle {
          width: 170px;
          height: 170px;
          border-radius: 50%;
          margin: 24px auto;
          display: grid;
          place-items: center;
          background:
            radial-gradient(circle at center, white 52%, transparent 53%),
            conic-gradient(#0b6fa4 calc(var(--score, 70) * 1%), #dfeaf0 0);
          border: 1px solid #d7e6ef;
        }

        .scoreCircle strong {
          display: block;
          color: #123047;
          font-size: 34px;
          font-weight: 950;
          text-align: center;
        }

        .scoreCircle span {
          display: block;
          color: #5f7688;
          font-size: 12px;
          font-weight: 900;
          text-align: center;
        }

        .resultRows {
          display: grid;
          gap: 10px;
        }

        .resultRow {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          padding-bottom: 9px;
          border-bottom: 1px solid #e4edf3;
        }

        .resultRow span {
          color: #5f7688;
          font-weight: 800;
        }

        .resultRow strong {
          color: #123047;
          text-align: right;
        }

        .recommendBox {
          margin-top: 18px;
          background: #eef8fc;
          border: 1px solid #c8e3ef;
          border-radius: 16px;
          padding: 16px;
        }

        .recommendBox h3 {
          margin: 0 0 8px;
          color: #123047;
        }

        .recommendBox p,
        .recommendBox li {
          margin: 0 0 10px;
          color: #5f7688;
          font-weight: 700;
          line-height: 1.5;
        }

        .recommendBox ol {
          margin: 0 0 14px 20px;
          padding: 0;
        }

        .recommendBox b {
          color: #0b6fa4;
        }



        .diagnosisBox {
          margin-top: 18px;
          background: #ffffff;
          border: 1px solid #d7e6ef;
          border-radius: 18px;
          padding: 16px;
        }

        .diagnosisBox h2 {
          margin: 0 0 6px;
          color: #123047;
          font-size: 20px;
        }

        .diagnosisIntro {
          margin: 0 0 14px;
          color: #5f7688;
          font-weight: 700;
          line-height: 1.5;
        }

        .diagnosisGrid {
          display: grid;
          gap: 12px;
        }

        .diagnosisCard {
          background: #f6fafc;
          border: 1px solid #d7e6ef;
          border-radius: 16px;
          padding: 14px;
        }

        .diagnosisCard h3 {
          margin: 0 0 10px;
          color: #123047;
          font-size: 15px;
        }

        .diagnosisRows {
          display: grid;
          gap: 8px;
        }

        .diagnosisItem {
          display: flex;
          justify-content: space-between;
          gap: 14px;
          border-bottom: 1px solid #e4edf3;
          padding-bottom: 7px;
          color: #5f7688;
          font-weight: 800;
          font-size: 13px;
        }

        .diagnosisItem:last-child {
          border-bottom: none;
          padding-bottom: 0;
        }

        .diagnosisItem strong {
          color: #123047;
          text-align: right;
        }

        .diagnosisNote {
          margin: 10px 0 0;
          color: #5f7688;
          font-weight: 700;
          line-height: 1.55;
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(5px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @media (max-width: 1150px) {
          .calcShell {
            grid-template-columns: 1fr;
          }

          .previewGrid {
            grid-template-columns: 1fr 1fr;
          }
        }

        @media (max-width: 780px) {
          .calcPageWrap {
            padding: 18px;
          }

          .calcHero {
            display: grid;
          }

          .calcHeroStats {
            justify-content: flex-start;
          }

          .manualGrid,
          .previewGrid,
          .calcModeSwitch {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}

function MiniStat({ label, value, tone = "" }) {
  return (
    <div className={`miniStat ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function PipelinePreview({ values }) {
  return (
    <div className="previewGrid">
      <PreviewItem label="Pipeline ID" value={values.id} />
      <PreviewItem label="Status" value={values.status} />
      <PreviewItem label="Material" value={values.material} />
      <PreviewItem label="Pipe Size" value={values.pipeSize || "N/A"} />
      <PreviewItem
        label="Length"
        value={values.length ? `${values.length.toFixed(1)} m` : "N/A"}
      />
      <PreviewItem label="Pressure Zone" value={values.pressureZone} />
      <PreviewItem label="Category" value={values.category} />
      <PreviewItem label="Condition Score" value={values.conditionScore ?? "N/A"} />
      <PreviewItem label="Criticality" value={values.criticality ?? "N/A"} />
    </div>
  );
}

function PreviewItem({ label, value }) {
  return (
    <div className="previewItem">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function EngineeringDiagnosisReport({ report }) {
  const diagnosis = report?.diagnosis;

  if (!diagnosis) return null;

  const current = diagnosis.current_condition || {};
  const likelihood = diagnosis.failure_likelihood || {};
  const consequence = diagnosis.failure_consequence || {};
  const warning = diagnosis.future_warning || {};
  const action = diagnosis.action_plan || {};

  return (
    <div className="diagnosisBox">
      <h2>Engineering Diagnosis Report</h2>
      <p className="diagnosisIntro">
        This report explains how the final risk result was calculated and supports
        maintenance decision-making using current condition, failure likelihood,
        consequence, future warning and action planning.
      </p>

      <div className="diagnosisGrid">
        <DiagnosisCard
          title="1. Current Condition"
          items={[
            ["Actual Condition Score", current.condition_score],
            ["Health Score", formatPercent(current.health_score)],
            ["Condition Category", current.condition_category],
          ]}
        />

        <DiagnosisCard
          title="2. Failure Likelihood"
          items={[
            ["Age Risk", likelihood.age_risk ?? likelihood.estimated_age_risk ?? "Dataset based"],
            [
              "Condition Risk",
              likelihood.condition_risk ??
                likelihood.condition_risk_level ??
                scoreToLevel(likelihood.condition_risk_score),
            ],
            [
              "Material Risk",
              likelihood.material_risk ??
                likelihood.material_risk_level ??
                scoreToLevel(likelihood.material_risk_score),
            ],
            ["Environment Risk", likelihood.environment_risk ?? likelihood.location_risk ?? "Moderate"],
            [
              "Status Risk",
              likelihood.status_risk ??
                likelihood.status_risk_level ??
                scoreToLevel(likelihood.status_risk_score),
            ],
          ]}
        />

        <DiagnosisCard
          title="3. Failure Consequence"
          items={[
            [
              "Criticality Impact",
              consequence.criticality_impact ??
                consequence.overall ??
                scoreToLevel((consequence.criticality_score ?? 0) / 10),
            ],
            [
              "Pipe Size Impact",
              consequence.pipe_size_impact ??
                scoreToLevel(consequence.pipe_size_impact_score) ??
                consequence.pipe_size,
            ],
            [
              "Pipe Length Impact",
              consequence.pipe_length_impact ??
                scoreToLevel(consequence.pipe_length_impact_score) ??
                consequence.pipe_length,
            ],
            [
              "Pressure Zone / Category Impact",
              formatZoneCategory(
                consequence.pressure_zone_impact ?? consequence.pressure_zone,
                consequence.category_impact
              ),
            ],
          ]}
        />

        <DiagnosisCard
          title="4. Future Warning"
          items={[
            [
              "Remaining Useful Life",
              formatYears(
                warning.estimated_remaining_useful_life_years ??
                  warning.remaining_useful_life ??
                  warning.remaining_life_years
              ),
            ],
            ["30-Day Warning", warning.warning_30_day ?? warning.failure_warning_30_day ?? warning.risk_30_day],
            ["90-Day Warning", warning.warning_90_day ?? warning.failure_warning_90_day ?? warning.risk_90_day],
            ["Risk Trend", warning.risk_trend],
          ]}
        />

        <div className="diagnosisCard">
          <h3>5. Action Plan</h3>
          <div className="diagnosisRows">
            <DiagnosisItem
              label="Priority Level"
              value={action.priority_level ?? action.priority}
            />
            <DiagnosisItem label="Recommended Action" value={action.recommended_action} />
          </div>
          {(action.engineering_note || action.note) && (
            <p className="diagnosisNote">{action.engineering_note || action.note}</p>
          )}
        </div>
      </div>
    </div>
  );
}

function DiagnosisCard({ title, items }) {
  return (
    <div className="diagnosisCard">
      <h3>{title}</h3>
      <div className="diagnosisRows">
        {items.map(([label, value]) => (
          <DiagnosisItem key={label} label={label} value={value} />
        ))}
      </div>
    </div>
  );
}

function DiagnosisItem({ label, value }) {
  return (
    <div className="diagnosisItem">
      <span>{label}</span>
      <strong>{value ?? "N/A"}</strong>
    </div>
  );
}

function formatPercent(value) {
  if (value === null || value === undefined || value === "") return "N/A";
  return `${value}%`;
}

function formatYears(value) {
  if (value === null || value === undefined || value === "") return "N/A";
  return `${value} years`;
}

function scoreToLevel(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (Number.isNaN(n)) return value;
  if (n >= 0.7) return "High";
  if (n >= 0.4) return "Medium";
  return "Low";
}

function formatZoneCategory(zone, category) {
  const hasZone = zone !== null && zone !== undefined && zone !== "";
  const hasCategory = category !== null && category !== undefined && category !== "";
  if (hasZone && hasCategory) return `${zone} / ${category}`;
  if (hasZone) return zone;
  if (hasCategory) return category;
  return "N/A";
}

function ResultRow({ label, value }) {
  return (
    <div className="resultRow">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}