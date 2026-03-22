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

export default function Analytics() {
  const [pipelines, setPipelines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    async function fetchAnalyticsData() {
      try {
        setLoading(true);
        setErrorMsg("");
        const res = await api.get("/pipelines-with-risk?limit=100");
        setPipelines(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        console.error("Analytics fetch error:", err);
        setPipelines([]);
        setErrorMsg("Failed to load analytics data.");
      } finally {
        setLoading(false);
      }
    }

    fetchAnalyticsData();
  }, []);

  const totalPipelines = pipelines.length;
  const avgRiskScore = useMemo(() => {
    if (!pipelines.length) return 0;
    const total = pipelines.reduce((sum, p) => sum + Number(p.risk_score || 0), 0);
    return (total / pipelines.length).toFixed(3);
  }, [pipelines]);

  const totalLeaks = useMemo(() => {
    return pipelines.reduce((sum, p) => sum + Number(p.previous_leak_count || 0), 0);
  }, [pipelines]);

  const oldestInstallYear = useMemo(() => {
    if (!pipelines.length) return "-";
    return Math.min(...pipelines.map((p) => Number(p.install_year || 9999)));
  }, [pipelines]);

  const riskDistribution = useMemo(() => {
    const low = pipelines.filter((p) => p.risk_level === "Low").length;
    const medium = pipelines.filter((p) => p.risk_level === "Medium").length;
    const high = pipelines.filter((p) => p.risk_level === "High").length;

    return [
      { name: "Low", value: low },
      { name: "Medium", value: medium },
      { name: "High", value: high },
    ];
  }, [pipelines]);

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

  const leakDistribution = useMemo(() => {
    return pipelines
      .map((p) => ({
        name: p.pipeline_id,
        value: Number(p.previous_leak_count || 0),
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [pipelines]);

  const installYearDistribution = useMemo(() => {
    const groups = {
      "1960-1979": 0,
      "1980-1999": 0,
      "2000-2009": 0,
      "2010-2025": 0,
    };

    pipelines.forEach((p) => {
      const y = Number(p.install_year || 0);
      if (y >= 1960 && y <= 1979) groups["1960-1979"] += 1;
      else if (y >= 1980 && y <= 1999) groups["1980-1999"] += 1;
      else if (y >= 2000 && y <= 2009) groups["2000-2009"] += 1;
      else if (y >= 2010 && y <= 2025) groups["2010-2025"] += 1;
    });

    return Object.entries(groups).map(([name, value]) => ({ name, value }));
  }, [pipelines]);

  return (
    <div className="container" style={{ animation: "fadeIn 0.5s ease-out" }}>
      <div className="header" style={{ marginBottom: "28px" }}>
        <div>
          <div
            className="title"
            style={{ fontSize: "28px", color: "var(--text)", fontWeight: 900, marginBottom: "4px" }}
          >
            Data Analytics
          </div>
          <div className="subtitle" style={{ fontSize: "15px", color: "var(--muted)" }}>
            Backend-powered charts and summaries generated directly from pipeline data.
          </div>
        </div>

        <div className="hstack">
          <span
            className="badge ok"
            style={{
              fontSize: "12px",
              padding: "6px 12px",
              background: "#ecfdf5",
              color: "#065f46",
              border: "1px solid #a7f3d0",
            }}
          >
            ✓ Dataset-based Rendering
          </span>
        </div>
      </div>

      {loading ? (
        <div className="card card-pad">Loading analytics...</div>
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
            <StatCard label="Average Risk Score" value={avgRiskScore} hint="Across current dataset" />
            <StatCard label="Total Leak Records" value={totalLeaks} hint="Sum of previous leaks" />
            <StatCard label="Oldest Install Year" value={oldestInstallYear} hint="Oldest pipe in dataset" />
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
                Top 10 Leak Counts
              </div>
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={leakDistribution}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" angle={-25} textAnchor="end" height={80} />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="value" fill="#ef4444" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card card-pad">
            <div className="title" style={{ fontSize: "16px", marginBottom: "16px" }}>
              Installation Year Groups
            </div>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={installYearDistribution}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="value" fill="#8b5cf6" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @media (max-width: 900px) {
          .grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}