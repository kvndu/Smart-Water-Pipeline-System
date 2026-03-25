import { useEffect, useMemo, useState } from "react";
import PipelineTable from "../components/PipelineTable.jsx";
import AlertPanel from "../components/AlertPanel.jsx";
import { exportToCSV } from "../utils/exportUtils.js";
import api from "../utils/api.js";
import { Link } from "react-router-dom";

function buildAlerts(pipelines) {
  const alerts = [];

  pipelines.forEach((p) => {
    const leaks = Number(p.previous_leak_count || 0);
    const risk = (p.risk_level || "").toLowerCase();

    if (leaks >= 2) {
      alerts.push({
        id: `AL-${p.pipeline_id}-L`,
        title: "Repeated leak reports",
        severity: "High",
        pipeline_id: p.pipeline_id,
        area: p.area_name,
        time: "This week",
      });
    } else if (leaks === 1) {
      alerts.push({
        id: `AL-${p.pipeline_id}-L`,
        title: "Leak reported",
        severity: "Medium",
        pipeline_id: p.pipeline_id,
        area: p.area_name,
        time: "Today",
      });
    }

    if (risk === "high") {
      alerts.push({
        id: `AL-${p.pipeline_id}-R`,
        title: "High risk pipeline",
        severity: leaks > 0 ? "High" : "Medium",
        pipeline_id: p.pipeline_id,
        area: p.area_name,
        time: "Now",
      });
    }
  });

  return alerts;
}

function SummaryCard({ label, value, hint }) {
  return (
    <div className="metricCard card">
      <div className="metricLabel">{label}</div>
      <div className="metricValue">{value}</div>
      <div className="metricHint">{hint}</div>
    </div>
  );
}

