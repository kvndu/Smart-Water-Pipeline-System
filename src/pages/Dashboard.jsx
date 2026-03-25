import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
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
} from "recharts";

const COLORS = { Low: "#10b981", Medium: "#f59e0b", High: "#ef4444" };

function buildAlerts(pipelines) {
  const alerts = [];

  pipelines.forEach((p) => {
    const leaks = Number(p.previous_leak_count || 0);

    if (leaks >= 2) {
      alerts.push({
        id: `${p.pipeline_id}-leaks`,
        title: "Repeated leaks",
        severity: "High",
        pipeline_id: p.pipeline_id,
        area: p.area_name,
      });
    }

    if (p.risk_level === "High") {
      alerts.push({
        id: `${p.pipeline_id}-risk`,
        title: "High risk pipeline",
        severity: leaks > 0 ? "High" : "Medium",
        pipeline_id: p.pipeline_id,
        area: p.area_name,
      });
    }
  });

  return alerts;
}

function MetricCard({ label, value, hint }) {
  return (
    <div className="metricCard card">
      <div className="metricLabel">{label}</div>
      <div className="metricValue">{value}</div>
      <div className="metricHint">{hint}</div>
    </div>
  );
}

function getRainStatus(rainMm) {
  const value = Number(rainMm || 0);
  if (value <= 0) return "No rain";
  if (value <= 2) return "Light rain";
  if (value <= 5) return "Moderate rain";
  if (value <= 10) return "Heavy rain";
  return "Very heavy rain";
}

function getPriorityBadgeClass(priority) {
  if (priority === "Critical") return "badge danger";
  if (priority === "Moderate") return "badge warn";
  return "badge ok";
}

