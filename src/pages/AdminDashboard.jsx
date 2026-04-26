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

function getPriority(p) {
  const risk = getRiskLevel(p);
  const criticality = getCriticality(p) ?? 0;

  if (risk === "HIGH" || criticality >= 8) return "CRITICAL";
  if (risk === "MEDIUM" || criticality >= 5) return "PLANNED";
  return "ROUTINE";
}

function getPipelineId(p) {
  return p.WATMAINID || p.OBJECTID || "N/A";
}

function getRiskColor(risk) {
  if (risk === "HIGH") return "#dc2626";
  if (risk === "MEDIUM") return "#d97706";
  return "#0b6fa4";
}

export default function AdminDashboard() {
  const navigate = useNavigate();

  const [pipelines, setPipelines] = useState([]);
  const [loading, setLoading] = useState(true);

  const adminName = localStorage.getItem("waterflow_user") || "Administrator";

  useEffect(() => {
    async function loadAdminData() {
      setLoading(true);

      const { data, error } = await supabase
        .from("pipelines")
        .select("*")
        .limit(2000);

      if (error) {
        console.error("Admin dashboard fetch error:", error);
        setPipelines([]);
      } else {
        setPipelines(data || []);
      }

      setLoading(false);
    }

    loadAdminData();
  }, []);

  function handleLogout() {
    localStorage.removeItem("waterflow_auth");
    localStorage.removeItem("waterflow_user");
    navigate("/login", { replace: true });
  }

  const enriched = useMemo(() => {
    return pipelines.map((p) => ({
      ...p,
      pipelineId: getPipelineId(p),
      risk: getRiskLevel(p),
      priority: getPriority(p),
      condition: getConditionScore(p),
      criticality: getCriticality(p),
    }));
  }, [pipelines]);

  const stats = useMemo(() => {
    const total = enriched.length;
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
      total,
      high,
      medium,
      low,
      critical,
      avgCondition,
      systemHealth: total ? Math.round((low / total) * 100) : 0,
    };
  }, [enriched]);

  const highRiskAssets = useMemo(() => {
    const riskOrder = { HIGH: 3, MEDIUM: 2, LOW: 1 };

    return [...enriched]
      .sort((a, b) => {
        const riskDiff = riskOrder[b.risk] - riskOrder[a.risk];
        if (riskDiff !== 0) return riskDiff;
        return Number(b.criticality || 0) - Number(a.criticality || 0);
      })
      .slice(0, 8);
  }, [enriched]);

  const zoneSummary = useMemo(() => {
    const zones = {};

    enriched.forEach((p) => {
      const zone = p.PRESSURE_ZONE || "Unknown Zone";

      if (!zones[zone]) {
        zones[zone] = {
          zone,
          total: 0,
          high: 0,
          medium: 0,
          critical: 0,
        };
      }

      zones[zone].total += 1;
      if (p.risk === "HIGH") zones[zone].high += 1;
      if (p.risk === "MEDIUM") zones[zone].medium += 1;
      if (p.priority === "CRITICAL") zones[zone].critical += 1;
    });

    return Object.values(zones)
      .sort((a, b) => b.critical + b.high + b.medium - (a.critical + a.high + a.medium))
      .slice(0, 5);
  }, [enriched]);

  return (
    <div className="adminPage">
      <div className="adminHero">
        <div>
          <div className="adminEyebrow">Admin Control Center</div>
          <h1>Admin Dashboard</h1>
          <p>
            Welcome back, {adminName}. Manage Waterloo/Kitchener water mains data,
            engineer access and system-level control from one place.
          </p>
        </div>

        <div className="adminProfile">
          <div className="adminAvatar">A</div>
          <div>
            <strong>{adminName}</strong>
            <span>System Administrator</span>
          </div>
          <button onClick={handleLogout}>Logout</button>
        </div>
      </div>

      {loading ? (
        <div className="adminPanel">Loading admin dashboard...</div>
      ) : (
        <>
          <div className="adminKpiGrid">
            <AdminKpi title="Total Assets" value={stats.total} />
            <AdminKpi title="High Risk" value={stats.high} tone="danger" />
            <AdminKpi title="Medium Risk" value={stats.medium} tone="warn" />
            <AdminKpi title="Critical Queue" value={stats.critical} tone="danger" />
            <AdminKpi title="System Health" value={`${stats.systemHealth}%`} tone="ok" />
            <AdminKpi title="Avg. Condition" value={stats.avgCondition} tone="blue" />
          </div>

          <div className="adminActions">
            <Link to="/engineer-management" className="adminActionCard">
              <div className="adminActionIcon">👷</div>
              <div>
                <h3>Engineer Management</h3>
                <p>Add, review and manage engineer accounts.</p>
              </div>
            </Link>

            <Link to="/access-control" className="adminActionCard">
              <div className="adminActionIcon">🔐</div>
              <div>
                <h3>Access Control</h3>
                <p>Manage user roles, permissions and access levels.</p>
              </div>
            </Link>

            <Link to="/dashboard" className="adminActionCard">
              <div className="adminActionIcon">📊</div>
              <div>
                <h3>Engineer Dashboard</h3>
                <p>Open the operational pipeline dashboard.</p>
              </div>
            </Link>

            <Link to="/reports" className="adminActionCard">
              <div className="adminActionIcon">📄</div>
              <div>
                <h3>Reports</h3>
                <p>Generate dataset-based system reports.</p>
              </div>
            </Link>
          </div>

          <div className="adminGrid">
            <section className="adminPanel">
              <div className="sectionHead">
                <h2>System Risk Summary</h2>
                <p>Overall risk levels from the current real dataset.</p>
              </div>

              <div className="riskRows">
                <RiskRow label="High Risk Assets" value={stats.high} color="#dc2626" />
                <RiskRow label="Medium Risk Assets" value={stats.medium} color="#d97706" />
                <RiskRow label="Low Risk Assets" value={stats.low} color="#0b6fa4" />
                <RiskRow label="Critical Admin Queue" value={stats.critical} color="#b91c1c" />
              </div>
            </section>

            <section className="adminPanel">
              <div className="sectionHead">
                <h2>Pressure Zone Watchlist</h2>
                <p>Zones that need admin monitoring first.</p>
              </div>

              <div className="zoneList">
                {zoneSummary.length === 0 ? (
                  <div className="emptyBox">No pressure zone data available.</div>
                ) : (
                  zoneSummary.map((zone) => (
                    <div className="zoneCard" key={zone.zone}>
                      <div>
                        <h3>{zone.zone}</h3>
                        <p>{zone.total} assets</p>
                      </div>

                      <div className="zoneStats">
                        <span className="dangerText">{zone.high} High</span>
                        <span className="warnText">{zone.medium} Medium</span>
                        <span>{zone.critical} Critical</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>

          <section className="adminPanel">
            <div className="sectionHead">
              <h2>Admin Priority Asset List</h2>
              <p>Highest risk assets that may require admin-level coordination.</p>
            </div>

            <div className="adminTableWrap">
              <table>
                <thead>
                  <tr>
                    <th>Pipeline</th>
                    <th>Status</th>
                    <th>Zone</th>
                    <th>Material</th>
                    <th>Size</th>
                    <th>Condition</th>
                    <th>Criticality</th>
                    <th>Risk</th>
                    <th>Priority</th>
                    <th>Open</th>
                  </tr>
                </thead>

                <tbody>
                  {highRiskAssets.map((p) => (
                    <tr key={`${p.pipelineId}-${p.OBJECTID}`}>
                      <td className="strong">{p.pipelineId}</td>
                      <td>{p.STATUS || "N/A"}</td>
                      <td>{p.PRESSURE_ZONE || "N/A"}</td>
                      <td>{p.MATERIAL || "N/A"}</td>
                      <td>{p.PIPE_SIZE || p.MAP_LABEL || "N/A"}</td>
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
                      <td>{p.priority}</td>
                      <td>
                        <Link className="openBtn" to={`/pipelines/${p.pipelineId}`}>
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      <style>{`
        .adminPage {
          width: 100%;
          padding: 28px;
          animation: fadeIn 0.35s ease;
        }

        .adminHero {
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

        .adminEyebrow {
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

        .adminHero h1 {
          margin: 0;
          color: #123047;
          font-size: 34px;
          font-weight: 950;
        }

        .adminHero p {
          margin: 8px 0 0;
          color: #5f7688;
          max-width: 760px;
          line-height: 1.6;
          font-weight: 600;
        }

        .adminProfile {
          background: white;
          border: 1px solid #d7e6ef;
          border-radius: 18px;
          padding: 14px;
          display: flex;
          align-items: center;
          gap: 12px;
          min-width: 310px;
          box-shadow: 0 10px 26px rgba(20, 65, 90, 0.08);
        }

        .adminAvatar {
          width: 48px;
          height: 48px;
          border-radius: 16px;
          background: linear-gradient(135deg, #0b6fa4, #1593c7);
          color: white;
          display: grid;
          place-items: center;
          font-weight: 950;
          font-size: 20px;
          flex-shrink: 0;
        }

        .adminProfile strong {
          display: block;
          color: #123047;
          font-size: 15px;
        }

        .adminProfile span {
          display: block;
          color: #5f7688;
          font-size: 12px;
          font-weight: 700;
        }

        .adminProfile button {
          margin-left: auto;
          border: none;
          background: #dc2626;
          color: white;
          border-radius: 999px;
          padding: 8px 13px;
          font-size: 12px;
          font-weight: 900;
          cursor: pointer;
        }

        .adminKpiGrid {
          display: grid;
          grid-template-columns: repeat(6, 1fr);
          gap: 16px;
          margin-bottom: 22px;
        }

        .adminKpi,
        .adminPanel,
        .adminActionCard {
          background: white;
          border: 1px solid #d7e6ef;
          border-radius: 18px;
          box-shadow: 0 10px 26px rgba(20, 65, 90, 0.08);
        }

        .adminKpi {
          padding: 18px;
        }

        .adminKpi.danger {
          background: #fdeaea;
        }

        .adminKpi.warn {
          background: #fff4dd;
        }

        .adminKpi.ok {
          background: #e4f7ef;
        }

        .adminKpi.blue {
          background: #e2f4fb;
        }

        .adminKpi span {
          display: block;
          color: #5f7688;
          font-size: 13px;
          font-weight: 900;
        }

        .adminKpi strong {
          display: block;
          margin-top: 8px;
          color: #123047;
          font-size: 28px;
          font-weight: 950;
        }

        .adminActions {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
          margin-bottom: 22px;
        }

        .adminActionCard {
          display: flex;
          gap: 14px;
          padding: 18px;
          text-decoration: none;
          color: #123047;
          transition: 0.2s ease;
        }

        .adminActionCard:hover {
          transform: translateY(-2px);
          border-color: #8cc9df;
          background: #f6fafc;
        }

        .adminActionIcon {
          width: 44px;
          height: 44px;
          border-radius: 14px;
          background: #dff2fa;
          color: #0b6fa4;
          display: grid;
          place-items: center;
          font-size: 22px;
          flex-shrink: 0;
        }

        .adminActionCard h3 {
          margin: 0;
          color: #123047;
          font-size: 16px;
        }

        .adminActionCard p {
          margin: 5px 0 0;
          color: #5f7688;
          font-size: 13px;
          font-weight: 600;
          line-height: 1.4;
        }

        .adminGrid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 22px;
          margin-bottom: 22px;
        }

        .adminPanel {
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

        .riskRows {
          display: grid;
          gap: 12px;
        }

        .riskRow {
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: #f6fafc;
          border: 1px solid #d7e6ef;
          border-radius: 14px;
          padding: 14px;
          color: #31546a;
          font-weight: 900;
        }

        .riskRow strong {
          font-size: 20px;
        }

        .zoneList {
          display: grid;
          gap: 12px;
        }

        .zoneCard {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: center;
          background: #f6fafc;
          border: 1px solid #d7e6ef;
          border-radius: 14px;
          padding: 14px;
        }

        .zoneCard h3 {
          margin: 0;
          color: #123047;
        }

        .zoneCard p {
          margin: 5px 0 0;
          color: #5f7688;
          font-weight: 700;
          font-size: 13px;
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

        .adminTableWrap {
          overflow-x: auto;
          max-height: 520px;
          overflow-y: auto;
        }

        table {
          width: 100%;
          min-width: 1050px;
          border-collapse: collapse;
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
          color: #123047;
          font-size: 13px;
        }

        tr:hover td {
          background: #f6fafc;
        }

        .strong {
          color: #0b6fa4;
          font-weight: 950;
        }

        .riskBadge {
          color: white;
          border-radius: 999px;
          padding: 6px 10px;
          font-size: 11px;
          font-weight: 950;
          white-space: nowrap;
        }

        .openBtn {
          background: #0b6fa4;
          color: white;
          text-decoration: none;
          border-radius: 10px;
          padding: 7px 11px;
          font-size: 12px;
          font-weight: 900;
        }

        .emptyBox {
          padding: 22px;
          border-radius: 14px;
          background: #f6fafc;
          border: 1px dashed #b9ddeb;
          color: #5f7688;
          font-weight: 800;
          text-align: center;
        }

        @media (max-width: 1200px) {
          .adminKpiGrid {
            grid-template-columns: repeat(3, 1fr);
          }

          .adminActions {
            grid-template-columns: repeat(2, 1fr);
          }

          .adminGrid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 760px) {
          .adminPage {
            padding: 18px;
          }

          .adminHero {
            display: grid;
          }

          .adminProfile {
            min-width: 0;
            width: 100%;
          }

          .adminKpiGrid,
          .adminActions {
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

function AdminKpi({ title, value, tone = "" }) {
  return (
    <div className={`adminKpi ${tone}`}>
      <span>{title}</span>
      <strong>{value}</strong>
    </div>
  );
}

function RiskRow({ label, value, color }) {
  return (
    <div className="riskRow">
      <span>{label}</span>
      <strong style={{ color }}>{value}</strong>
    </div>
  );
}