import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../utils/supabaseClient";

function toNumber(value) {
  const n = Number(value);
  return Number.isNaN(n) ? null : n;
}

function getConditionScore(p) {
  return toNumber(p["Condition Score"] ?? p.CONDITION_SCORE);
}

function getCriticality(p) {
  return toNumber(p.CRITICALITY);
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

function getRiskColor(risk) {
  if (risk === "HIGH") return "#ef4444";
  if (risk === "MEDIUM") return "#f59e0b";
  return "#0284c7";
}

function getPriority(p) {
  const risk = getRiskLevel(p);
  const criticality = getCriticality(p) ?? 0;

  if (risk === "HIGH" || criticality >= 8) return "CRITICAL";
  if (risk === "MEDIUM" || criticality >= 5) return "PLANNED";
  return "ROUTINE";
}

function getAction(p) {
  const priority = getPriority(p);

  if (priority === "CRITICAL") return "Immediate field inspection required";
  if (priority === "PLANNED") return "Schedule preventive maintenance";
  return "Routine monitoring";
}

function getInstallYear(p) {
  const raw = p.INSTALLATION_DATE;
  if (!raw) return null;

  const match = String(raw).match(/\d{4}/);
  return match ? Number(match[0]) : null;
}

export default function Dashboard() {
  const navigate = useNavigate();

  const [pipelines, setPipelines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(new Date());

  function handleLogout() {
    localStorage.removeItem("waterflow_auth");
    navigate("/login", { replace: true });
  }
useEffect(() => {
  async function loadAdminData() {
    setLoading(true);

    let allData = [];
    let from = 0;
    const batchSize = 1000;
    let keepFetching = true;

    while (keepFetching) {
      const { data, error } = await supabase
        .from("pipelines")
        .select("*")
        .range(from, from + batchSize - 1);

      if (error) {
        console.error("Fetch error:", error);
        break;
      }

      if (data.length === 0) {
        keepFetching = false;
      } else {
        allData = [...allData, ...data];
        from += batchSize;
      }
    }

    setPipelines(allData);
    setLoading(false);
  }

  loadAdminData();
}, []);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const enriched = useMemo(() => {
    return pipelines.map((p) => {
      const risk = getRiskLevel(p);
      const priority = getPriority(p);

      return {
        ...p,
        risk,
        priority,
        action: getAction(p),
        condition: getConditionScore(p),
        criticality: getCriticality(p),
        installYear: getInstallYear(p),
      };
    });
  }, [pipelines]);

  const stats = useMemo(() => {
    const high = enriched.filter((p) => p.risk === "HIGH").length;
    const medium = enriched.filter((p) => p.risk === "MEDIUM").length;
    const low = enriched.filter((p) => p.risk === "LOW").length;
    const critical = enriched.filter((p) => p.priority === "CRITICAL").length;

    const conditions = enriched
      .map((p) => p.condition)
      .filter((v) => v !== null);

    const avgCondition =
      conditions.length > 0
        ? (conditions.reduce((sum, v) => sum + v, 0) / conditions.length).toFixed(2)
        : "N/A";

    return {
      total: enriched.length,
      high,
      medium,
      low,
      critical,
      avgCondition,
      activeAlerts: high + critical,
    };
  }, [enriched]);

  const topRiskPipelines = useMemo(() => {
    return [...enriched]
      .sort((a, b) => {
        const riskOrder = { HIGH: 3, MEDIUM: 2, LOW: 1 };
        const riskDiff = riskOrder[b.risk] - riskOrder[a.risk];

        if (riskDiff !== 0) return riskDiff;

        return Number(b.criticality || 0) - Number(a.criticality || 0);
      })
      .slice(0, 6);
  }, [enriched]);

  const recentOperationalAlerts = useMemo(() => {
    return topRiskPipelines.slice(0, 5).map((p) => ({
      id: p.WATMAINID || p.OBJECTID,
      title:
        p.risk === "HIGH"
          ? "High risk pipeline detected"
          : p.priority === "CRITICAL"
          ? "Critical maintenance asset"
          : "Preventive maintenance recommended",
      risk: p.risk,
      message: `${p.MATERIAL || "Unknown material"} • ${
        p.PIPE_SIZE || p.MAP_LABEL || "Unknown size"
      } • ${p.PRESSURE_ZONE || "Unknown zone"}`,
      action: p.action,
    }));
  }, [topRiskPipelines]);

  const maintenanceQueue = useMemo(() => {
    return [...enriched]
      .sort((a, b) => {
        const priorityOrder = { CRITICAL: 3, PLANNED: 2, ROUTINE: 1 };
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      })
      .slice(0, 6);
  }, [enriched]);

  const systemHealth = useMemo(() => {
    if (!stats.total) return 0;
    return Math.max(0, Math.round((stats.low / stats.total) * 100));
  }, [stats]);

  return (
    <div className="dashboardPage">
      <div className="hero">
        <div>
          <div className="eyebrow">Command Overview</div>
          <h1>Smart Water Pipeline Dashboard</h1>
        </div>

        <div className="heroBadges">
          <span>{stats.total} records loaded</span>
          <span>Supabase connected</span>
          <span>
            {now.toLocaleDateString()} {now.toLocaleTimeString()}
          </span>
          <button className="logoutBtn" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </div>

      {loading ? (
        <div className="panel">Loading dashboard data...</div>
      ) : (
        <>
          <div className="quickActions">
            <Link to="/dashboard" className="quickActionCard">
              <div className="quickIcon">📊</div>
              <div>
                <h3>Overview Dashboard</h3>
                <p>System summary and operational overview.</p>
              </div>
            </Link>

            <Link to="/pipelines" className="quickActionCard">
              <div className="quickIcon">📋</div>
              <div>
                <h3>Pipeline Records</h3>
                <p>Search, filter and inspect asset details.</p>
              </div>
            </Link>

            <Link to="/pipelines/add" className="quickActionCard">
              <div className="quickIcon">➕</div>
              <div>
                <h3>Add Pipeline</h3>
                <p>Add a new water pipeline asset record.</p>
              </div>
            </Link>

            <Link to="/risk-calculator" className="quickActionCard">
              <div className="quickIcon">🧮</div>
              <div>
                <h3>Risk Calculator</h3>
                <p>Calculate pipeline risk manually.</p>
              </div>
            </Link>

            <Link to="/map-view" className="quickActionCard">
              <div className="quickIcon">🗺️</div>
              <div>
                <h3>GIS Map View</h3>
                <p>View real pipeline network with risk colors.</p>
              </div>
            </Link>

            <Link to="/alerts" className="quickActionCard">
              <div className="quickIcon">🚨</div>
              <div>
                <h3>Alerts Center</h3>
                <p>Review risk alerts and incident workflow.</p>
              </div>
            </Link>

            <Link to="/maintenance" className="quickActionCard">
              <div className="quickIcon">🛠️</div>
              <div>
                <h3>Maintenance</h3>
                <p>Schedule and complete repair tasks.</p>
              </div>
            </Link>

            <Link to="/analytics" className="quickActionCard">
              <div className="quickIcon">📈</div>
              <div>
                <h3>Analytics</h3>
                <p>Deep analysis of condition and assets.</p>
              </div>
            </Link>

            <Link to="/reports" className="quickActionCard">
              <div className="quickIcon">📄</div>
              <div>
                <h3>Reports</h3>
                <p>Generate pipeline and maintenance reports.</p>
              </div>
            </Link>

            <Link to="/system-hub" className="quickActionCard">
              <div className="quickIcon">🧭</div>
              <div>
                <h3>System Hub</h3>
                <p>Engineer decision hub and system workflow.</p>
              </div>
            </Link>
          </div>

          <div className="metricsGrid">
            <MetricCard label="Total Assets" value={stats.total} hint="Visible pipeline records" />
            <MetricCard label="High Risk" value={stats.high} hint="Need immediate review" color="#ef4444" />
            <MetricCard label="Active Alerts" value={stats.activeAlerts} hint="Generated from risk + criticality" color="#dc2626" />
            <MetricCard label="Critical Queue" value={stats.critical} hint="Priority maintenance assets" color="#f59e0b" />
            <MetricCard label="System Health" value={`${systemHealth}%`} hint="Low-risk asset percentage" color="#16a34a" />
          </div>

          <div className="mainGrid">
            <div className="panel">
              <div className="sectionHead">
                <h2>Operational Risk Summary</h2>
                <p>Dashboard-level overview only. Deep charts are available in Analytics.</p>
              </div>

              <div className="riskSummary">
                <RiskBar label="High" value={stats.high} total={stats.total} color="#ef4444" />
                <RiskBar label="Medium" value={stats.medium} total={stats.total} color="#f59e0b" />
                <RiskBar label="Low" value={stats.low} total={stats.total} color="#0284c7" />
              </div>

              <div className="healthBox">
                <div>
                  <div className="healthLabel">Average Condition Score</div>
                  <div className="healthValue">{stats.avgCondition}</div>
                </div>
                <div>
                  <div className="healthLabel">Operational Status</div>
                  <div className="healthValue">
                    {stats.high > 0 ? "Attention Required" : "Stable"}
                  </div>
                </div>
              </div>
            </div>

            <div className="panel">
              <div className="sectionHead">
                <h2>Recent Operational Alerts</h2>
                <p>Latest generated alerts from the current dataset.</p>
              </div>

              <div className="alertList">
                {recentOperationalAlerts.length === 0 ? (
                  <div className="empty">No active alerts.</div>
                ) : (
                  recentOperationalAlerts.map((alert) => (
                    <div key={alert.id} className="alertCard">
                      <span className="riskDot" style={{ background: getRiskColor(alert.risk) }} />
                      <div>
                        <h3>{alert.title}</h3>
                        <p>{alert.message}</p>
                        <small>{alert.action}</small>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="mainGrid">
            <div className="panel">
              <div className="sectionHead">
                <h2>Top Attention Pipelines</h2>
                <p>Highest-priority assets for engineers to inspect first.</p>
              </div>

              <div className="tableWrap">
                <table>
                  <thead>
                    <tr>
                      <th>WATMAINID</th>
                      <th>Material</th>
                      <th>Size</th>
                      <th>Zone</th>
                      <th>Condition</th>
                      <th>Risk</th>
                      <th>Open</th>
                    </tr>
                  </thead>

                  <tbody>
                    {topRiskPipelines.map((p) => (
                      <tr key={p.OBJECTID}>
                        <td className="strong">{p.WATMAINID || "N/A"}</td>
                        <td>{p.MATERIAL || "N/A"}</td>
                        <td>{p.PIPE_SIZE || p.MAP_LABEL || "N/A"}</td>
                        <td>{p.PRESSURE_ZONE || "N/A"}</td>
                        <td>{p.condition ?? "N/A"}</td>
                        <td>
                          <span className="pill" style={{ background: getRiskColor(p.risk) }}>
                            {p.risk}
                          </span>
                        </td>
                        <td>
                          <Link className="viewBtn" to={`/pipelines/${p.WATMAINID || p.OBJECTID}`}>
                            View
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="panel">
              <div className="sectionHead">
                <h2>Maintenance Work Queue</h2>
                <p>Suggested work order based on risk and criticality.</p>
              </div>

              <div className="queueList">
                {maintenanceQueue.map((p) => (
                  <div key={p.OBJECTID} className="queueCard">
                    <div>
                      <div className="queueTitle">Pipeline #{p.WATMAINID || p.OBJECTID}</div>
                      <div className="queueSub">
                        {p.MATERIAL || "N/A"} • {p.PIPE_SIZE || p.MAP_LABEL || "N/A"} •{" "}
                        {p.PRESSURE_ZONE || "N/A"}
                      </div>
                      <div className="queueAction">{p.action}</div>
                    </div>

                    <span
                      className="pill"
                      style={{
                        background:
                          p.priority === "CRITICAL"
                            ? "#ef4444"
                            : p.priority === "PLANNED"
                            ? "#f59e0b"
                            : "#0284c7",
                      }}
                    >
                      {p.priority}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="panel">
            <div className="sectionHead">
              <h2>System Notes</h2>
              <p>What this dashboard is currently showing.</p>
            </div>

            <div className="noteGrid">
              <div className="noteCard">
                <h3>Dataset</h3>
                <p>
                  Dashboard uses the real Waterloo/Kitchener water mains dataset
                  imported into Supabase.
                </p>
              </div>
              <div className="noteCard">
                <h3>Risk Logic</h3>
                <p>
                  Risk is calculated using Condition Score first, then Criticality
                  when condition values are missing.
                </p>
              </div>
              <div className="noteCard">
                <h3>Analytics</h3>
                <p>
                  Detailed material, pressure zone, condition and installation
                  analysis is kept inside the Analytics page.
                </p>
              </div>
            </div>
          </div>
        </>
      )}

      <style>{`
        .dashboardPage {
          width: 100%;
          max-width: 1500px;
          margin: 0 auto;
          padding: 28px;
          animation: fadeIn 0.35s ease;
        }

        .hero {
          background: linear-gradient(135deg, #ffffff, #ecfeff, #cffafe);
          border: 1px solid #bae6fd;
          border-radius: 28px;
          padding: 28px;
          display: flex;
          justify-content: space-between;
          gap: 20px;
          align-items: flex-start;
          margin-bottom: 22px;
          box-shadow: 0 18px 45px rgba(15,23,42,0.08);
        }

        .eyebrow {
          display: inline-block;
          background: #dff7ff;
          color: #0369a1;
          font-weight: 900;
          font-size: 12px;
          letter-spacing: 1px;
          padding: 7px 12px;
          border-radius: 999px;
          text-transform: uppercase;
          margin-bottom: 10px;
          border: 1px solid #bae6fd;
        }

        .hero h1 {
          margin: 0;
          font-size: 30px;
          color: #0f172a;
        }

        .heroBadges {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          justify-content: flex-end;
          align-items: center;
        }

        .heroBadges span {
          background: #fff;
          border: 1px solid #e2e8f0;
          border-radius: 999px;
          padding: 8px 12px;
          font-size: 12px;
          font-weight: 900;
          color: #0f172a;
        }

        .logoutBtn {
          border: none;
          background: #dc2626;
          color: white;
          border-radius: 999px;
          padding: 9px 16px;
          font-size: 12px;
          font-weight: 900;
          cursor: pointer;
          box-shadow: 0 8px 20px rgba(220, 38, 38, 0.2);
          transition: 0.2s ease;
        }

        .logoutBtn:hover {
          background: #b91c1c;
          transform: translateY(-1px);
        }

        .quickActions {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
          margin-bottom: 22px;
        }

        .quickActionCard {
  padding: 18px;
  display: flex;
  gap: 14px;
  text-decoration: none;
  color: #0f172a;
  transition: 0.2s ease;
  background: linear-gradient(135deg, #e0f7ff 0%, #f3fbff 55%, #ffffff 100%);
  border: 1px solid #b9e6f5;
  border-radius: 20px;
  box-shadow: 0 14px 35px rgba(14, 116, 144, 0.08);
}

.quickActionCard {
  padding: 18px;
  display: flex;
  gap: 14px;
  text-decoration: none;
  color: #0f172a;
  transition: 0.2s ease;
  background: linear-gradient(135deg, #dff6ff 0%, #eefbff 52%, #ffffff 100%) !important;
  border: 1px solid #9bdaf0 !important;
  border-radius: 20px;
  box-shadow: 0 14px 35px rgba(14, 116, 144, 0.12);
}

.quickActionCard:hover {
  transform: translateY(-3px);
  border-color: #38bdf8 !important;
  background: linear-gradient(135deg, #c8f2ff 0%, #e0f7ff 58%, #ffffff 100%) !important;
  box-shadow: 0 18px 42px rgba(14, 165, 233, 0.2);
}

.quickIcon {
  width: 44px;
  height: 44px;
  border-radius: 14px;
  background: linear-gradient(135deg, #bae6fd, #e0f2fe) !important;
  color: #075985;
  display: grid;
  place-items: center;
  font-size: 22px;
  flex: 0 0 auto;
  box-shadow: inset 0 0 0 1px rgba(14, 165, 233, 0.22);
}

        .quickActionCard h3 {
          margin: 0;
          font-size: 16px;
        }

        .quickActionCard p {
          margin: 5px 0 0;
          color: #64748b;
          font-size: 13px;
          line-height: 1.4;
        }

        .metricsGrid {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 16px;
          margin-bottom: 22px;
        }

        .metricCard,
        .panel {
          background: #fff;
          border: 1px solid #e2e8f0;
          border-radius: 20px;
          box-shadow: 0 14px 35px rgba(15,23,42,0.06);
        }

        .metricCard {
          padding: 18px;
        }

        .metricLabel {
          color: #64748b;
          font-size: 13px;
          font-weight: 800;
        }

        .metricValue {
          margin-top: 8px;
          font-size: 32px;
          font-weight: 950;
        }

        .metricHint {
          margin-top: 6px;
          color: #94a3b8;
          font-size: 12px;
          font-weight: 700;
        }

        .mainGrid {
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
          font-size: 22px;
          color: #0f172a;
        }

        .sectionHead p {
          margin: 6px 0 16px;
          color: #64748b;
          font-size: 14px;
        }

        .riskSummary {
          display: grid;
          gap: 14px;
        }

        .riskBarRow {
          display: grid;
          grid-template-columns: 90px 1fr 60px;
          align-items: center;
          gap: 12px;
          font-size: 13px;
          font-weight: 900;
          color: #334155;
        }

        .riskTrack {
          height: 12px;
          background: #e2e8f0;
          border-radius: 999px;
          overflow: hidden;
        }

        .riskFill {
          height: 100%;
          border-radius: 999px;
        }

        .healthBox {
          margin-top: 20px;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }

        .healthBox > div {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 16px;
          padding: 14px;
        }

        .healthLabel {
          color: #64748b;
          font-size: 12px;
          font-weight: 900;
        }

        .healthValue {
          margin-top: 6px;
          color: #0f172a;
          font-size: 18px;
          font-weight: 950;
        }

        .alertList,
        .queueList {
          display: grid;
          gap: 12px;
        }

        .alertCard,
        .queueCard {
          display: flex;
          gap: 12px;
          align-items: flex-start;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 16px;
          padding: 14px;
        }

        .riskDot {
          width: 12px;
          height: 12px;
          border-radius: 999px;
          margin-top: 5px;
          flex: 0 0 auto;
        }

        .alertCard h3,
        .queueTitle {
          margin: 0;
          font-size: 15px;
          font-weight: 950;
          color: #0f172a;
        }

        .alertCard p,
        .queueSub {
          margin: 4px 0;
          color: #64748b;
          font-size: 13px;
          font-weight: 700;
        }

        .alertCard small,
        .queueAction {
          color: #334155;
          font-size: 12px;
          font-weight: 800;
        }

        .queueCard {
          justify-content: space-between;
          align-items: center;
        }

        .pill {
          color: #fff;
          padding: 6px 10px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 950;
          white-space: nowrap;
        }

        .tableWrap {
          overflow-x: auto;
          max-height: 420px;
          overflow-y: auto;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          min-width: 850px;
        }

        th {
          text-align: left;
          color: #475569;
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: .4px;
          padding: 12px;
          border-bottom: 1px solid #e2e8f0;
          background: #f8fafc;
          position: sticky;
          top: 0;
          z-index: 2;
        }

        td {
          padding: 12px;
          border-bottom: 1px solid #e2e8f0;
          font-size: 13px;
          color: #0f172a;
        }

        tr:hover td {
          background: #f8fafc;
        }

        .strong {
          font-weight: 950;
          color: #2563eb;
        }

        .viewBtn {
          display: inline-block;
          text-decoration: none;
          background: #2563eb;
          color: white;
          padding: 8px 12px;
          border-radius: 10px;
          font-size: 12px;
          font-weight: 900;
        }

        .noteGrid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 14px;
        }

        .noteCard {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 16px;
          padding: 16px;
        }

        .noteCard h3 {
          margin: 0 0 8px;
          color: #0f172a;
        }

        .noteCard p {
          margin: 0;
          color: #64748b;
          font-size: 13px;
          line-height: 1.6;
        }

        .empty {
          background: #f8fafc;
          border: 1px dashed #cbd5e1;
          border-radius: 16px;
          padding: 28px;
          text-align: center;
          color: #64748b;
          font-weight: 800;
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(5px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @media (max-width: 1200px) {
          .metricsGrid {
            grid-template-columns: repeat(2, 1fr);
          }

          .quickActions {
            grid-template-columns: repeat(2, 1fr);
          }

          .mainGrid,
          .noteGrid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 700px) {
          .dashboardPage {
            padding: 18px;
          }

          .hero,
          .metricsGrid,
          .quickActions {
            grid-template-columns: 1fr;
            display: grid;
          }

          .healthBox {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}

function MetricCard({ label, value, hint, color = "#0f172a" }) {
  return (
    <div className="metricCard">
      <div className="metricLabel">{label}</div>
      <div className="metricValue" style={{ color }}>
        {value}
      </div>
      <div className="metricHint">{hint}</div>
    </div>
  );
}

function RiskBar({ label, value, total, color }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;

  return (
    <div className="riskBarRow">
      <span>{label}</span>
      <div className="riskTrack">
        <div
          className="riskFill"
          style={{
            width: `${Math.max(pct, value > 0 ? 1 : 0)}%`,
            background: color,
          }}
        />
      </div>
      <span>{pct}%</span>
    </div>
  );
}