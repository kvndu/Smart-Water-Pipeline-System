import { useEffect, useMemo, useState } from "react";
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

export default function Reports() {
  const [pipelines, setPipelines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    async function fetchReportsData() {
      try {
        setLoading(true);
        setErrorMsg("");
        const res = await api.get("/pipelines-with-risk?limit=100");
        setPipelines(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        console.error("Reports fetch error:", err);
        setPipelines([]);
        setErrorMsg("Failed to load reports data.");
      } finally {
        setLoading(false);
      }
    }

    fetchReportsData();
  }, []);

  const totalPipelines = pipelines.length;

  const totalLeaks = useMemo(() => {
    return pipelines.reduce((sum, p) => sum + Number(p.previous_leak_count || 0), 0);
  }, [pipelines]);

  const avgRiskScore = useMemo(() => {
    if (!pipelines.length) return 0;
    const total = pipelines.reduce((sum, p) => sum + Number(p.risk_score || 0), 0);
    return (total / pipelines.length).toFixed(3);
  }, [pipelines]);

  const oldestInstallYear = useMemo(() => {
    if (!pipelines.length) return "-";
    return Math.min(...pipelines.map((p) => Number(p.install_year || 9999)));
  }, [pipelines]);

  const highRiskCount = pipelines.filter((p) => p.risk_level === "High").length;
  const mediumRiskCount = pipelines.filter((p) => p.risk_level === "Medium").length;
  const lowRiskCount = pipelines.filter((p) => p.risk_level === "Low").length;

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

  const topLeakPipelines = useMemo(() => {
    return [...pipelines]
      .map((p) => ({
        name: p.pipeline_id,
        leaks: Number(p.previous_leak_count || 0),
      }))
      .sort((a, b) => b.leaks - a.leaks)
      .slice(0, 10);
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
      risk_score: p.risk_score,
      risk_level: p.risk_level,
      recommendation: p.recommendation,
    }));
  }, [pipelines]);

  function handleDownloadCSV() {
    setDownloading("excel");
    setTimeout(() => {
      downloadCSV("Kalutara_District_Report.csv", exportRows);
      setDownloading("");
    }, 400);
  }

  function handleDownloadPDF() {
    setDownloading("pdf");
    setTimeout(() => {
      window.print();
      setDownloading("");
    }, 400);
  }

  return (
    <div className="container" style={{ animation: "fadeIn 0.4s ease-in-out" }}>
      <div className="header" style={{ marginBottom: "24px" }}>
        <div>
          <div className="title" style={{ fontSize: "24px", color: "var(--primary)" }}>
            Reports & Analytics
          </div>
          <div className="subtitle" style={{ fontSize: "14px" }}>
            Summary reports for Kalutara district: risk distribution, materials, divisions, and leak records.
          </div>
        </div>

        <div className="hstack">
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
            {downloading === "excel" ? "Generating..." : "Download Excel"}
          </button>

          <button
            className="btn primary"
            style={{ display: "flex", alignItems: "center", gap: "6px" }}
            onClick={handleDownloadPDF}
            disabled={!!downloading}
          >
            <span style={{ fontSize: "16px" }}>📄</span>
            {downloading === "pdf" ? "Preparing..." : "Download PDF"}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="card card-pad">Loading reports...</div>
      ) : errorMsg ? (
        <div className="card card-pad" style={{ color: "red" }}>{errorMsg}</div>
      ) : (
        <>
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
              <div className="kpiLabel" style={{ color: "#b91c1c" }}>Total Leak Records</div>
              <div className="kpiValue" style={{ color: "#7f1d1d" }}>{totalLeaks}</div>
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
                background: "linear-gradient(135deg, #fdf4ff 0%, #fae8ff 100%)",
                borderColor: "#f5d0fe",
              }}
            >
              <div className="kpiLabel" style={{ color: "#86198f" }}>Oldest Install Year</div>
              <div className="kpiValue" style={{ color: "#4a044e" }}>{oldestInstallYear}</div>
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
            {/* Risk Distribution */}
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

            {/* Material Distribution */}
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
                  <BarChart data={materialDistribution} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
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

            {/* Division Distribution */}
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
                  <BarChart data={divisionDistribution} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
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

            {/* Top Leak Pipelines */}
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

          {/* Summary Table */}
          <div className="card card-pad" style={{ marginTop: "24px" }}>
            <div className="title" style={{ fontSize: "16px", marginBottom: "16px" }}>
              Report Summary Table
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
                    <th>Recommendation</th>
                  </tr>
                </thead>
                <tbody>
                  {pipelines.slice(0, 15).map((p) => (
                    <tr key={p.pipeline_id}>
                      <td>{p.pipeline_id}</td>
                      <td>{p.ds_division}</td>
                      <td>{p.area_name}</td>
                      <td>{p.material_type}</td>
                      <td>{p.install_year}</td>
                      <td>{p.previous_leak_count}</td>
                      <td>{p.risk_score}</td>
                      <td>{p.risk_level}</td>
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

        @media print {
          .sidebar, .btn { display: none !important; }
          .appMain { background: #fff !important; }
          .card { box-shadow: none !important; border-color: #000 !important; }
          body { background: #fff !important; }
        }

        @media (max-width: 1000px) {
          .chartsSection { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}