export default function Dashboard() {
  const [pipelines, setPipelines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [liveRain, setLiveRain] = useState(null);
  const [rainError, setRainError] = useState("");

  const [now, setNow] = useState(new Date());

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        setError("");
        const res = await api.get("/pipelines-with-risk?limit=100");
        setPipelines(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        console.error(err);
        setError("Failed to load dashboard data.");
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  useEffect(() => {
    async function fetchRain() {
      try {
        setRainError("");
        const res = await api.get("/live-rain");
        setLiveRain(res.data || null);
      } catch (err) {
        console.error(err);
        setRainError("Failed to load live rain data.");
      }
    }

    fetchRain();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const alerts = useMemo(() => buildAlerts(pipelines), [pipelines]);

  const highRisk = useMemo(
    () => pipelines.filter((p) => p.risk_level === "High").length,
    [pipelines]
  );

  const mediumRisk = useMemo(
    () => pipelines.filter((p) => p.risk_level === "Medium").length,
    [pipelines]
  );

  const lowRisk = useMemo(
    () => pipelines.filter((p) => p.risk_level === "Low").length,
    [pipelines]
  );

  const avgRisk = useMemo(() => {
    if (!pipelines.length) return "0.000";
    const total = pipelines.reduce((sum, p) => sum + Number(p.risk_score || 0), 0);
    return (total / pipelines.length).toFixed(3);
  }, [pipelines]);

  const riskDistribution = useMemo(
    () => [
      { name: "Low", value: lowRisk, fill: COLORS.Low },
      { name: "Medium", value: mediumRisk, fill: COLORS.Medium },
      { name: "High", value: highRisk, fill: COLORS.High },
    ],
    [lowRisk, mediumRisk, highRisk]
  );

  const divisionDistribution = useMemo(() => {
    const counts = {};

    pipelines.forEach((p) => {
      const division = p.ds_division || "Unknown";
      counts[division] = (counts[division] || 0) + 1;
    });

    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [pipelines]);

  const topAttention = useMemo(() => {
    return [...pipelines]
      .sort((a, b) => Number(b.risk_score || 0) - Number(a.risk_score || 0))
      .slice(0, 6);
  }, [pipelines]);

  const topRecommendations = useMemo(() => {
    return [...pipelines]
      .filter((p) => p.recommendation)
      .sort((a, b) => Number(b.risk_score || 0) - Number(a.risk_score || 0))
      .slice(0, 4);
  }, [pipelines]);

  return (
    <div className="container" style={{ animation: "fadeIn 0.35s ease" }}>
      <div className="pageHero">
        <div>
          <div className="heroEyebrow">Overview</div>
          <div className="pageTitle">Smart Pipeline Dashboard</div>
          <div className="pageSubtitle">
            This page gives a quick summary of pipeline condition, current alert
            pressure, and where the highest-risk assets are located.
          </div>
        </div>

        <div className="pageActions">
          <span className="badge ok">Loaded records: {pipelines.length}</span>
          <span className="badge">Rule-based risk engine</span>
          {liveRain && (
            <span className="badge">
              Kalutara rain: {Number(liveRain.rain_mm || 0).toFixed(1)} mm
            </span>
          )}
          <span className="badge">
            {now.toLocaleDateString()} {now.toLocaleTimeString()}
          </span>
          {rainError && <span className="badge warn">{rainError}</span>}
        </div>
      </div>

      {loading ? (
        <div className="card card-pad">Loading dashboard data...</div>
      ) : error ? (
        <div className="card card-pad" style={{ color: "var(--danger)" }}>
          {error}
        </div>
      ) : (
        <>
          <div className="metricsGrid" style={{ marginBottom: 18 }}>
            <MetricCard
              label="Visible pipelines"
              value={pipelines.length}
              hint="Current records loaded from backend"
            />
            <MetricCard
              label="High risk"
              value={highRisk}
              hint="Needs immediate attention"
            />
            <MetricCard
              label="Alerts"
              value={alerts.length}
              hint="Generated from risk + leaks"
            />
            <MetricCard
              label="Average risk score"
              value={avgRisk}
              hint="Mean risk score of loaded records"
            />
            <MetricCard
              label="Kalutara live rain"
              value={
                liveRain
                  ? `${Number(liveRain.rain_mm || 0).toFixed(1)} mm`
                  : "--"
              }
              hint={
                liveRain
                  ? `${getRainStatus(liveRain.rain_mm)} • Score ${Number(
                      liveRain.rain_score || 0
                    ).toFixed(2)}`
                  : "Live rain API not loaded"
              }
            />
          </div>

          <div className="twoColGrid" style={{ marginBottom: 18 }}>
            <div className="card card-pad">
              <div className="sectionHeader">
                <div>
                  <div className="sectionTitle">Risk distribution</div>
                  <div className="sectionSubtitle">
                    How the loaded pipelines are split across Low, Medium, and High risk.
                  </div>
                </div>
              </div>

              <ResponsiveContainer width="100%" height={320}>
                <PieChart>
                  <Pie
                    data={riskDistribution}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={72}
                    outerRadius={110}
                    paddingAngle={4}
                  >
                    {riskDistribution.map((entry) => (
                      <Cell key={entry.name} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="card card-pad">
              <div className="sectionHeader">
                <div>
                  <div className="sectionTitle">Pipelines by division</div>
                  <div className="sectionSubtitle">
                    Which divisions appear most often in the currently loaded dataset.
                  </div>
                </div>
              </div>

              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={divisionDistribution}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" angle={-18} textAnchor="end" height={70} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="value" fill="#2563eb" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="panelGrid" style={{ marginBottom: 18 }}>
            <div className="card card-pad">
              <div className="sectionHeader">
                <div>
                  <div className="sectionTitle">Pipelines needing attention</div>
                  <div className="sectionSubtitle">
                    Top records ordered by highest risk score.
                  </div>
                </div>
              </div>

              <div className="tableWrap">
                <table className="table" style={{ minWidth: 760 }}>
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Area</th>
                      <th>Risk</th>
                      <th>Risk Score</th>
                      <th>Leaks</th>
                      <th>Recommendation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topAttention.map((p) => (
                      <tr key={p.pipeline_id}>
                        <td>
                          <Link
                            to={`/pipelines/${p.pipeline_id}`}
                            style={{ fontWeight: 700, textDecoration: "none" }}
                          >
                            {p.pipeline_id}
                          </Link>
                        </td>
                        <td>{p.area_name || "-"}</td>
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
                        <td>{Number(p.risk_score || 0).toFixed(3)}</td>
                        <td>{p.previous_leak_count || 0}</td>
                        <td>{p.recommendation?.action || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="card card-pad">
              <div className="sectionHeader">
                <div>
                  <div className="sectionTitle">Quick explanation</div>
                  <div className="sectionSubtitle">
                    What this page means in simple words.
                  </div>
                </div>
              </div>

              <div className="vstack">
                <div className="detailItem">
                  <div className="detailLabel">Low risk</div>
                  <div className="detailValue">Routine monitoring only.</div>
                </div>

                <div className="detailItem">
                  <div className="detailLabel">Medium risk</div>
                  <div className="detailValue">
                    Plan inspection and keep watching leak history.
                  </div>
                </div>

                <div className="detailItem">
                  <div className="detailLabel">High risk</div>
                  <div className="detailValue">
                    Highest priority for maintenance and follow-up.
                  </div>
                </div>

                <div className="detailItem">
                  <div className="detailLabel">Alerts</div>
                  <div className="detailValue">
                    Created when a pipeline is high risk or has repeated leaks.
                  </div>
                </div>

                <div className="detailItem">
                  <div className="detailLabel">Kalutara live rain</div>
                  <div className="detailValue">
                    {liveRain
                      ? `${Number(liveRain.rain_mm || 0).toFixed(1)} mm • ${getRainStatus(
                          liveRain.rain_mm
                        )} • Updated: ${liveRain.updated_time || "-"}`
                      : "Live rain data not available."}
                  </div>
                </div>

                <div className="detailItem">
                  <div className="detailLabel">Current time</div>
                  <div className="detailValue">
                    {now.toLocaleDateString()} • {now.toLocaleTimeString()}
                  </div>
                </div>

                <div className="detailItem">
                  <div className="detailLabel">Current counts</div>
                  <div className="detailValue">
                    Low: {lowRisk} • Medium: {mediumRisk} • High: {highRisk}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="card card-pad">
            <div className="sectionHeader">
              <div>
                <div className="sectionTitle">Top recommended actions</div>
                <div className="sectionSubtitle">
                  Backend API generated maintenance recommendations for the highest-risk pipelines.
                </div>
              </div>
            </div>

            {topRecommendations.length === 0 ? (
              <div className="emptyState">No recommendation data available.</div>
            ) : (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                  gap: "16px",
                }}
              >
                {topRecommendations.map((p) => (
                  <div key={p.pipeline_id} className="detailItem">
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "12px",
                        marginBottom: "10px",
                      }}
                    >
                      <div className="detailValue">
                        <Link
                          to={`/pipelines/${p.pipeline_id}`}
                          style={{ textDecoration: "none", color: "inherit" }}
                        >
                          {p.pipeline_id}
                        </Link>
                      </div>

                      <span className={getPriorityBadgeClass(p.recommendation?.priority)}>
                        {p.recommendation?.priority || "Low"}
                      </span>
                    </div>

                    <div className="detailLabel" style={{ marginBottom: 6 }}>
                      {p.area_name || "Unknown area"}
                    </div>

                    <div style={{ marginBottom: 10 }}>
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
                      <span style={{ marginLeft: 8, fontWeight: 700 }}>
                        Score: {Number(p.risk_score || 0).toFixed(3)}
                      </span>
                    </div>

                    <div className="detailLabel">Action</div>
                    <div className="detailValue" style={{ marginBottom: 10 }}>
                      {p.recommendation?.action || "-"}
                    </div>

                    <div className="detailLabel">Message</div>
                    <div
                      style={{
                        color: "var(--text-muted, #6b7280)",
                        lineHeight: 1.6,
                        marginBottom: 10,
                      }}
                    >
                      {p.recommendation?.message || "No message available."}
                    </div>

                    <div className="detailLabel">Reasons</div>
                    <div style={{ color: "#111827" }}>
                      {Array.isArray(p.recommendation?.reasons) &&
                      p.recommendation.reasons.length > 0 ? (
                        <ul style={{ margin: "8px 0 0 18px", padding: 0 }}>
                          {p.recommendation.reasons.map((reason, index) => (
                            <li key={index} style={{ marginBottom: 6, lineHeight: 1.5 }}>
                              {reason}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        "No reasons available."
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}