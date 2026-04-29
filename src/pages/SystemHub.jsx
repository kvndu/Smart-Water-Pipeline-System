import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../utils/supabaseClient";

const PAGE_SIZE = 1000;

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

    const rows = data || [];
    allRows = [...allRows, ...rows];

    if (rows.length < PAGE_SIZE) break;

    from += PAGE_SIZE;
  }

  return allRows;
}

function toNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(String(value).replace(/,/g, ""));
  return Number.isNaN(n) ? null : n;
}

function getConditionScore(p) {
  return toNumber(p["Condition Score"] ?? p.CONDITION_SCORE ?? p.condition_score);
}

function getCriticality(p) {
  return toNumber(p.CRITICALITY ?? p.criticality);
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

function getPriority(p) {
  const risk = getRiskLevel(p);
  const criticality = getCriticality(p) ?? 0;

  if (risk === "HIGH" || criticality >= 8) return "IMMEDIATE";
  if (risk === "MEDIUM" || criticality >= 5) return "PLANNED";
  return "ROUTINE";
}

function getAction(p) {
  const priority = getPriority(p);

  if (priority === "IMMEDIATE") {
    return "Send field team for inspection and prepare repair plan.";
  }

  if (priority === "PLANNED") {
    return "Add to preventive maintenance schedule.";
  }

  return "Continue routine monitoring.";
}

function getRiskColor(risk) {
  if (risk === "HIGH") return "#dc2626";
  if (risk === "MEDIUM") return "#d97706";
  return "#0b6fa4";
}

function getPipelineId(p) {
  return p.WATMAINID || p.watmainid || p.OBJECTID || p.objectid || "N/A";
}

export default function SystemHub() {
  const [pipelines, setPipelines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    async function loadPipelines() {
      try {
        setLoading(true);
        setErrorMsg("");

        const rows = await fetchAllPipelines();
        setPipelines(rows);
      } catch (error) {
        console.error("System Hub fetch error:", error);
        setPipelines([]);
        setErrorMsg("Failed to load System Hub data from Supabase.");
      } finally {
        setLoading(false);
      }
    }

    loadPipelines();
  }, []);

  const enriched = useMemo(() => {
    return pipelines.map((p) => ({
      ...p,
      pipelineId: getPipelineId(p),
      risk: getRiskLevel(p),
      priority: getPriority(p),
      action: getAction(p),
      condition: getConditionScore(p),
      criticality: getCriticality(p),
    }));
  }, [pipelines]);

  const stats = useMemo(() => {
    const high = enriched.filter((p) => p.risk === "HIGH").length;
    const medium = enriched.filter((p) => p.risk === "MEDIUM").length;
    const low = enriched.filter((p) => p.risk === "LOW").length;
    const immediate = enriched.filter((p) => p.priority === "IMMEDIATE").length;

    return {
      total: enriched.length,
      high,
      medium,
      low,
      immediate,
      systemHealth: enriched.length ? Math.round((low / enriched.length) * 100) : 0,
    };
  }, [enriched]);

  const priorityQueue = useMemo(() => {
    const priorityOrder = { IMMEDIATE: 3, PLANNED: 2, ROUTINE: 1 };
    const riskOrder = { HIGH: 3, MEDIUM: 2, LOW: 1 };

    return [...enriched]
      .sort((a, b) => {
        const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
        if (priorityDiff !== 0) return priorityDiff;

        const riskDiff = riskOrder[b.risk] - riskOrder[a.risk];
        if (riskDiff !== 0) return riskDiff;

        return Number(b.criticality || 0) - Number(a.criticality || 0);
      })
      .slice(0, 8);
  }, [enriched]);

  const zoneSummary = useMemo(() => {
    const zones = {};

    enriched.forEach((p) => {
      const zone = p.PRESSURE_ZONE || p.pressure_zone || "Unknown Zone";

      if (!zones[zone]) {
        zones[zone] = {
          zone,
          total: 0,
          high: 0,
          medium: 0,
          immediate: 0,
        };
      }

      zones[zone].total += 1;

      if (p.risk === "HIGH") zones[zone].high += 1;
      if (p.risk === "MEDIUM") zones[zone].medium += 1;
      if (p.priority === "IMMEDIATE") zones[zone].immediate += 1;
    });

    return Object.values(zones)
      .sort(
        (a, b) =>
          b.immediate + b.high + b.medium - (a.immediate + a.high + a.medium)
      )
      .slice(0, 6);
  }, [enriched]);

  return (
    <div className="systemHubPage">
      <div className="hubHero">
        <div>
          <div className="eyebrow">Engineer Decision Hub</div>
          <h1>System Hub</h1>
        </div>

        <div className="heroBadges">
          <span>
            {loading ? "Loading..." : `${stats.total.toLocaleString()} assets loaded`}
          </span>
          <span>{stats.immediate.toLocaleString()} immediate actions</span>
          <span>{stats.systemHealth}% system health</span>
        </div>
      </div>

      {loading ? (
        <div className="panel">Loading System Hub data...</div>
      ) : errorMsg ? (
        <div className="panel errorBox">{errorMsg}</div>
      ) : (
        <>
          <div className="hubKpiGrid">
            <Kpi title="Total Assets" value={stats.total.toLocaleString()} />
            <Kpi title="High Risk" value={stats.high.toLocaleString()} tone="danger" />
            <Kpi title="Medium Risk" value={stats.medium.toLocaleString()} tone="warn" />
            <Kpi
              title="Immediate Queue"
              value={stats.immediate.toLocaleString()}
              tone="danger"
            />
            <Kpi title="System Health" value={`${stats.systemHealth}%`} tone="blue" />
          </div>

          <div className="actionStrip">
            <Link to="/alerts" className="actionCard">
              <div className="actionIcon">🚨</div>
              <div>
                <h3>Open Alerts</h3>
                <p>Review high and medium risk pipeline alerts.</p>
              </div>
            </Link>

            <Link to="/maintenance" className="actionCard">
              <div className="actionIcon">🛠️</div>
              <div>
                <h3>Maintenance</h3>
                <p>Plan repair and inspection workflow.</p>
              </div>
            </Link>

            <Link to="/map-view" className="actionCard">
              <div className="actionIcon">🗺️</div>
              <div>
                <h3>Map View</h3>
                <p>Locate pipeline risk areas visually.</p>
              </div>
            </Link>

            <Link to="/pipelines" className="actionCard">
              <div className="actionIcon">📋</div>
              <div>
                <h3>Pipeline Records</h3>
                <p>Inspect full asset records and details.</p>
              </div>
            </Link>
          </div>

          <div className="hubGrid">
            <div className="panel">
              <div className="sectionHead">
                <h2>What should engineers do today?</h2>
                <p>Simple operational summary based on current dataset risk.</p>
              </div>

              <div className="decisionList">
                <DecisionCard
                  title="Immediate Field Inspection"
                  value={stats.immediate.toLocaleString()}
                  text="High-risk or high-criticality assets should be inspected first."
                  tone="danger"
                />
                <DecisionCard
                  title="Preventive Maintenance"
                  value={stats.medium.toLocaleString()}
                  text="Medium-risk assets should be planned for the next maintenance cycle."
                  tone="warn"
                />
                <DecisionCard
                  title="Routine Monitoring"
                  value={stats.low.toLocaleString()}
                  text="Low-risk assets can remain under normal monitoring."
                  tone="blue"
                />
              </div>
            </div>

            <div className="panel">
              <div className="sectionHead">
                <h2>Pressure Zone Priorities</h2>
                <p>Zones sorted by inspection and maintenance demand.</p>
              </div>

              <div className="zoneList">
                {zoneSummary.length === 0 ? (
                  <div className="empty">No zone data available.</div>
                ) : (
                  zoneSummary.map((zone) => (
                    <div key={zone.zone} className="zoneCard">
                      <div>
                        <h3>{zone.zone}</h3>
                        <p>{zone.total.toLocaleString()} assets in this pressure zone</p>
                      </div>

                      <div className="zoneStats">
                        <span className="dangerText">{zone.high.toLocaleString()} High</span>
                        <span className="warnText">{zone.medium.toLocaleString()} Medium</span>
                        <span>{zone.immediate.toLocaleString()} Immediate</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="panel">
            <div className="sectionHead">
              <h2>Priority Inspection Queue</h2>
              <p>Engineer should inspect these assets first.</p>
            </div>

            <div className="priorityTableWrap">
              <table>
                <thead>
                  <tr>
                    <th>Pipeline</th>
                    <th>Material</th>
                    <th>Size</th>
                    <th>Zone</th>
                    <th>Condition</th>
                    <th>Criticality</th>
                    <th>Risk</th>
                    <th>Recommended Action</th>
                  </tr>
                </thead>

                <tbody>
                  {priorityQueue.map((p, index) => (
                    <tr key={`${p.pipelineId}-${p.OBJECTID || index}`}>
                      <td className="strong">{p.pipelineId}</td>
                      <td>{p.MATERIAL || "N/A"}</td>
                      <td>{p.PIPE_SIZE || p.MAP_LABEL || "N/A"}</td>
                      <td>{p.PRESSURE_ZONE || "N/A"}</td>
                      <td>{p.condition ?? "N/A"}</td>
                      <td>{p.criticality ?? "N/A"}</td>
                      <td>
                        <span
                          className="riskBadge"
                          style={{ background: getRiskColor(p.risk) }}
                        >
                          {p.risk}
                        </span>
                      </td>
                      <td>{p.action}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <style>{`
        .systemHubPage {
          width: 100%;
          padding: 28px;
          animation: fadeIn 0.35s ease;
        }

        .hubHero {
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

        .eyebrow {
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

        .hubHero h1 {
          margin: 0;
          font-size: 30px;
          color: #123047;
        }

        .heroBadges {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          justify-content: flex-end;
          align-items: flex-start;
        }

        .heroBadges span {
          background: white;
          border: 1px solid #d7e6ef;
          border-radius: 999px;
          padding: 8px 12px;
          font-size: 12px;
          font-weight: 900;
          color: #123047;
        }

        .hubKpiGrid {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 16px;
          margin-bottom: 22px;
        }

        .hubKpi,
        .panel,
        .actionCard {
          background: white;
          border: 1px solid #d7e6ef;
          border-radius: 18px;
          box-shadow: 0 10px 26px rgba(20, 65, 90, 0.08);
        }

        .hubKpi {
          padding: 18px;
        }

        .hubKpi.danger {
          background: #fdeaea;
        }

        .hubKpi.warn {
          background: #fff4dd;
        }

        .hubKpi.blue {
          background: #e2f4fb;
        }

        .hubKpi span {
          color: #5f7688;
          font-size: 13px;
          font-weight: 900;
        }

        .hubKpi strong {
          display: block;
          margin-top: 8px;
          color: #123047;
          font-size: 32px;
          font-weight: 950;
        }

        .actionStrip {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
          margin-bottom: 22px;
        }

        .actionCard {
          display: flex;
          gap: 14px;
          padding: 18px;
          text-decoration: none;
          color: #123047;
          transition: 0.2s ease;
        }

        .actionCard:hover {
          transform: translateY(-2px);
          border-color: #8cc9df;
          background: #f6fafc;
        }

        .actionIcon {
          width: 44px;
          height: 44px;
          border-radius: 14px;
          background: #dff2fa;
          color: #0b6fa4;
          display: grid;
          place-items: center;
          font-size: 22px;
          flex: 0 0 auto;
        }

        .actionCard h3 {
          margin: 0;
          font-size: 16px;
          color: #123047;
        }

        .actionCard p {
          margin: 5px 0 0;
          color: #5f7688;
          font-size: 13px;
          font-weight: 600;
        }

        .hubGrid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 22px;
          margin-bottom: 22px;
        }

        .panel {
          padding: 20px;
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

        .decisionList,
        .zoneList {
          display: grid;
          gap: 12px;
        }

        .decisionCard,
        .zoneCard {
          border-radius: 16px;
          padding: 16px;
          border: 1px solid #d7e6ef;
          background: #f6fafc;
        }

        .decisionCard.danger {
          background: #fdeaea;
        }

        .decisionCard.warn {
          background: #fff4dd;
        }

        .decisionCard.blue {
          background: #e2f4fb;
        }

        .decisionCard span {
          color: #5f7688;
          font-size: 13px;
          font-weight: 900;
        }

        .decisionCard strong {
          display: block;
          margin-top: 6px;
          color: #123047;
          font-size: 28px;
          font-weight: 950;
        }

        .decisionCard p {
          margin: 8px 0 0;
          color: #31546a;
          font-weight: 700;
          line-height: 1.5;
        }

        .zoneCard {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          align-items: center;
        }

        .zoneCard h3 {
          margin: 0;
          color: #123047;
        }

        .zoneCard p {
          margin: 5px 0 0;
          color: #5f7688;
          font-size: 13px;
          font-weight: 700;
        }

        .zoneStats {
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

        .priorityTableWrap {
          overflow-x: auto;
          max-height: 500px;
          overflow-y: auto;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          min-width: 950px;
        }

        th {
          text-align: left;
          color: #31546a;
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: .4px;
          padding: 12px;
          border-bottom: 1px solid #d7e6ef;
          background: #eef8fc;
          position: sticky;
          top: 0;
          z-index: 2;
        }

        td {
          padding: 12px;
          border-bottom: 1px solid #e4edf3;
          font-size: 13px;
          color: #123047;
        }

        tr:hover td {
          background: #f6fafc;
        }

        .strong {
          font-weight: 950;
          color: #0b6fa4;
        }

        .riskBadge {
          color: white;
          border-radius: 999px;
          padding: 6px 12px;
          font-size: 11px;
          font-weight: 950;
          white-space: nowrap;
        }

        .empty {
          padding: 24px;
          text-align: center;
          border-radius: 14px;
          border: 1px dashed #b9ddeb;
          background: #f6fafc;
          color: #5f7688;
          font-weight: 800;
        }

        .errorBox {
          color: #dc2626;
          font-weight: 800;
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(5px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @media (max-width: 1200px) {
          .hubKpiGrid,
          .actionStrip {
            grid-template-columns: repeat(2, 1fr);
          }

          .hubGrid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 700px) {
          .systemHubPage {
            padding: 18px;
          }

          .hubHero {
            display: grid;
          }

          .heroBadges {
            justify-content: flex-start;
          }

          .hubKpiGrid,
          .actionStrip {
            grid-template-columns: 1fr;
          }

          .zoneCard {
            align-items: flex-start;
            flex-direction: column;
          }

          .zoneStats {
            justify-content: flex-start;
          }
        }
      `}</style>
    </div>
  );
}

function Kpi({ title, value, tone = "" }) {
  return (
    <div className={`hubKpi ${tone}`}>
      <span>{title}</span>
      <strong>{value}</strong>
    </div>
  );
}

function DecisionCard({ title, value, text, tone = "" }) {
  return (
    <div className={`decisionCard ${tone}`}>
      <span>{title}</span>
      <strong>{value}</strong>
      <p>{text}</p>
    </div>
  );
}