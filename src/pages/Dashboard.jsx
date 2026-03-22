import { useEffect, useMemo, useState } from "react";
import api from "../utils/api.js";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from "recharts";

const COLORS = ["#22c55e", "#f59e0b", "#ef4444", "#3b82f6", "#8b5cf6", "#14b8a6"];

function buildAlerts(pipelines) {
  const alerts = [];

  pipelines.forEach((p) => {
    const leaks = Number(p.previous_leak_count || 0);
    const risk = (p.risk_level || "").toLowerCase();

    if (leaks >= 2) {
      alerts.push({
        id: `AL-${p.pipeline_id}-L`,
        title: "Leak Detected (Multiple reports)",
        severity: "High",
        pipeline_id: p.pipeline_id,
        area: p.area_name,
      });
    } else if (leaks === 1) {
      alerts.push({
        id: `AL-${p.pipeline_id}-L`,
        title: "Leak Detected",
        severity: "Medium",
        pipeline_id: p.pipeline_id,
        area: p.area_name,
      });
    }

    if (risk === "high") {
      alerts.push({
        id: `AL-${p.pipeline_id}-R`,
        title: "High Risk Pipeline",
        severity: leaks > 0 ? "High" : "Medium",
        pipeline_id: p.pipeline_id,
        area: p.area_name,
      });
    }
  });

  return alerts;
}

function StatCard({ label, value, hint }) {
  return (
    <div
      className="card card-pad"
      style={{
        background: "#ffffff",
        border: "1px solid #e2e8f0",
        boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)",
      }}
    >
      <div style={{ color: "var(--muted)", fontSize: "14px", fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: "24px", fontWeight: 900, marginTop: "8px", color: "var(--text)" }}>
        {value}
      </div>
      {hint ? <div style={{ fontSize: "12px", color: "#94a3b8", marginTop: "8px" }}>{hint}</div> : null}
    </div>
  );
}

