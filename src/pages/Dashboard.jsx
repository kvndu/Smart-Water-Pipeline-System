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

function buildDeterministicMaintenanceDate(pipeline) {
  const year = Number(pipeline.last_maintenance_year);
  if (!year) return "Not recorded";

  const pipelineCode = String(pipeline.pipeline_id || "")
    .split("")
    .reduce((sum, ch) => sum + ch.charCodeAt(0), 0);

  const installYear = Number(pipeline.install_year || year);
  const leakCount = Number(pipeline.previous_leak_count || 0);
  const riskWeight = { High: 17, Medium: 11, Low: 5 }[pipeline.risk_level] || 3;

  const month = ((pipelineCode + leakCount + riskWeight) % 12) + 1;
  const baseDay = ((pipelineCode + installYear + leakCount * 7 + riskWeight) % 28) + 1;
  const day = Math.min(baseDay, new Date(year, month, 0).getDate());

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function addMonths(dateString, monthsToAdd) {
  if (!dateString || dateString === "Not recorded") return "-";

  const [year, month, day] = dateString.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  if (Number.isNaN(date.getTime())) return "-";

  const originalDay = date.getDate();
  date.setMonth(date.getMonth() + monthsToAdd);
  if (date.getDate() < originalDay) {
    date.setDate(0);
  }

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;
}

function getMaintenanceCycleMonths(pipeline) {
  const risk = pipeline.risk_level;
  const leaks = Number(pipeline.previous_leak_count || 0);

  if (risk === "High" || leaks >= 3) return 3;
  if (risk === "Medium" || leaks >= 1) return 6;
  return 12;
}

function getQueuePriority(pipeline) {
  const risk = pipeline.risk_level;
  const leaks = Number(pipeline.previous_leak_count || 0);

  if (risk === "High" || leaks >= 3) return "Critical";
  if (risk === "Medium" || leaks >= 1) return "Planned";
  return "Routine";
}

function getQueueBadgeClass(priority) {
  if (priority === "Critical") return "badge danger";
  if (priority === "Planned") return "badge warn";
  return "badge ok";
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

function isOverdue(nextDateString, referenceDate = new Date()) {
  if (!nextDateString || nextDateString === "-") return false;
  const dueDate = new Date(`${nextDateString}T00:00:00`);
  if (Number.isNaN(dueDate.getTime())) return false;
  return dueDate.getTime() < referenceDate.getTime();
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

  const maintenanceQueue = useMemo(() => {
    return [...pipelines]
      .map((p) => {
        const lastMaintenance = buildDeterministicMaintenanceDate(p);
        const cycleMonths = getMaintenanceCycleMonths(p);
        const nextMaintenance = addMonths(lastMaintenance, cycleMonths);
        const priority = getQueuePriority(p);

        return {
          ...p,
          lastMaintenance,
          nextMaintenance,
          cycleMonths,
          priority,
          isOverdue: isOverdue(nextMaintenance),
        };
      })
      .sort((a, b) => {
        const priorityOrder = { Critical: 3, Planned: 2, Routine: 1 };
        const overdueDiff = Number(b.isOverdue) - Number(a.isOverdue);
        if (overdueDiff !== 0) return overdueDiff;

        const priorityDiff = (priorityOrder[b.priority] || 0) - (priorityOrder[a.priority] || 0);
        if (priorityDiff !== 0) return priorityDiff;

        return Number(b.risk_score || 0) - Number(a.risk_score || 0);
      })
      .slice(0, 8);
  }, [pipelines]);

  const maintenanceSummary = useMemo(() => {
    const summary = {
      overdue: 0,
      next30Days: 0,
      criticalQueue: 0,
      routineQueue: 0,
    };

    const today = new Date();
    const next30 = new Date();
    next30.setDate(next30.getDate() + 30);

    maintenanceQueue.forEach((p) => {
      if (p.priority === "Critical") summary.criticalQueue += 1;
      if (p.priority === "Routine") summary.routineQueue += 1;

      if (!p.nextMaintenance || p.nextMaintenance === "-") return;
      const dueDate = new Date(`${p.nextMaintenance}T00:00:00`);
      if (Number.isNaN(dueDate.getTime())) return;

      if (dueDate < today) summary.overdue += 1;
      if (dueDate >= today && dueDate <= next30) summary.next30Days += 1;
    });

    return summary;
  }, [maintenanceQueue]);

  const hotspotAreas = useMemo(() => {
    const grouped = {};

    pipelines.forEach((p) => {
      const area = p.area_name || "Unknown";
      if (!grouped[area]) {
        grouped[area] = {
          area,
          totalPipelines: 0,
          highRiskCount: 0,
          totalLeaks: 0,
          totalRiskScore: 0,
          maxRiskScore: 0,
        };
      }

      const riskScore = Number(p.risk_score || 0);
      const leaks = Number(p.previous_leak_count || 0);

      grouped[area].totalPipelines += 1;
      grouped[area].totalLeaks += leaks;
      grouped[area].totalRiskScore += riskScore;
      grouped[area].maxRiskScore = Math.max(grouped[area].maxRiskScore, riskScore);
      if (p.risk_level === "High") grouped[area].highRiskCount += 1;
    });

    return Object.values(grouped)
      .map((item) => {
        const avgRisk = item.totalPipelines ? item.totalRiskScore / item.totalPipelines : 0;
        let status = "Monitor";
        if (item.highRiskCount >= 2 || item.totalLeaks >= 8 || avgRisk >= 0.65) status = "Critical";
        else if (item.highRiskCount >= 1 || item.totalLeaks >= 4 || avgRisk >= 0.5) status = "Watch";

        return {
          ...item,
          avgRisk,
          status,
        };
      })
      .sort((a, b) => {
        if (b.highRiskCount !== a.highRiskCount) return b.highRiskCount - a.highRiskCount;
        if (b.totalLeaks !== a.totalLeaks) return b.totalLeaks - a.totalLeaks;
        return b.avgRisk - a.avgRisk;
      })
      .slice(0, 6);
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
                  <div className="sectionTitle">High-risk area hotspots</div>
                  <div className="sectionSubtitle">
                    Areas that need more attention based on high-risk counts, leak history, and average risk.
                  </div>
                </div>
              </div>

              <div className="vstack">
                {hotspotAreas.map((area) => (
                  <div key={area.area} className="detailItem">
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 12,
                        alignItems: "flex-start",
                        flexWrap: "wrap",
                      }}
                    >
                      <div>
                        <div className="detailLabel">{area.area}</div>
                        <div className="detailValue" style={{ fontSize: 14, lineHeight: 1.6 }}>
                          High risk: {area.highRiskCount} • Leaks: {area.totalLeaks} • Avg risk: {area.avgRisk.toFixed(3)}
                        </div>
                      </div>

                      <span
                        className={`badge ${
                          area.status === "Critical"
                            ? "danger"
                            : area.status === "Watch"
                            ? "warn"
                            : "ok"
                        }`}
                      >
                        {area.status}
                      </span>
                    </div>
                  </div>
                ))}

                <div className="detailItem">
                  <div className="detailLabel">Live context</div>
                  <div className="detailValue">
                    {liveRain
                      ? `Kalutara rain: ${Number(liveRain.rain_mm || 0).toFixed(1)} mm • ${getRainStatus(
                          liveRain.rain_mm
                        )} • Updated: ${liveRain.updated_time || "-"}`
                      : "Live rain data not available."}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="card card-pad">
            <div className="sectionHeader">
              <div>
                <div className="sectionTitle">Upcoming maintenance queue</div>
                <div className="sectionSubtitle">
                  A practical worklist based on risk level, leak history, and the last maintenance date.
                </div>
              </div>
            </div>

            <div className="metricsGrid" style={{ marginBottom: 18 }}>
              <MetricCard
                label="Overdue in queue"
                value={maintenanceSummary.overdue}
                hint="Needs review immediately"
              />
              <MetricCard
                label="Due in next 30 days"
                value={maintenanceSummary.next30Days}
                hint="Plan crew allocation now"
              />
              <MetricCard
                label="Critical queue"
                value={maintenanceSummary.criticalQueue}
                hint="High risk or repeated leaks"
              />
              <MetricCard
                label="Routine queue"
                value={maintenanceSummary.routineQueue}
                hint="Can be batched into normal rounds"
              />
            </div>

            <div className="tableWrap">
              <table className="table" style={{ minWidth: 980 }}>
                <thead>
                  <tr>
                    <th>Pipeline ID</th>
                    <th>Area</th>
                    <th>Division</th>
                    <th>Risk</th>
                    <th>Leaks</th>
                    <th>Last maintenance</th>
                    <th>Next due</th>
                    <th>Priority</th>
                  </tr>
                </thead>
                <tbody>
                  {maintenanceQueue.map((p) => (
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
                      <td>{p.ds_division || "-"}</td>
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
                      <td>{p.previous_leak_count || 0}</td>
                      <td>{p.lastMaintenance}</td>
                      <td>
                        <span style={{ fontWeight: p.isOverdue ? 700 : 500, color: p.isOverdue ? "#b91c1c" : "inherit" }}>
                          {p.nextMaintenance}
                        </span>
                      </td>
                      <td>
                        <span className={getQueueBadgeClass(p.priority)}>
                          {p.isOverdue ? `Overdue • ${p.priority}` : p.priority}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
