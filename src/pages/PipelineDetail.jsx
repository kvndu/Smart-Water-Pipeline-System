import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
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

function getRecommendation(p) {
  const risk = getRiskLevel(p);
  const criticality = getCriticality(p);

  if (risk === "HIGH" || criticality >= 8) {
    return "Immediate inspection required";
  }

  if (risk === "MEDIUM") {
    return "Schedule preventive maintenance";
  }

  return "Routine monitoring";
}

export default function Pipelines() {
  const [pipelines, setPipelines] = useState([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [riskFilter, setRiskFilter] = useState("ALL");
  const [materialFilter, setMaterialFilter] = useState("ALL");
  const [categoryFilter, setCategoryFilter] = useState("ALL");

  useEffect(() => {
    async function fetchPipelines() {
      setLoading(true);

      const { data, error } = await supabase
        .from("pipelines")
        .select("*")
        .limit(1000);

      if (error) {
        console.error("Pipeline fetch error:", error);
        setPipelines([]);
      } else {
        setPipelines(data || []);
      }

      setLoading(false);
    }

    fetchPipelines();
  }, []);

  const materials = useMemo(() => {
    return [
      "ALL",
      ...new Set(
        pipelines
          .map((p) => p.MATERIAL)
          .filter(Boolean)
          .map((x) => String(x).trim())
      ),
    ];
  }, [pipelines]);

  const categories = useMemo(() => {
    return [
      "ALL",
      ...new Set(
        pipelines
          .map((p) => p.CATEGORY)
          .filter(Boolean)
          .map((x) => String(x).trim())
      ),
    ];
  }, [pipelines]);

  const enriched = useMemo(() => {
    return pipelines.map((p) => ({
      ...p,
      risk: getRiskLevel(p),
      condition: getConditionScore(p),
      criticality: getCriticality(p),
      recommendation: getRecommendation(p),
    }));
  }, [pipelines]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();

    return enriched.filter((p) => {
      const matchSearch =
        !q ||
        String(p.WATMAINID || "").toLowerCase().includes(q) ||
        String(p.OBJECTID || "").toLowerCase().includes(q) ||
        String(p.MATERIAL || "").toLowerCase().includes(q) ||
        String(p.PIPE_SIZE || "").toLowerCase().includes(q) ||
        String(p.PRESSURE_ZONE || "").toLowerCase().includes(q);

      const matchRisk = riskFilter === "ALL" || p.risk === riskFilter;
      const matchMaterial =
        materialFilter === "ALL" || String(p.MATERIAL) === materialFilter;
      const matchCategory =
        categoryFilter === "ALL" || String(p.CATEGORY) === categoryFilter;

      return matchSearch && matchRisk && matchMaterial && matchCategory;
    });
  }, [enriched, search, riskFilter, materialFilter, categoryFilter]);

  const stats = useMemo(() => {
    return {
      total: enriched.length,
      high: enriched.filter((p) => p.risk === "HIGH").length,
      medium: enriched.filter((p) => p.risk === "MEDIUM").length,
      low: enriched.filter((p) => p.risk === "LOW").length,
    };
  }, [enriched]);

  if (loading) {
    return <div className="pipelinePage">Loading pipeline records...</div>;
  }

  return (
    <div className="pipelinePage">
      <div className="hero">
        <div>
          <div className="eyebrow">Asset Inventory</div>
          <h1>Pipeline Records</h1>
          <p>
            Real-world Waterloo water mains dataset එකෙන් pipeline asset
            details, condition score, criticality සහ risk level manage කරන page එක.
          </p>
        </div>

        <div className="heroBadges">
          <span>{stats.total} records</span>
          <span>{stats.high} high risk</span>
          <span>{stats.medium} medium risk</span>
        </div>
      </div>

      <div className="kpiGrid">
        <Kpi title="Total Records" value={stats.total} />
        <Kpi title="High Risk" value={stats.high} color="#ef4444" />
        <Kpi title="Medium Risk" value={stats.medium} color="#f59e0b" />
        <Kpi title="Low / Normal" value={stats.low} color="#0284c7" />
      </div>

      <div className="panel">
        <div className="panelHead">
          <div>
            <h2>Water Main Asset List</h2>
            <p>Search and filter real pipeline records from Supabase.</p>
          </div>
        </div>

        <div className="filters">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search WATMAINID, OBJECTID, material, size, zone..."
          />

          <select value={riskFilter} onChange={(e) => setRiskFilter(e.target.value)}>
            <option value="ALL">All Risk</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>

          <select
            value={materialFilter}
            onChange={(e) => setMaterialFilter(e.target.value)}
          >
            {materials.map((m) => (
              <option key={m} value={m}>
                {m === "ALL" ? "All Material" : m}
              </option>
            ))}
          </select>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            {categories.map((c) => (
              <option key={c} value={c}>
                {c === "ALL" ? "All Category" : c}
              </option>
            ))}
          </select>
        </div>

        <div className="smallText">
          Showing {filtered.length} of {enriched.length} records.
        </div>

        <div className="tableWrap">
          <table>
            <thead>
              <tr>
                <th>WATMAINID</th>
                <th>Object ID</th>
                <th>Material</th>
                <th>Pipe Size</th>
                <th>Pressure Zone</th>
                <th>Category</th>
                <th>Status</th>
                <th>Condition</th>
                <th>Criticality</th>
                <th>Length</th>
                <th>Risk</th>
                <th>Recommendation</th>
                <th>Details</th>
              </tr>
            </thead>

            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan="13" className="emptyCell">
                    No pipeline records found.
                  </td>
                </tr>
              ) : (
                filtered.map((p) => (
                  <tr key={p.OBJECTID}>
                    <td className="strong">{p.WATMAINID || "N/A"}</td>
                    <td>{p.OBJECTID || "N/A"}</td>
                    <td>{p.MATERIAL || "N/A"}</td>
                    <td>{p.PIPE_SIZE || p.MAP_LABEL || "N/A"}</td>
                    <td>{p.PRESSURE_ZONE || "N/A"}</td>
                    <td>{p.CATEGORY || "N/A"}</td>
                    <td>{p.STATUS || "N/A"}</td>
                    <td>{p.condition ?? "N/A"}</td>
                    <td>{p.criticality ?? "N/A"}</td>
                    <td>{p.Shape__Length || "N/A"}</td>
                    <td>
                      <span
                        className="riskBadge"
                        style={{ background: getRiskColor(p.risk) }}
                      >
                        {p.risk}
                      </span>
                    </td>
                    <td>{p.recommendation}</td>
                    <td>
                      <Link
                        className="viewBtn"
                        to={`/pipelines/${p.WATMAINID || p.OBJECTID}`}
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <style>{`
        .pipelinePage {
          padding: 28px;
          animation: fadeIn 0.35s ease;
        }

        .hero {
          background: linear-gradient(135deg, #ffffff, #eff6ff);
          border: 1px solid #e2e8f0;
          border-radius: 24px;
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
          background: #dbeafe;
          color: #2563eb;
          font-weight: 900;
          font-size: 12px;
          letter-spacing: 1px;
          padding: 7px 12px;
          border-radius: 999px;
          text-transform: uppercase;
          margin-bottom: 10px;
        }

        .hero h1 {
          margin: 0;
          font-size: 30px;
          color: #0f172a;
        }

        .hero p {
          margin: 8px 0 0;
          color: #64748b;
          max-width: 760px;
        }

        .heroBadges {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          justify-content: flex-end;
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

        .kpiGrid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
          margin-bottom: 22px;
        }

        .kpi {
          background: #fff;
          border: 1px solid #e2e8f0;
          border-radius: 18px;
          padding: 18px;
          box-shadow: 0 10px 25px rgba(15,23,42,0.05);
        }

        .kpiTitle {
          color: #64748b;
          font-size: 13px;
          font-weight: 800;
        }

        .kpiValue {
          margin-top: 8px;
          font-size: 32px;
          font-weight: 950;
        }

        .panel {
          background: #fff;
          border: 1px solid #e2e8f0;
          border-radius: 22px;
          padding: 20px;
          box-shadow: 0 18px 45px rgba(15,23,42,0.07);
        }

        .panelHead h2 {
          margin: 0;
          font-size: 22px;
          color: #0f172a;
        }

        .panelHead p {
          margin: 6px 0 16px;
          color: #64748b;
          font-size: 14px;
        }

        .filters {
          display: grid;
          grid-template-columns: 1fr 150px 180px 180px;
          gap: 12px;
          margin-bottom: 12px;
        }

        input, select {
          height: 42px;
          border: 1px solid #cbd5e1;
          border-radius: 12px;
          padding: 0 12px;
          font-weight: 700;
          background: #fff;
          color: #0f172a;
        }

        .smallText {
          color: #64748b;
          font-size: 13px;
          font-weight: 800;
          margin-bottom: 14px;
        }

        .tableWrap {
          overflow-x: auto;
          max-height: 680px;
          overflow-y: auto;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          min-width: 1450px;
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
          vertical-align: middle;
        }

        tr:hover td {
          background: #f8fafc;
        }

        .strong {
          font-weight: 950;
          color: #2563eb;
        }

        .riskBadge {
          color: #fff;
          padding: 6px 10px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 950;
          display: inline-block;
          white-space: nowrap;
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

        .emptyCell {
          text-align: center;
          color: #64748b;
          font-weight: 800;
          padding: 30px;
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(5px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @media (max-width: 1000px) {
          .hero,
          .kpiGrid,
          .filters {
            grid-template-columns: 1fr;
            display: grid;
          }
        }
      `}</style>
    </div>
  );
}

function Kpi({ title, value, color = "#0f172a" }) {
  return (
    <div className="kpi">
      <div className="kpiTitle">{title}</div>
      <div className="kpiValue" style={{ color }}>
        {value}
      </div>
    </div>
  );
}