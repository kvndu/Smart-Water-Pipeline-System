import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../utils/supabaseClient";

function toNumber(value, fallback = null) {
  if (value === null || value === undefined || value === "") return fallback;
  const n = Number(String(value).replace(/,/g, ""));
  return Number.isNaN(n) ? fallback : n;
}

function getConditionScore(p) {
  return toNumber(p["Condition Score"] ?? p.CONDITION_SCORE, null);
}

function getCriticality(p) {
  return toNumber(p.CRITICALITY, null);
}

function getLength(p) {
  return toNumber(p.Shape__Length, 0);
}

function getPipelineId(p) {
  return p.WATMAINID || p.OBJECTID || "N/A";
}

function getRiskLevel(p) {
  const condition = getConditionScore(p);
  const criticality = getCriticality(p);

  if (condition !== null) {
    if (condition <= 4) return "HIGH";
    if (condition <= 7) return "MEDIUM";
    return "LOW";
  }

  if (criticality !== null) {
    if (criticality >= 8) return "HIGH";
    if (criticality >= 5) return "MEDIUM";
  }

  return "LOW";
}

function getRiskScore(risk) {
  if (risk === "HIGH") return 0.85;
  if (risk === "MEDIUM") return 0.55;
  return 0.2;
}

function getPriority(p) {
  const risk = getRiskLevel(p);
  const criticality = getCriticality(p) ?? 0;

  if (risk === "HIGH" || criticality >= 8) return "Critical";
  if (risk === "MEDIUM" || criticality >= 5) return "Moderate";
  return "Low";
}

function getAction(priority) {
  if (priority === "Critical") return "Immediate field inspection required";
  if (priority === "Moderate") return "Schedule preventive maintenance";
  return "Routine monitoring";
}

function riskClass(risk) {
  if (risk === "HIGH") return "danger";
  if (risk === "MEDIUM") return "warn";
  return "ok";
}

function priorityClass(priority) {
  if (priority === "Critical") return "danger";
  if (priority === "Moderate") return "warn";
  return "ok";
}

function toCSV(rows) {
  if (!rows.length) return "";

  const headers = Object.keys(rows[0]);

  return [
    headers.join(","),
    ...rows.map((row) =>
      headers
        .map((header) => `"${String(row[header] ?? "").replaceAll('"', '""')}"`)
        .join(",")
    ),
  ].join("\n");
}

