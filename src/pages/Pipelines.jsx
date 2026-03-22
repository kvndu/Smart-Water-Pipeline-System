import { useEffect, useMemo, useState } from "react";
import PipelineTable from "../components/PipelineTable.jsx";
import PipelineMapPlaceholder from "../components/PipelineMapPlaceholder.jsx";
import AlertPanel from "../components/AlertPanel.jsx";
import { exportToCSV } from "../utils/exportUtils.js";
import api from "../utils/api.js";

function statusBadgeClass(status) {
  if (status === "UNDER_REPAIR") return "danger";
  if (status === "UNDER_MAINTENANCE") return "warn";
  if (status === "INACTIVE") return "";
  return "ok";
}

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
        time: "This week",
      });
    } else if (leaks === 1) {
      alerts.push({
        id: `AL-${p.pipeline_id}-L`,
        title: "Leak Detected",
        severity: "Medium",
        pipeline_id: p.pipeline_id,
        area: p.area_name,
        time: "Today",
      });
    }

    if (risk === "high") {
      alerts.push({
        id: `AL-${p.pipeline_id}-R`,
        title: "High Risk Pipeline",
        severity: leaks > 0 ? "High" : "Medium",
        pipeline_id: p.pipeline_id,
        area: p.area_name,
        time: "Now",
      });
    }
  });

  return alerts;
}

