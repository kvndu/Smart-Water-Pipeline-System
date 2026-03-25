import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../utils/api.js";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip as RechartsTooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";

const COLORS = ["#22c55e", "#f59e0b", "#ef4444", "#3b82f6", "#8b5cf6", "#14b8a6"];

function toCSV(rows) {
  if (!rows?.length) return "";
  const headers = Object.keys(rows[0]);
  return [
    headers.join(","),
    ...rows.map((r) =>
      headers
        .map((h) => `"${String(r[h] ?? "").replaceAll('"', '""')}"`)
        .join(",")
    ),
  ].join("\n");
}

function downloadCSV(filename, rows) {
  const csv = toCSV(rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
}

function getRainStatus(rainMm) {
  const value = Number(rainMm || 0);
  if (value <= 0) return "No rain";
  if (value <= 2) return "Light rain";
  if (value <= 5) return "Moderate rain";
  if (value <= 10) return "Heavy rain";
  return "Very heavy rain";
}

function riskBadgeClass(level) {
  if (level === "High") return "danger";
  if (level === "Medium") return "warn";
  return "ok";
}

function priorityBadgeClass(priority) {
  if (priority === "Critical") return "danger";
  if (priority === "Moderate") return "warn";
  return "ok";
}

export default function Reports() {
  const [pipelines, setPipelines] = useState([]);
  const [liveRain, setLiveRain] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    async function fetchReportsData() {
      try {
        setLoading(true);
        setErrorMsg("");

        const [pipelineRes, rainRes] = await Promise.all([
          api.get("/pipelines-with-risk?limit=2000"),
          api.get("/live-rain"),
        ]);

        setPipelines(Array.isArray(pipelineRes.data) ? pipelineRes.data : []);
        setLiveRain(rainRes.data || null);
      } catch (err) {
        console.error("Reports fetch error:", err);
        setPipelines([]);
        setLiveRain(null);
        setErrorMsg("Failed to load reports data.");
      } finally {
        setLoading(false);
      }
    }

    fetchReportsData();
  }, []);

  const generatedAt = useMemo(() => new Date(), []);

  const totalPipelines = pipelines.length;

  const totalLeaks = useMemo(() => {
    return pipelines.reduce((sum, p) => sum + Number(p.previous_leak_count || 0), 0);
  }, [pipelines]);

  const avgRiskScore = useMemo(() => {
    if (!pipelines.length) return "0.000";
    const total = pipelines.reduce((sum, p) => sum + Number(p.risk_score || 0), 0);
    return (total / pipelines.length).toFixed(3);
  }, [pipelines]);

  const oldestInstallYear = useMemo(() => {
    if (!pipelines.length) return "-";
    return Math.min(...pipelines.map((p) => Number(p.install_year || 9999)));
  }, [pipelines]);

  const highRiskCount = useMemo(
    () => pipelines.filter((p) => p.risk_level === "High").length,
    [pipelines]
  );

  const mediumRiskCount = useMemo(
    () => pipelines.filter((p) => p.risk_level === "Medium").length,
    [pipelines]
  );

  const lowRiskCount = useMemo(
    () => pipelines.filter((p) => p.risk_level === "Low").length,
    [pipelines]
  );

  const criticalTasks = useMemo(
    () => pipelines.filter((p) => p.recommendation?.priority === "Critical").length,
    [pipelines]
  );

  const moderateTasks = useMemo(
    () => pipelines.filter((p) => p.recommendation?.priority === "Moderate").length,
    [pipelines]
  );

  const lowPriorityTasks = useMemo(
    () => pipelines.filter((p) => (p.recommendation?.priority || "Low") === "Low").length,
    [pipelines]
  );

  const riskDistribution = useMemo(() => {
    return [
      { name: "Low", value: lowRiskCount },
      { name: "Medium", value: mediumRiskCount },
      { name: "High", value: highRiskCount },
    ];
  }, [lowRiskCount, mediumRiskCount, highRiskCount]);

  const materialDistribution = useMemo(() => {
    const counts = {};
    pipelines.forEach((p) => {
      const key = p.material_type || "Unknown";
      counts[key] = (counts[key] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [pipelines]);

  const divisionDistribution = useMemo(() => {
    const counts = {};
    pipelines.forEach((p) => {
      const key = p.ds_division || "Unknown";
      counts[key] = (counts[key] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [pipelines]);

  const topLeakPipelines = useMemo(() => {
    return [...pipelines]
      .map((p) => ({
        name: p.pipeline_id,
        leaks: Number(p.previous_leak_count || 0),
      }))
      .sort((a, b) => b.leaks - a.leaks)
      .slice(0, 10);
  }, [pipelines]);

  const topRiskPipelines = useMemo(() => {
    return [...pipelines]
      .sort((a, b) => Number(b.risk_score || 0) - Number(a.risk_score || 0))
      .slice(0, 15);
  }, [pipelines]);

  const topRiskDivisions = useMemo(() => {
    const grouped = {};

    pipelines.forEach((p) => {
      const key = p.ds_division || "Unknown";
      if (!grouped[key]) {
        grouped[key] = {
          division: key,
          count: 0,
          totalRisk: 0,
          highRisk: 0,
        };
      }

      grouped[key].count += 1;
      grouped[key].totalRisk += Number(p.risk_score || 0);
      if (p.risk_level === "High") grouped[key].highRisk += 1;
    });

    return Object.values(grouped)
      .map((item) => ({
        ...item,
        avgRisk: item.count ? (item.totalRisk / item.count).toFixed(3) : "0.000",
      }))
      .sort((a, b) => Number(b.avgRisk) - Number(a.avgRisk))
      .slice(0, 8);
  }, [pipelines]);

  const exportRows = useMemo(() => {
    return pipelines.map((p) => ({
      pipeline_id: p.pipeline_id,
      ds_division: p.ds_division,
      area_name: p.area_name,
      material_type: p.material_type,
      install_year: p.install_year,
      previous_leak_count: p.previous_leak_count,
      annual_rainfall_mm: p.annual_rainfall_mm,
      risk_score: Number(p.risk_score || 0).toFixed(3),
      risk_level: p.risk_level,
      recommendation_action: p.recommendation?.action || "",
      recommendation_priority: p.recommendation?.priority || "",
      recommendation_message: p.recommendation?.message || "",
    }));
  }, [pipelines]);

  function handleDownloadCSV() {
    setDownloading("excel");
    setTimeout(() => {
      downloadCSV("Kalutara_District_Report.csv", exportRows);
      setDownloading("");
    }, 400);
  }

  function handlePrintReport() {
    setDownloading("print");
    setTimeout(() => {
      window.print();
      setDownloading("");
    }, 400);
  }

  return (
    <div className="container" style={{ animation: "fadeIn 0.4s ease-in-out" }}>
      <div className="pageHero">
        <div>
          <div className="heroEyebrow">Reporting</div>
          <div className="pageTitle">Reports & Analytics</div>
          <div className="pageSubtitle">
            Summary reports for Kalutara district: risk distribution, materials,
            divisions, maintenance priority, and leak records.
          </div>
        </div>

        <div className="pageActions no-print" style={{ flexWrap: "wrap" }}>
          <button
            className="btn"
            style={{
              borderColor: "#10b981",
              color: "#059669",
              background: "#ecfdf5",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
            onClick={handleDownloadCSV}
            disabled={!!downloading}
          >
            <span style={{ fontSize: "16px" }}>📊</span>
            {downloading === "excel" ? "Generating..." : "Export CSV"}
          </button>

          <button
            className="btn primary"
            style={{ display: "flex", alignItems: "center", gap: "6px" }}
            onClick={handlePrintReport}
            disabled={!!downloading}
          >
            <span style={{ fontSize: "16px" }}>🖨️</span>
            {downloading === "print" ? "Preparing..." : "Print Report"}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="card card-pad">Loading reports...</div>
      ) : errorMsg ? (
        <div className="card card-pad" style={{ color: "red" }}>{errorMsg}</div>
      ) : (
        <>
          <div className="card card-pad" style={{ marginBottom: 24 }}>
            <div className="sectionHeader">
              <div>
                <div className="sectionTitle">Report metadata</div>
                <div className="sectionSubtitle">
                  Current report generation context.
                </div>
              </div>
            </div>

            <div className="detailGrid reportMetaGrid">
              <div className="detailItem">
                <div className="detailLabel">District</div>
                <div className="detailValue">Kalutara</div>
              </div>
              <div className="detailItem">
                <div className="detailLabel">Generated date</div>
                <div className="detailValue">{generatedAt.toLocaleDateString()}</div>
              </div>
              <div className="detailItem">
                <div className="detailLabel">Generated time</div>
                <div className="detailValue">{generatedAt.toLocaleTimeString()}</div>
              </div>
              <div className="detailItem">
                <div className="detailLabel">Data sources</div>
                <div className="detailValue">Supabase + Open Meteo + rule-based engine</div>
              </div>
            </div>
          </div>

          <div className="kpiGrid">
            <div
              className="card card-pad"
              style={{
                background: "linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)",
                borderColor: "#bae6fd",
              }}
            >
              <div className="kpiLabel" style={{ color: "#0369a1" }}>Total Pipelines</div>
              <div className="kpiValue" style={{ color: "#0c4a6e" }}>{totalPipelines}</div>
            </div>

            <div
              className="card card-pad"
              style={{
                background: "linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)",
                borderColor: "#fecaca",
              }}
            >
              <div className="kpiLabel" style={{ color: "#b91c1c" }}>High Risk Pipelines</div>
              <div className="kpiValue" style={{ color: "#7f1d1d" }}>{highRiskCount}</div>
            </div>

            <div
              className="card card-pad"
              style={{
                background: "linear-gradient(135deg, #fefce8 0%, #fef3c7 100%)",
                borderColor: "#fde68a",
              }}
            >
              <div className="kpiLabel" style={{ color: "#a16207" }}>Medium Risk Pipelines</div>
              <div className="kpiValue" style={{ color: "#854d0e" }}>{mediumRiskCount}</div>
            </div>

            <div
              className="card card-pad"
              style={{
                background: "linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)",
                borderColor: "#a7f3d0",
              }}
            >
              <div className="kpiLabel" style={{ color: "#047857" }}>Average Risk Score</div>
              <div className="kpiValue" style={{ color: "#064e3b" }}>{avgRiskScore}</div>
            </div>

            <div
              className="card card-pad"
              style={{
                background: "linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)",
                borderColor: "#fdba74",
              }}
            >
              <div className="kpiLabel" style={{ color: "#c2410c" }}>Critical Maintenance</div>
              <div className="kpiValue" style={{ color: "#9a3412" }}>{criticalTasks}</div>
            </div>

            <div
              className="card card-pad"
              style={{
                background: "linear-gradient(135deg, #fdf4ff 0%, #fae8ff 100%)",
                borderColor: "#f5d0fe",
              }}
            >
              <div className="kpiLabel" style={{ color: "#86198f" }}>Total Leak Records</div>
              <div className="kpiValue" style={{ color: "#4a044e" }}>{totalLeaks}</div>
            </div>
          </div>

          <div
            className="card card-pad"
            style={{ marginTop: 24, marginBottom: 24 }}
          >
            <div className="sectionHeader">
              <div>
                <div className="sectionTitle">Executive summary</div>
                <div className="sectionSubtitle">
                  High-level interpretation of the current dataset.
                </div>
              </div>
            </div>

            <div className="vstack">
              <div className="detailItem">
                <div className="detailLabel">Risk overview</div>
                <div className="detailValue">
                  Out of {totalPipelines} pipelines, {highRiskCount} are High risk, {mediumRiskCount} are Medium risk, and {lowRiskCount} are Low risk.
                </div>
              </div>

              <div className="detailItem">
                <div className="detailLabel">Maintenance priority</div>
                <div className="detailValue">
                  Critical tasks: {criticalTasks} • Moderate tasks: {moderateTasks} • Low priority tasks: {lowPriorityTasks}
                </div>
              </div>

              <div className="detailItem">
                <div className="detailLabel">Rain condition</div>
                <div className="detailValue">
                  {liveRain
                    ? `Kalutara live rain is ${Number(liveRain.rain_mm || 0).toFixed(1)} mm (${getRainStatus(
                        liveRain.rain_mm
                      )}), updated at ${liveRain.updated_time || "-"}`
                    : "Live rain data not available."}
                </div>
              </div>

              <div className="detailItem">
                <div className="detailLabel">Asset age insight</div>
                <div className="detailValue">
                  The oldest recorded pipeline installation year in the current dataset is {oldestInstallYear}.
                </div>
              </div>
            </div>
          </div>

          <div
            className="chartsSection"
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "24px",
              marginTop: "24px",
            }}
          >
            <div
              className="card card-pad"
              style={{ height: "380px", display: "flex", flexDirection: "column" }}
            >
              <div className="chartHeader" style={{ marginBottom: "16px" }}>
                <div className="chartTitle" style={{ fontSize: "16px", color: "#334155" }}>
                  Risk Distribution
                </div>
              </div>

              <div style={{ flex: 1, minHeight: 0 }}>
                <ResponsiveContainer width="100%" height="100%">
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
                    <RechartsTooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div
              className="card card-pad"
              style={{ height: "380px", display: "flex", flexDirection: "column" }}
            >
              <div className="chartHeader" style={{ marginBottom: "16px" }}>
                <div className="chartTitle" style={{ fontSize: "16px", color: "#334155" }}>
                  Material Distribution
                </div>
              </div>

              <div style={{ flex: 1, minHeight: 0 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={materialDistribution.slice(0, 8)} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} />
                    <RechartsTooltip
                      contentStyle={{
                        borderRadius: "8px",
                        border: "1px solid #e2e8f0",
                        boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                      }}
                    />
                    <Legend />
                    <Bar dataKey="value" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div
              className="card card-pad"
              style={{ height: "380px", display: "flex", flexDirection: "column" }}
            >
              <div className="chartHeader" style={{ marginBottom: "16px" }}>
                <div className="chartTitle" style={{ fontSize: "16px", color: "#334155" }}>
                  Pipelines by Division
                </div>
              </div>

              <div style={{ flex: 1, minHeight: 0 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={divisionDistribution.slice(0, 8)} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 12, fill: "#64748b" }}
                      axisLine={false}
                      tickLine={false}
                      angle={-20}
                      textAnchor="end"
                      height={60}
                    />
                    <YAxis tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} />
                    <RechartsTooltip
                      contentStyle={{
                        borderRadius: "8px",
                        border: "1px solid #e2e8f0",
                        boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                      }}
                    />
                    <Legend />
                    <Bar dataKey="value" fill="#14b8a6" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div
              className="card card-pad"
              style={{ height: "380px", display: "flex", flexDirection: "column" }}
            >
              <div className="chartHeader" style={{ marginBottom: "16px" }}>
                <div className="chartTitle" style={{ fontSize: "16px", color: "#334155" }}>
                  Top 10 Leak Pipelines
                </div>
              </div>

              <div style={{ flex: 1, minHeight: 0 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topLeakPipelines} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 12, fill: "#64748b" }}
                      axisLine={false}
                      tickLine={false}
                      angle={-25}
                      textAnchor="end"
                      height={70}
                    />
                    <YAxis tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} />
                    <RechartsTooltip
                      contentStyle={{
                        borderRadius: "8px",
                        border: "1px solid #e2e8f0",
                        boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                      }}
                    />
                    <Legend />
                    <Bar dataKey="leaks" fill="#ef4444" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="panelGrid" style={{ marginTop: 24 }}>
            <div className="card card-pad">
              <div className="sectionHeader">
                <div>
                  <div className="sectionTitle">Top risky divisions</div>
                  <div className="sectionSubtitle">
                    Divisions ordered by average risk score.
                  </div>
                </div>
              </div>

              <div className="vstack">
                {topRiskDivisions.map((item) => (
                  <div key={item.division} className="detailItem">
                    <div className="detailLabel">{item.division}</div>
                    <div className="detailValue">
                      Avg Risk: {item.avgRisk} • Pipelines: {item.count} • High Risk: {item.highRisk}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card card-pad">
              <div className="sectionHeader">
                <div>
                  <div className="sectionTitle">Rain & maintenance context</div>
                  <div className="sectionSubtitle">
                    Operational conditions relevant to reporting.
                  </div>
                </div>
              </div>

              <div className="vstack">
                <div className="detailItem">
                  <div className="detailLabel">Live rain</div>
                  <div className="detailValue">
                    {liveRain
                      ? `${Number(liveRain.rain_mm || 0).toFixed(1)} mm • ${getRainStatus(
                          liveRain.rain_mm
                        )}`
                      : "Not available"}
                  </div>
                </div>

                <div className="detailItem">
                  <div className="detailLabel">Rain score</div>
                  <div className="detailValue">
                    {liveRain ? Number(liveRain.rain_score || 0).toFixed(2) : "-"}
                  </div>
                </div>

                <div className="detailItem">
                  <div className="detailLabel">Critical maintenance tasks</div>
                  <div className="detailValue">{criticalTasks}</div>
                </div>

                <div className="detailItem">
                  <div className="detailLabel">Moderate maintenance tasks</div>
                  <div className="detailValue">{moderateTasks}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="card card-pad" style={{ marginTop: "24px" }}>
            <div className="title" style={{ fontSize: "16px", marginBottom: "16px" }}>
              Top risky pipeline summary table
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
                    <th>Leak Count</th>
                    <th>Risk Score</th>
                    <th>Risk Level</th>
                    <th>Priority</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {topRiskPipelines.map((p) => (
                    <tr key={p.pipeline_id}>
                      <td>
                        <Link
                          to={`/pipelines/${p.pipeline_id}`}
                          style={{ textDecoration: "none", color: "var(--primary)", fontWeight: 800 }}
                        >
                          {p.pipeline_id}
                        </Link>
                      </td>
                      <td>{p.ds_division || "-"}</td>
                      <td>{p.area_name || "-"}</td>
                      <td>{p.material_type || "-"}</td>
                      <td>{p.install_year || "-"}</td>
                      <td>{p.previous_leak_count || 0}</td>
                      <td>{Number(p.risk_score || 0).toFixed(3)}</td>
                      <td>
                        <span className={`badge ${riskBadgeClass(p.risk_level)}`}>
                          {p.risk_level}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${priorityBadgeClass(p.recommendation?.priority || "Low")}`}>
                          {p.recommendation?.priority || "Low"}
                        </span>
                      </td>
                      <td>{p.recommendation?.action || "-"}</td>
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

        @media print {
          .sidebar, .btn, .no-print {
            display: none !important;
          }

          .appMain, body {
            background: #fff !important;
          }

          .card {
            box-shadow: none !important;
            border-color: #000 !important;
          }

          .container {
            padding: 0 !important;
          }
        }

        @media (max-width: 1000px) {
          .chartsSection {
            grid-template-columns: 1fr !important;
          }

          .reportMetaGrid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}