function downloadCSV(filename, rows) {
  const blob = new Blob([toCSV(rows)], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");

  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
}

export default function Reports() {
  const [pipelines, setPipelines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    async function loadReportsData() {
      setLoading(true);
      setErrorMsg("");

      const { data, error } = await supabase
        .from("pipelines")
        .select("*")
        .limit(2000);

      if (error) {
        console.error("Reports fetch error:", error);
        setPipelines([]);
        setErrorMsg("Failed to load reports data.");
      } else {
        setPipelines(data || []);
      }

      setLoading(false);
    }

    loadReportsData();
  }, []);

  const generatedAt = useMemo(() => new Date(), []);

  const enriched = useMemo(() => {
    return pipelines.map((p) => {
      const riskLevel = getRiskLevel(p);
      const priority = getPriority(p);

      return {
        ...p,
        pipelineId: getPipelineId(p),
        conditionScore: getConditionScore(p),
        criticality: getCriticality(p),
        pipeLength: getLength(p),
        riskLevel,
        riskScore: getRiskScore(riskLevel),
        priority,
        action: getAction(priority),
      };
    });
  }, [pipelines]);

  const stats = useMemo(() => {
    const total = enriched.length;
    const high = enriched.filter((p) => p.riskLevel === "HIGH").length;
    const medium = enriched.filter((p) => p.riskLevel === "MEDIUM").length;
    const low = enriched.filter((p) => p.riskLevel === "LOW").length;
    const critical = enriched.filter((p) => p.priority === "Critical").length;
    const moderate = enriched.filter((p) => p.priority === "Moderate").length;

    const conditionValues = enriched
      .map((p) => p.conditionScore)
      .filter((v) => v !== null);

    const avgCondition =
      conditionValues.length > 0
        ? (
            conditionValues.reduce((sum, value) => sum + value, 0) /
            conditionValues.length
          ).toFixed(2)
        : "N/A";

    const totalLength = enriched.reduce(
      (sum, p) => sum + Number(p.pipeLength || 0),
      0
    );

    return {
      total,
      high,
      medium,
      low,
      critical,
      moderate,
      avgCondition,
      totalLength,
      systemHealth: total ? Math.round((low / total) * 100) : 0,
    };
  }, [enriched]);

  const priorityAssets = useMemo(() => {
    const riskOrder = { HIGH: 3, MEDIUM: 2, LOW: 1 };

    return [...enriched]
      .sort((a, b) => {
        const riskDiff = riskOrder[b.riskLevel] - riskOrder[a.riskLevel];
        if (riskDiff !== 0) return riskDiff;

        return Number(b.criticality || 0) - Number(a.criticality || 0);
      })
      .slice(0, 10);
  }, [enriched]);

  const zoneSummary = useMemo(() => {
    const zones = {};

    enriched.forEach((p) => {
      const zone = p.PRESSURE_ZONE || "Unknown Zone";

      if (!zones[zone]) {
        zones[zone] = {
          name: zone,
          total: 0,
          high: 0,
          medium: 0,
          low: 0,
          critical: 0,
        };
      }

      zones[zone].total += 1;
      if (p.riskLevel === "HIGH") zones[zone].high += 1;
      if (p.riskLevel === "MEDIUM") zones[zone].medium += 1;
      if (p.riskLevel === "LOW") zones[zone].low += 1;
      if (p.priority === "Critical") zones[zone].critical += 1;
    });

    return Object.values(zones)
      .sort((a, b) => b.critical + b.high + b.medium - (a.critical + a.high + a.medium))
      .slice(0, 6);
  }, [enriched]);

  const materialSummary = useMemo(() => {
    const materials = {};

    enriched.forEach((p) => {
      const material = p.MATERIAL || "Unknown";

      if (!materials[material]) {
        materials[material] = {
          name: material,
          total: 0,
          high: 0,
          medium: 0,
        };
      }

      materials[material].total += 1;
      if (p.riskLevel === "HIGH") materials[material].high += 1;
      if (p.riskLevel === "MEDIUM") materials[material].medium += 1;
    });

    return Object.values(materials)
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);
  }, [enriched]);

  const exportRows = useMemo(() => {
    return enriched.map((p) => ({
      OBJECTID: p.OBJECTID,
      WATMAINID: p.WATMAINID,
      STATUS: p.STATUS,
      PRESSURE_ZONE: p.PRESSURE_ZONE,
      MAP_LABEL: p.MAP_LABEL,
      CATEGORY: p.CATEGORY,
      PIPE_SIZE: p.PIPE_SIZE,
      MATERIAL: p.MATERIAL,
      LINED: p.LINED,
      CONDITION_SCORE: p.conditionScore ?? "",
      CRITICALITY: p.criticality ?? "",
      Shape__Length: p.pipeLength ?? "",
      risk_score: p.riskScore.toFixed(3),
      risk_level: p.riskLevel,
      priority: p.priority,
      recommended_action: p.action,
    }));
  }, [enriched]);

  function handleDownloadCSV() {
    setDownloading("csv");

    setTimeout(() => {
      downloadCSV("Waterloo_Kitchener_Water_Mains_Report.csv", exportRows);
      setDownloading("");
    }, 300);
  }

  function handlePrintReport() {
    setDownloading("print");

    setTimeout(() => {
      window.print();
      setDownloading("");
    }, 300);
  }

  return (
    <div className="reportsPage">
      <div className="reportHero">
        <div>
          <div className="heroEyebrow">Reporting</div>
          <h1>Water Mains Report</h1>
        </div>

        <div className="reportActions noPrint">
          <button onClick={handleDownloadCSV} disabled={!!downloading}>
            📊 {downloading === "csv" ? "Generating..." : "Export CSV"}
          </button>
          <button className="primary" onClick={handlePrintReport} disabled={!!downloading}>
            🖨️ {downloading === "print" ? "Preparing..." : "Print Report"}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="panel">Loading report data...</div>
      ) : errorMsg ? (
        <div className="panel errorText">{errorMsg}</div>
      ) : (
        <>
          <section className="panel">
            <div className="sectionHead">
              <h2>Report Details</h2>
              <p>Generated report context and dataset source.</p>
            </div>

            <div className="metaGrid">
              <InfoCard label="Dataset" value="Waterloo/Kitchener Water Mains" />
              <InfoCard label="Generated Date" value={generatedAt.toLocaleDateString()} />
              <InfoCard label="Generated Time" value={generatedAt.toLocaleTimeString()} />
              <InfoCard label="Data Source" value="Supabase pipelines table" />
            </div>
          </section>

          <section className="kpiGrid">
            <Kpi title="Total Assets" value={stats.total} />
            <Kpi title="High Risk" value={stats.high} tone="danger" />
            <Kpi title="Medium Risk" value={stats.medium} tone="warn" />
            <Kpi title="Critical Tasks" value={stats.critical} tone="danger" />
            <Kpi title="Avg. Condition" value={stats.avgCondition} tone="blue" />
            <Kpi title="System Health" value={`${stats.systemHealth}%`} tone="ok" />
          </section>

          <section className="panel">
            <div className="sectionHead">
              <h2>Executive Summary</h2>
              <p>Readable summary for project report or presentation.</p>
            </div>

            <div className="summaryGrid">
              <SummaryCard
                title="Asset Risk Status"
                text={`Out of ${stats.total} visible water main assets, ${stats.high} are classified as High risk, ${stats.medium} are Medium risk, and ${stats.low} are Low risk.`}
              />
              <SummaryCard
                title="Maintenance Priority"
                text={`${stats.critical} assets require critical attention. ${stats.moderate} assets should be scheduled for preventive maintenance.`}
              />
              <SummaryCard
                title="Condition Insight"
                text={`Average condition score is ${stats.avgCondition}. Lower condition score means weaker asset condition and higher maintenance priority.`}
              />
              <SummaryCard
                title="Network Coverage"
                text={`The currently loaded records represent ${stats.totalLength.toFixed(1)} metres of visible Shape Length from the dataset.`}
              />
            </div>
          </section>

          <section className="reportGrid">
            <div className="panel">
              <div className="sectionHead">
                <h2>Priority Action Plan</h2>
                <p>What the maintenance team should focus on first.</p>
              </div>

              <div className="actionCards">
                <ActionCard
                  tone="danger"
                  title="Immediate Inspection"
                  value={stats.critical}
                  text="Send field team to inspect high-risk or high-criticality assets."
                />
                <ActionCard
                  tone="warn"
                  title="Preventive Maintenance"
                  value={stats.moderate}
                  text="Add medium-risk assets to upcoming maintenance schedule."
                />
                <ActionCard
                  tone="ok"
                  title="Routine Monitoring"
                  value={stats.low}
                  text="Low-risk assets can continue under normal monitoring."
                />
              </div>
            </div>

            <div className="panel">
              <div className="sectionHead">
                <h2>Pressure Zone Summary</h2>
                <p>Zones with highest operational attention.</p>
              </div>

              <div className="zoneList">
                {zoneSummary.map((zone) => (
                  <div key={zone.name} className="miniReportCard">
                    <div>
                      <h3>{zone.name}</h3>
                      <p>{zone.total} assets</p>
                    </div>
                    <div className="miniStats">
                      <span className="dangerText">{zone.high} High</span>
                      <span className="warnText">{zone.medium} Medium</span>
                      <span>{zone.critical} Critical</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="panel">
            <div className="sectionHead">
              <h2>Material Summary</h2>
              <p>Most common materials and their risk exposure.</p>
            </div>

            <div className="materialGrid">
              {materialSummary.map((material) => (
                <div key={material.name} className="materialCard">
                  <h3>{material.name}</h3>
                  <strong>{material.total}</strong>
                  <p>
                    {material.high} high risk • {material.medium} medium risk
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section className="panel">
            <div className="sectionHead">
              <h2>Top Priority Assets</h2>
              <p>Short list of assets that need the most attention.</p>
            </div>

            <div className="priorityList">
              {priorityAssets.map((p) => (
                <div key={`${p.pipelineId}-${p.OBJECTID}`} className="priorityCard">
                  <div>
                    <h3>
                      <Link to={`/pipelines/${p.pipelineId}`}>Pipeline #{p.pipelineId}</Link>
                    </h3>
                    <p>
                      {p.MATERIAL || "Unknown"} • {p.PIPE_SIZE || p.MAP_LABEL || "N/A"} •{" "}
                      {p.PRESSURE_ZONE || "Unknown zone"}
                    </p>
                    <small>
                      Condition: {p.conditionScore ?? "N/A"} • Criticality:{" "}
                      {p.criticality ?? "N/A"}
                    </small>
                  </div>

                  <div className="priorityRight">
                    <span className={`badge ${riskClass(p.riskLevel)}`}>
                      {p.riskLevel}
                    </span>
                    <span className={`badge ${priorityClass(p.priority)}`}>
                      {p.priority}
                    </span>
                    <b>{p.action}</b>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </>
      )}

      <style>{`
        .reportsPage {
          width: 100%;
          padding: 28px;
          animation: fadeIn 0.35s ease;
        }

        .reportHero {
          display: flex;
          justify-content: space-between;
          gap: 20px;
          align-items: flex-start;
          padding: 28px;
          border-radius: 22px;
          margin-bottom: 22px;
          background: linear-gradient(135deg, #ffffff, #eef8fc, #dff2fa);
          border: 1px solid #c8e3ef;
          box-shadow: 0 10px 26px rgba(20, 65, 90, 0.08);
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

        .reportHero h1 {
          margin: 0;
          color: #123047;
          font-size: 30px;
        }

        .reportHero p {
          margin: 8px 0 0;
          color: #5f7688;
          max-width: 760px;
          font-weight: 600;
          line-height: 1.6;
        }

        .reportActions {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        .reportActions button {
          height: 42px;
          border-radius: 12px;
          padding: 0 14px;
          font-weight: 900;
          cursor: pointer;
          border: 1px solid #c8e3ef;
          background: #eef8fc;
          color: #0b6fa4;
        }

        .reportActions button.primary {
          background: #0b6fa4;
          color: white;
          border-color: #0b6fa4;
        }

        .panel,
        .reportKpi {
          background: white;
          border: 1px solid #d7e6ef;
          border-radius: 20px;
          box-shadow: 0 10px 26px rgba(20, 65, 90, 0.08);
        }

        .panel {
          padding: 20px;
          margin-bottom: 22px;
        }

        .sectionHead h2 {
          margin: 0;
          color: #123047;
          font-size: 22px;
        }

        .sectionHead p {
          margin: 6px 0 16px;
          color: #5f7688;
          font-weight: 600;
        }

        .metaGrid,
        .summaryGrid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 14px;
        }

        .infoCard,
        .summaryCard,
        .miniReportCard,
        .materialCard,
        .priorityCard,
        .actionCard {
          background: #f6fafc;
          border: 1px solid #d7e6ef;
          border-radius: 16px;
          padding: 16px;
        }

        .infoCard span,
        .summaryCard span {
          display: block;
          color: #5f7688;
          font-size: 12px;
          font-weight: 900;
          margin-bottom: 6px;
        }

        .infoCard strong,
        .summaryCard strong {
          color: #123047;
          font-size: 14px;
          line-height: 1.5;
        }

        .kpiGrid {
          display: grid;
          grid-template-columns: repeat(6, 1fr);
          gap: 16px;
          margin-bottom: 22px;
        }

        .reportKpi {
          padding: 18px;
        }

        .reportKpi.danger {
          background: #fdeaea;
        }

        .reportKpi.warn {
          background: #fff4dd;
        }

        .reportKpi.blue {
          background: #e2f4fb;
        }

        .reportKpi.ok {
          background: #e4f7ef;
        }

        .reportKpi span {
          color: #5f7688;
          font-size: 13px;
          font-weight: 900;
        }

        .reportKpi strong {
          display: block;
          margin-top: 8px;
          color: #123047;
          font-size: 28px;
          font-weight: 950;
        }

        .reportGrid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 22px;
        }

        .actionCards,
        .zoneList,
        .priorityList {
          display: grid;
          gap: 12px;
        }

        .actionCard.danger {
          background: #fdeaea;
        }

        .actionCard.warn {
          background: #fff4dd;
        }

        .actionCard.ok {
          background: #e4f7ef;
        }

        .actionCard span {
          color: #5f7688;
          font-size: 13px;
          font-weight: 900;
        }

        .actionCard strong {
          display: block;
          margin-top: 6px;
          color: #123047;
          font-size: 28px;
          font-weight: 950;
        }

        .actionCard p {
          margin: 8px 0 0;
          color: #31546a;
          font-weight: 700;
          line-height: 1.5;
        }

        .miniReportCard,
        .priorityCard {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          align-items: center;
        }

        .miniReportCard h3,
        .materialCard h3,
        .priorityCard h3 {
          margin: 0;
          color: #123047;
          font-size: 16px;
        }

        .miniReportCard p,
        .materialCard p,
        .priorityCard p {
          margin: 5px 0 0;
          color: #5f7688;
          font-size: 13px;
          font-weight: 700;
        }

        .miniStats {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          justify-content: flex-end;
          color: #31546a;
          font-size: 12px;
          font-weight: 900;
        }

        .dangerText {
          color: #dc2626;
        }

        .warnText {
          color: #d97706;
        }

        .materialGrid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 14px;
        }

        .materialCard strong {
          display: block;
          margin-top: 8px;
          color: #0b6fa4;
          font-size: 28px;
          font-weight: 950;
        }

        .priorityCard a {
          color: #0b6fa4;
          text-decoration: none;
        }

        .priorityCard small {
          display: block;
          margin-top: 6px;
          color: #31546a;
          font-weight: 800;
        }

        .priorityRight {
          display: grid;
          justify-items: end;
          gap: 7px;
          text-align: right;
        }

        .priorityRight b {
          color: #31546a;
          font-size: 12px;
        }

        .badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 999px;
          padding: 6px 10px;
          font-size: 11px;
          font-weight: 950;
          border: 1px solid transparent;
          width: fit-content;
        }

        .badge.danger {
          background: #fdeaea;
          color: #a83232;
          border-color: #f4bbbb;
        }

        .badge.warn {
          background: #fff4dd;
          color: #8a5a08;
          border-color: #f3d48a;
        }

        .badge.ok {
          background: #e4f7ef;
          color: #0f6848;
          border-color: #b8ead6;
        }

        .errorText {
          color: #dc2626;
          font-weight: 900;
        }

        @media print {
          .noPrint {
            display: none !important;
          }

          .reportsPage {
            padding: 0 !important;
          }

          .panel,
          .reportHero,
          .reportKpi {
            box-shadow: none !important;
          }
        }

        @media (max-width: 1200px) {
          .kpiGrid {
            grid-template-columns: repeat(3, 1fr);
          }

          .reportGrid,
          .metaGrid,
          .summaryGrid,
          .materialGrid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 700px) {
          .reportsPage {
            padding: 18px;
          }

          .reportHero {
            display: grid;
          }

          .reportActions {
            justify-content: flex-start;
          }

          .kpiGrid {
            grid-template-columns: 1fr;
          }

          .miniReportCard,
          .priorityCard {
            align-items: flex-start;
            flex-direction: column;
          }

          .priorityRight {
            justify-items: start;
            text-align: left;
          }
        }
      `}</style>
    </div>
  );
}

function Kpi({ title, value, tone = "" }) {
  return (
    <div className={`reportKpi ${tone}`}>
      <span>{title}</span>
      <strong>{value}</strong>
    </div>
  );
}

function InfoCard({ label, value }) {
  return (
    <div className="infoCard">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function SummaryCard({ title, text }) {
  return (
    <div className="summaryCard">
      <span>{title}</span>
      <strong>{text}</strong>
    </div>
  );
}

function ActionCard({ title, value, text, tone = "" }) {
  return (
    <div className={`actionCard ${tone}`}>
      <span>{title}</span>
      <strong>{value}</strong>
      <p>{text}</p>
    </div>
  );
}