export default function Pipelines({ showToast }) {
  const [pipelines, setPipelines] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);

  const [q, setQ] = useState("");
  const [division, setDivision] = useState("All");
  const [risk, setRisk] = useState("All");
  const [material, setMaterial] = useState("All");
  const [highOnly, setHighOnly] = useState(false);
  const [sortBy, setSortBy] = useState("");

  useEffect(() => {
    async function fetchPipelines() {
      try {
        setLoading(true);
        const res = await api.get("/pipelines-with-risk?limit=100");
        console.log("Backend response:", res.data);

        if (Array.isArray(res.data)) {
          setPipelines(res.data);
        } else {
          setPipelines([]);
        }
      } catch (err) {
        console.error("Fetch error:", err);
        setPipelines([]);
        showToast?.("Failed to load pipelines from backend", "error");
      } finally {
        setLoading(false);
      }
    }

    fetchPipelines();
  }, []);

  const alerts = useMemo(() => buildAlerts(pipelines), [pipelines]);

  const divisions = useMemo(
    () => ["All", ...Array.from(new Set(pipelines.map((p) => p.ds_division).filter(Boolean)))],
    [pipelines]
  );

  const materials = useMemo(
    () => ["All", ...Array.from(new Set(pipelines.map((p) => p.material_type).filter(Boolean)))],
    [pipelines]
  );

  const risks = ["All", "Low", "Medium", "High"];

  const filtered = useMemo(() => {
    return pipelines.filter((p) => {
      const matchesQ =
        q.trim() === "" ||
        `${p.pipeline_id} ${p.area_name} ${p.ds_division} ${p.material_type}`
          .toLowerCase()
          .includes(q.toLowerCase());

      const matchesDivision = division === "All" || p.ds_division === division;
      const matchesRisk = risk === "All" || p.risk_level === risk;
      const matchesMaterial = material === "All" || p.material_type === material;
      const matchesHighOnly = !highOnly || p.risk_level === "High";

      return matchesQ && matchesDivision && matchesRisk && matchesMaterial && matchesHighOnly;
    });
  }, [pipelines, q, division, risk, material, highOnly]);

  const sorted = useMemo(() => {
    const data = [...filtered];

    if (sortBy === "risk") {
      const order = { High: 3, Medium: 2, Low: 1 };
      data.sort((a, b) => (order[b.risk_level] || 0) - (order[a.risk_level] || 0));
    }

    if (sortBy === "leaks") {
      data.sort(
        (a, b) => (Number(b.previous_leak_count) || 0) - (Number(a.previous_leak_count) || 0)
      );
    }

    if (sortBy === "install_year") {
      data.sort((a, b) => a.install_year - b.install_year);
    }

    return data;
  }, [filtered, sortBy]);

  function clearFilters() {
    setQ("");
    setDivision("All");
    setRisk("All");
    setMaterial("All");
    setHighOnly(false);
    setSortBy("");
    showToast?.("Filters cleared", "success");
  }

  const tableRows = useMemo(() => {
    return sorted.map((p) => ({
      ...p,
      pipe_name: p.pipeline_id,
      area: p.area_name,
      zone: p.ds_division,
      material: p.material_type,
      corrosion_risk: p.risk_level,
      leak_count: p.previous_leak_count,
      length_m: p.pipe_length_m,
      status: p.risk_level === "High" ? "UNDER_MAINTENANCE" : "ACTIVE",
      gps_latitude: "-",
      gps_longitude: "-",
      last_maintenance_date: p.last_maintenance_year ? `${p.last_maintenance_year}-01-01` : "",
    }));
  }, [sorted]);

  return (
    <div className="container" style={{ animation: "fadeIn 0.4s ease-in-out" }}>
      <div className="header" style={{ marginBottom: "24px" }}>
        <div>
          <div className="title" style={{ fontSize: "24px", color: "var(--text)" }}>
            Pipelines Management
          </div>
          <div className="subtitle" style={{ fontSize: "14px" }}>
            View pipeline records from backend, calculated risk levels, and maintenance recommendations.
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
              fontWeight: 800,
            }}
            type="button"
            onClick={() => exportToCSV("pipelines_report.csv", sorted)}
          >
            <span style={{ fontSize: "14px" }}>📊</span> Export CSV
          </button>

          <span
            className="badge"
            style={{
              background: "var(--primary)",
              borderColor: "var(--primary)",
              color: "#fff",
              padding: "6px 12px",
              fontSize: "14px",
            }}
          >
            {pipelines.length} Total
          </span>
        </div>
      </div>

      <div className="card card-pad" style={{ marginBottom: "20px", borderColor: "#e2e8f0" }}>
        <div style={{ paddingBottom: "10px", borderBottom: "1px solid var(--border)", marginBottom: "14px" }}>
          <div className="title" style={{ fontSize: "14px" }}>🔍 Filter & Sort</div>
        </div>

        <div className="toolbar" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <input
            className="input"
            placeholder="Search pipeline by ID, area, division, or material..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ fontSize: "14px", padding: "12px", background: "#f8fafc" }}
          />

          <div className="hstack" style={{ flexWrap: "wrap", gap: "8px" }}>
            <select
              className="select"
              value={division}
              onChange={(e) => setDivision(e.target.value)}
              style={{ width: "auto" }}
            >
              {divisions.map((d) => (
                <option key={d} value={d}>
                  Division: {d === "All" ? "All" : d}
                </option>
              ))}
            </select>

            <select
              className="select"
              value={material}
              onChange={(e) => setMaterial(e.target.value)}
              style={{ width: "auto" }}
            >
              {materials.map((m) => (
                <option key={m} value={m}>
                  Material: {m === "All" ? "All" : m}
                </option>
              ))}
            </select>

            <select
              className="select"
              value={risk}
              onChange={(e) => setRisk(e.target.value)}
              style={{ width: "auto" }}
            >
              {risks.map((r) => (
                <option key={r} value={r}>
                  Risk: {r === "All" ? "All" : r}
                </option>
              ))}
            </select>

            <select
              className="select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              style={{ width: "auto", fontWeight: 700 }}
            >
              <option value="">Sort: None</option>
              <option value="risk">Sort: Risk (High→Low)</option>
              <option value="leaks">Sort: Leak Count (High→Low)</option>
              <option value="install_year">Sort: Oldest Install Year First</option>
            </select>
          </div>

          <div
            className="hstack"
            style={{
              borderTop: "1px dashed var(--border)",
              paddingTop: "12px",
              flexWrap: "wrap",
              gap: "10px",
            }}
          >
            <button
              type="button"
              className={`btn ${highOnly ? "danger" : ""}`}
              style={{ fontWeight: 800, fontSize: "12px" }}
              onClick={() => setHighOnly((v) => !v)}
            >
              {highOnly ? "🔴 High Risk: ON" : "High Risk Only"}
            </button>

            <button
              type="button"
              className="btn"
              style={{ fontSize: "12px", background: "#f1f5f9" }}
              onClick={clearFilters}
            >
              Reset Filters
            </button>

            <div style={{ marginLeft: "auto", fontWeight: 800, color: "var(--muted)", fontSize: "13px" }}>
              Showing {sorted.length} results
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="card card-pad">Loading pipelines...</div>
      ) : (
        <div
          className="grid"
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 340px",
            gap: "20px",
            marginTop: "20px",
          }}
        >
          <div className="vstack" style={{ gap: "20px" }}>
            <div className="card card-pad" style={{ padding: "0", overflow: "hidden" }}>
              <PipelineMapPlaceholder selected={selected} />
            </div>

            <div className="card card-pad" style={{ padding: "0" }}>
              <PipelineTable
                rows={tableRows}
                selectedId={selected?.pipeline_id}
                onSelect={(p) => setSelected(p)}
              />
            </div>
          </div>

          <div className="vstack" style={{ gap: "20px" }}>
            <AlertPanel alerts={alerts} />

            <div
              className="card card-pad"
              style={{
                borderColor: selected ? "var(--primary)" : "#e2e8f0",
                transition: "all 0.3s",
              }}
            >
              <div className="title" style={{ fontSize: 16 }}>Pipeline Inspector</div>

              {selected ? (
                <div className="vstack" style={{ marginTop: 14 }}>
                  <div style={{ borderBottom: "1px solid var(--border)", paddingBottom: "10px" }}>
                    <div style={{ fontSize: "18px", fontWeight: 900, color: "var(--primary)" }}>
                      {selected.pipeline_id}
                    </div>
                    <div style={{ color: "var(--text)", fontWeight: 600 }}>
                      {selected.area_name}
                    </div>
                    <div className="small" style={{ marginTop: "4px" }}>
                      📍 {selected.area_name} / {selected.ds_division}
                    </div>
                  </div>

                  <div className="hstack" style={{ flexWrap: "wrap", gap: "8px", marginTop: "4px" }}>
                    <span className="badge" style={{ background: "#f1f5f9" }}>
                      {selected.material_type}
                    </span>
                    <span className="badge" style={{ background: "#f1f5f9" }}>
                      {selected.diameter_mm} mm
                    </span>
                    <span className="badge" style={{ background: "#f1f5f9" }}>
                      {selected.pipe_length_m} m
                    </span>

                    <span
                      className={`badge ${
                        selected.risk_level === "High"
                          ? "danger"
                          : selected.risk_level === "Medium"
                          ? "warn"
                          : "ok"
                      }`}
                    >
                      Risk: {selected.risk_level}
                    </span>

                    <span className={`badge ${statusBadgeClass(selected.status)}`}>
                      {selected.status || "ACTIVE"}
                    </span>
                  </div>

                  <div
                    className="small"
                    style={{
                      marginTop: "8px",
                      lineHeight: "1.6",
                      background: "#f8fafc",
                      padding: "12px",
                      borderRadius: "8px",
                      border: "1px solid #e2e8f0",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span>Install Year:</span> <b>{selected.install_year}</b>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span>Previous Leaks:</span> <b>{selected.previous_leak_count}</b>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span>Risk Score:</span> <b>{selected.risk_score}</b>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span>Recommendation:</span> <b>{selected.recommendation}</b>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span>Last Maintenance Year:</span> <b>{selected.last_maintenance_year}</b>
                    </div>
                  </div>
                </div>
              ) : (
                <div
                  className="small"
                  style={{
                    marginTop: 14,
                    textAlign: "center",
                    padding: "20px",
                    background: "#f8fafc",
                    borderRadius: "8px",
                    border: "1px dashed #cbd5e1",
                  }}
                >
                  Click “View” on a pipeline in the table to display full inspection details here.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(5px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @media (max-width: 1000px) {
          .grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}