export default function Pipelines() {
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
        setPipelines(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        console.error(err);
        setPipelines([]);
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

  const filtered = useMemo(() => {
    return pipelines.filter((p) => {
      const text = `${p.pipeline_id} ${p.area_name} ${p.ds_division} ${p.material_type}`.toLowerCase();
      const matchesQ = q.trim() === "" || text.includes(q.toLowerCase());
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
      data.sort((a, b) => Number(b.previous_leak_count || 0) - Number(a.previous_leak_count || 0));
    }
    if (sortBy === "score") {
      data.sort((a, b) => Number(b.risk_score || 0) - Number(a.risk_score || 0));
    }
    return data;
  }, [filtered, sortBy]);

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
      last_maintenance_date: p.last_maintenance_year ? `${p.last_maintenance_year}-01-01` : "",
    }));
  }, [sorted]);

  const stats = {
    total: pipelines.length,
    filtered: sorted.length,
    high: sorted.filter((p) => p.risk_level === "High").length,
    medium: sorted.filter((p) => p.risk_level === "Medium").length,
  };

  const selectedDetails = selected || tableRows[0] || null;

  function clearFilters() {
    setQ("");
    setDivision("All");
    setRisk("All");
    setMaterial("All");
    setHighOnly(false);
    setSortBy("");
  }

  return (
    <div className="container" style={{ animation: "fadeIn 0.35s ease" }}>
      <div className="pageHero pageHeroCompact">
        <div>
          <div className="heroEyebrow">Pipeline Records</div>
          <div className="pageTitle">Pipelines page</div>
          <div className="pageSubtitle">
            Search pipelines, filter by area or material, and clearly see why a record needs attention.
          </div>
        </div>
        <div className="pageActions">
          <button className="btn btnGhost" onClick={() => exportToCSV("pipelines_export", tableRows)}>
            ⬇ Export filtered data
          </button>
        </div>
      </div>

      {loading ? (
        <div className="card card-pad">Loading pipelines...</div>
      ) : (
        <>
          <div className="metricsGrid" style={{ marginBottom: 18 }}>
            <SummaryCard label="Loaded records" value={stats.total} hint="Fetched from backend" />
            <SummaryCard label="Visible after filters" value={stats.filtered} hint="Current list on the page" />
            <SummaryCard label="High risk visible" value={stats.high} hint="Highest-priority pipelines in filtered view" />
            <SummaryCard label="Medium risk visible" value={stats.medium} hint="Needs inspection soon" />
          </div>

          <div className="card card-pad" style={{ marginBottom: 18 }}>
            <div className="sectionHeader">
              <div>
                <div className="sectionTitle">Find the right pipeline quickly</div>
                <div className="sectionSubtitle">Use these filters first, then open a row to see its details.</div>
              </div>
              <button className="btn btnSecondary" onClick={clearFilters}>Reset filters</button>
            </div>

            <div className="filterGrid">
              <input className="input" placeholder="Search by pipeline ID, area, division, or material" value={q} onChange={(e) => setQ(e.target.value)} />
              <select className="select" value={division} onChange={(e) => setDivision(e.target.value)}>
                {divisions.map((d) => <option key={d} value={d}>Division: {d}</option>)}
              </select>
              <select className="select" value={material} onChange={(e) => setMaterial(e.target.value)}>
                {materials.map((m) => <option key={m} value={m}>Material: {m}</option>)}
              </select>
              <select className="select" value={risk} onChange={(e) => setRisk(e.target.value)}>
                {["All", "Low", "Medium", "High"].map((r) => <option key={r} value={r}>Risk: {r}</option>)}
              </select>
              <select className="select" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                <option value="">Sort by</option>
                <option value="risk">Risk level</option>
                <option value="score">Risk score</option>
                <option value="leaks">Leak count</option>
              </select>
            </div>

            <label className="small" style={{ display: "inline-flex", alignItems: "center", gap: 8, marginTop: 12 }}>
              <input type="checkbox" checked={highOnly} onChange={(e) => setHighOnly(e.target.checked)} />
              Show only high-risk pipelines
            </label>
          </div>

          <div className="panelGrid">
            <div>
              <PipelineTable rows={tableRows} onSelect={setSelected} selectedId={selectedDetails?.pipeline_id} />
            </div>

            <div className="vstack">
              <div className="card card-pad">
                <div className="sectionHeader">
                  <div>
                    <div className="sectionTitle">Selected pipeline</div>
                    <div className="sectionSubtitle">This side panel explains one record at a time.</div>
                  </div>
                </div>

                {selectedDetails ? (
  <>
    <div className="detailGrid">
      <div className="detailItem"><div className="detailLabel">Pipeline ID</div><div className="detailValue">{selectedDetails.pipeline_id}</div></div>
      <div className="detailItem"><div className="detailLabel">Area</div><div className="detailValue">{selectedDetails.area}</div></div>
      <div className="detailItem"><div className="detailLabel">Division</div><div className="detailValue">{selectedDetails.zone || "-"}</div></div>
      <div className="detailItem"><div className="detailLabel">Material</div><div className="detailValue">{selectedDetails.material || "-"}</div></div>
      <div className="detailItem"><div className="detailLabel">Risk level</div><div className="detailValue">{selectedDetails.corrosion_risk || "Low"}</div></div>
      <div className="detailItem"><div className="detailLabel">Risk score</div><div className="detailValue">{Number(selectedDetails.risk_score || 0).toFixed(3)}</div></div>
      <div className="detailItem"><div className="detailLabel">Leak count</div><div className="detailValue">{selectedDetails.previous_leak_count || 0}</div></div>
      <div className="detailItem"><div className="detailLabel">Install year</div><div className="detailValue">{selectedDetails.install_year || "-"}</div></div>
      <div className="detailItem"><div className="detailLabel">Annual rainfall</div><div className="detailValue">{selectedDetails.annual_rainfall_mm || "-"}</div></div>
      <div className="detailItem"><div className="detailLabel">Last maintenance year</div><div className="detailValue">{selectedDetails.last_maintenance_year || "Not recorded"}</div></div>
    </div>

    <div style={{ marginTop: 14 }}>
      <Link to={`/pipelines/${selectedDetails.pipeline_id}`} className="btn btnPrimary">
        Open full detail page
      </Link>
    </div>
  </>
) : (
  <div className="emptyState">Select a row from the pipeline table to see more details here.</div>
)}
              </div>

              <AlertPanel alerts={alerts.slice(0, 8)} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