export default function Dashboard() {
  const [pipelines, setPipelines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    async function fetchDashboardData() {
      try {
        setLoading(true);
        setErrorMsg("");
        const res = await api.get("/pipelines-with-risk?limit=100");
        console.log("Dashboard data:", res.data);
        setPipelines(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        console.error("Dashboard fetch error:", err);
        setPipelines([]);
        setErrorMsg("Failed to load dashboard data.");
      } finally {
        setLoading(false);
      }
    }

    fetchDashboardData();
  }, []);

  const alerts = useMemo(() => buildAlerts(pipelines), [pipelines]);

  const totalPipelines = pipelines.length;
  const highRiskCount = pipelines.filter((p) => p.risk_level === "High").length;
  const mediumRiskCount = pipelines.filter((p) => p.risk_level === "Medium").length;
  const lowRiskCount = pipelines.filter((p) => p.risk_level === "Low").length;
  const totalAlerts = alerts.length;

  const riskDistribution = useMemo(
    () => [
      { name: "Low", value: lowRiskCount },
      { name: "Medium", value: mediumRiskCount },
      { name: "High", value: highRiskCount },
    ],
    [lowRiskCount, mediumRiskCount, highRiskCount]
  );

  const materialDistribution = useMemo(() => {
    const counts = {};
    pipelines.forEach((p) => {
      counts[p.material_type] = (counts[p.material_type] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [pipelines]);

  const divisionDistribution = useMemo(() => {
    const counts = {};
    pipelines.forEach((p) => {
      counts[p.ds_division] = (counts[p.ds_division] || 0) + 1;
    });

    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [pipelines]);

  const topHighRisk = useMemo(() => {
    return [...pipelines]
      .sort((a, b) => {
        if (b.risk_score !== a.risk_score) return b.risk_score - a.risk_score;
        return (b.previous_leak_count || 0) - (a.previous_leak_count || 0);
      })
      .slice(0, 10);
  }, [pipelines]);

  return (
    <div className="container" style={{ animation: "fadeIn 0.4s ease-in-out" }}>
      <div className="header" style={{ marginBottom: "24px" }}>
        <div>
          <div className="title" style={{ fontSize: "28px", color: "var(--text)" }}>
            Smart Pipeline Dashboard
          </div>
          <div className="subtitle" style={{ fontSize: "14px" }}>
            Backend-powered maintenance overview, risk monitoring, and district pipeline analytics.
          </div>
        </div>
      </div>

      {loading ? (
        <div className="card card-pad">Loading dashboard data...</div>
      ) : errorMsg ? (
        <div className="card card-pad" style={{ color: "red" }}>{errorMsg}</div>
      ) : (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "16px",
              marginBottom: "24px",
            }}
          >
            <StatCard label="Total Pipelines" value={totalPipelines} hint="Loaded from backend" />
            <StatCard label="High Risk" value={highRiskCount} hint="Immediate attention required" />
            <StatCard label="Medium Risk" value={mediumRiskCount} hint="Inspection soon" />
            <StatCard label="Low Risk" value={lowRiskCount} hint="Routine monitoring" />
            <StatCard label="Alerts" value={totalAlerts} hint="Rule-based active flags" />
          </div>

          <div
            className="grid"
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "20px",
              marginBottom: "24px",
            }}
          >
            <div className="card card-pad">
              <div className="title" style={{ fontSize: "16px", marginBottom: "16px" }}>
                Risk Distribution
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={riskDistribution}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label
                  >
                    {riskDistribution.map((entry, index) => (
                      <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="card card-pad">
              <div className="title" style={{ fontSize: "16px", marginBottom: "16px" }}>
                Material Distribution
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={materialDistribution}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="value" fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div
            className="grid"
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "20px",
              marginBottom: "24px",
            }}
          >
            <div className="card card-pad">
              <div className="title" style={{ fontSize: "16px", marginBottom: "16px" }}>
                Pipelines by Division
              </div>
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={divisionDistribution}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" angle={-20} textAnchor="end" height={70} />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="value" fill="#14b8a6" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="card card-pad">
              <div className="title" style={{ fontSize: "16px", marginBottom: "16px" }}>
                Recent Rule-Based Alerts
              </div>

              {alerts.length === 0 ? (
                <div className="small">No alerts right now.</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px", maxHeight: "320px", overflowY: "auto" }}>
                  {alerts.slice(0, 8).map((a) => (
                    <div
                      key={a.id}
                      style={{
                        border: "1px solid #e2e8f0",
                        borderRadius: "10px",
                        padding: "12px",
                        background: "#f8fafc",
                      }}
                    >
                      <div style={{ fontWeight: 800, color: "var(--text)" }}>{a.title}</div>
                      <div className="small" style={{ marginTop: "4px" }}>
                        Pipeline: <b>{a.pipeline_id}</b> • Area: {a.area}
                      </div>
                      <div style={{ marginTop: "8px" }}>
                        <span
                          className={`badge ${
                            a.severity === "High"
                              ? "danger"
                              : a.severity === "Medium"
                              ? "warn"
                              : "ok"
                          }`}
                        >
                          {a.severity}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="card card-pad">
            <div className="title" style={{ fontSize: "16px", marginBottom: "16px" }}>
              Top 10 High Priority Pipelines
            </div>

            <div style={{ overflowX: "auto" }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Pipeline ID</th>
                    <th>Division</th>
                    <th>Area</th>
                    <th>Material</th>
                    <th>Install Year</th>
                    <th>Leaks</th>
                    <th>Risk Score</th>
                    <th>Risk Level</th>
                    <th>Recommendation</th>
                  </tr>
                </thead>
                <tbody>
                  {topHighRisk.map((p) => (
                    <tr key={p.pipeline_id}>
                      <td>{p.pipeline_id}</td>
                      <td>{p.ds_division}</td>
                      <td>{p.area_name}</td>
                      <td>{p.material_type}</td>
                      <td>{p.install_year}</td>
                      <td>{p.previous_leak_count}</td>
                      <td>{p.risk_score}</td>
                      <td>
                        <span
                          className={`badge ${
                            p.risk_level === "High"
                              ? "danger"
                              : p.risk_level === "Medium"
                              ? "warn"
                              : "ok"
                          }`}
                        >
                          {p.risk_level}
                        </span>
                      </td>
                      <td>{p.recommendation}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(5px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @media (max-width: 1000px) {
          .grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}