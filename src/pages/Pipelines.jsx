import { useEffect, useMemo, useState } from "react";
import PipelineTable from "../components/PipelineTable.jsx";
import PipelineMapPlaceholder from "../components/PipelineMapPlaceholder.jsx";
import AlertPanel from "../components/AlertPanel.jsx";
import { exportToCSV } from "../utils/exportUtils.js";

const PIPELINES_LS_KEY = "waterflow_pipelines_v1";

/** Demo dataset (used if LocalStorage empty) */
const INITIAL_PIPELINES = [
  {
    pipeline_id: "PL-1001",
    pipe_name: "Main Line A",
    area: "Kalutara",
    zone: "Z1",
    material: "PVC",
    diameter_mm: 120,
    length_m: 1800,
    install_year: 2014,
    corrosion_risk: "Low",
    leak_count: 0,
    last_maintenance_date: "2025-10-12",
    gps_latitude: 6.5853,
    gps_longitude: 79.9607,
    status: "ACTIVE",
    maintenance_scheduled_date: "",
  },
  {
    pipeline_id: "PL-1002",
    pipe_name: "Feeder B",
    area: "Bulathsinhala",
    zone: "Z2",
    material: "GI",
    diameter_mm: 200,
    length_m: 2450,
    install_year: 2008,
    corrosion_risk: "High",
    leak_count: 3,
    last_maintenance_date: "2024-12-20",
    gps_latitude: 6.6662,
    gps_longitude: 80.1646,
    status: "UNDER_REPAIR",
    maintenance_scheduled_date: "",
  },
  {
    pipeline_id: "PL-1003",
    pipe_name: "Distribution C",
    area: "Panadura",
    zone: "Z1",
    material: "HDPE",
    diameter_mm: 160,
    length_m: 1300,
    install_year: 2018,
    corrosion_risk: "Medium",
    leak_count: 1,
    last_maintenance_date: "2025-03-04",
    gps_latitude: 6.7133,
    gps_longitude: 79.902,
    status: "ACTIVE",
    maintenance_scheduled_date: "",
  },
];

const emptyForm = {
  pipeline_id: "",
  pipe_name: "",
  area: "",
  zone: "",
  material: "",
  diameter_mm: "",
  length_m: "",
  install_year: "",
  corrosion_risk: "Low",
  leak_count: 0,
  last_maintenance_date: "",
  gps_latitude: "",
  gps_longitude: "",
  status: "ACTIVE",
  maintenance_scheduled_date: "",
};

function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function daysSince(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  const diffMs = Date.now() - d.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

function loadPipelines() {
  try {
    const raw = localStorage.getItem(PIPELINES_LS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function savePipelines(list) {
  localStorage.setItem(PIPELINES_LS_KEY, JSON.stringify(list));
}

function statusBadgeClass(status) {
  if (status === "UNDER_REPAIR") return "danger";
  if (status === "UNDER_MAINTENANCE") return "warn";
  if (status === "INACTIVE") return "";
  return "ok";
}

function buildAlerts(pipelines) {
  const alerts = [];
  pipelines.forEach((p) => {
    const leaks = Number(p.leak_count || 0);

    if (leaks >= 2) {
      alerts.push({
        id: `AL-${p.pipeline_id}-L`,
        title: "Leak Detected (Multiple reports)",
        severity: "High",
        pipeline_id: p.pipeline_id,
        area: p.area,
        time: "This week",
      });
    } else if (leaks === 1) {
      alerts.push({
        id: `AL-${p.pipeline_id}-L`,
        title: "Leak Detected",
        severity: "Medium",
        pipeline_id: p.pipeline_id,
        area: p.area,
        time: "Today",
      });
    }

    if ((p.corrosion_risk || "").toLowerCase() === "high") {
      alerts.push({
        id: `AL-${p.pipeline_id}-C`,
        title: "High Corrosion Risk (Maintenance Needed)",
        severity: leaks > 0 ? "High" : "Medium",
        pipeline_id: p.pipeline_id,
        area: p.area,
        time: "This month",
      });
    }

    if (p.status === "UNDER_REPAIR") {
      alerts.push({
        id: `AL-${p.pipeline_id}-R`,
        title: "Pipeline Under Repair",
        severity: "Medium",
        pipeline_id: p.pipeline_id,
        area: p.area,
        time: "Ongoing",
      });
    }

    if (p.status === "UNDER_MAINTENANCE") {
      alerts.push({
        id: `AL-${p.pipeline_id}-M`,
        title: "Pipeline Under Maintenance",
        severity: "Low",
        pipeline_id: p.pipeline_id,
        area: p.area,
        time: "Scheduled",
      });
    }
  });
  return alerts;
}

export default function Pipelines({ showToast }) {
  const [pipelines, setPipelines] = useState(() => loadPipelines() || INITIAL_PIPELINES);
  const [selected, setSelected] = useState(null);

  // Persist to LocalStorage
  useEffect(() => {
    savePipelines(pipelines);
  }, [pipelines]);

  // Filters/Search/Sort
  const [q, setQ] = useState("");
  const [zone, setZone] = useState("All");
  const [risk, setRisk] = useState("All");
  const [status, setStatus] = useState("All");
  const [material, setMaterial] = useState("All");

  const [highOnly, setHighOnly] = useState(false);
  const [overdueOnly, setOverdueOnly] = useState(false);

  const [sortBy, setSortBy] = useState(""); // risk | leaks | maintenance

  // Form
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState("");

  const zones = useMemo(
    () => ["All", ...Array.from(new Set(pipelines.map((p) => p.zone).filter(Boolean)))],
    [pipelines]
  );

  const materials = useMemo(
    () => ["All", ...Array.from(new Set(pipelines.map((p) => p.material).filter(Boolean)))],
    [pipelines]
  );

  const statuses = ["All", "ACTIVE", "UNDER_REPAIR", "UNDER_MAINTENANCE", "INACTIVE"];
  const risks = ["All", "Low", "Medium", "High"];

  const alerts = useMemo(() => buildAlerts(pipelines), [pipelines]);

  const filtered = useMemo(() => {
    return pipelines.filter((p) => {
      const matchesQ =
        q.trim() === "" ||
        `${p.pipeline_id} ${p.pipe_name} ${p.area} ${p.material} ${p.zone}`.toLowerCase().includes(q.toLowerCase());

      const matchesZone = zone === "All" || p.zone === zone;
      const matchesRisk = risk === "All" || p.corrosion_risk === risk;
      const matchesStatus = status === "All" || (p.status || "ACTIVE") === status;
      const matchesMaterial = material === "All" || p.material === material;

      const highToggleOk = !highOnly || p.corrosion_risk === "High";

      const ds = daysSince(p.last_maintenance_date);
      const isOverdue = ds !== null && ds > 365;
      const overdueToggleOk = !overdueOnly || isOverdue;

      return (
        matchesQ &&
        matchesZone &&
        matchesRisk &&
        matchesStatus &&
        matchesMaterial &&
        highToggleOk &&
        overdueToggleOk
      );
    });
  }, [pipelines, q, zone, risk, status, material, highOnly, overdueOnly]);

  const sorted = useMemo(() => {
    const data = [...filtered];

    if (sortBy === "risk") {
      const order = { High: 3, Medium: 2, Low: 1 };
      data.sort((a, b) => (order[b.corrosion_risk] || 0) - (order[a.corrosion_risk] || 0));
    }

    if (sortBy === "leaks") {
      data.sort((a, b) => (Number(b.leak_count) || 0) - (Number(a.leak_count) || 0));
    }

    if (sortBy === "maintenance") {
      // older maintenance first (needs attention)
      data.sort((a, b) => {
        const da = new Date(a.last_maintenance_date || "1900-01-01").getTime();
        const db = new Date(b.last_maintenance_date || "1900-01-01").getTime();
        return da - db;
      });
    }

    return data;
  }, [filtered, sortBy]);

  function onFormChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function validateAndBuildPipeline() {
    setFormError("");

    const pid = form.pipeline_id.trim();
    const pname = form.pipe_name.trim();
    const area = form.area.trim();
    const z = form.zone.trim();
    const mat = form.material.trim();

    if (!pid || !pname || !area || !z || !mat) {
      return { ok: false, msg: "Please fill Pipeline ID, Name, Area, Zone, Material." };
    }

    const exists = pipelines.some((p) => p.pipeline_id.toLowerCase() === pid.toLowerCase());
    if (exists) return { ok: false, msg: "Pipeline ID already exists. Use a unique ID." };

    const diameter = Number(form.diameter_mm);
    const length = Number(form.length_m);
    const year = Number(form.install_year);

    if (!Number.isFinite(diameter) || diameter <= 0) return { ok: false, msg: "Diameter must be a valid number." };
    if (!Number.isFinite(length) || length <= 0) return { ok: false, msg: "Length must be a valid number." };
    if (!Number.isFinite(year) || year < 1900 || year > 2100) return { ok: false, msg: "Install year is invalid." };

    const lat = form.gps_latitude === "" ? 0 : Number(form.gps_latitude);
    const lng = form.gps_longitude === "" ? 0 : Number(form.gps_longitude);
    if (!Number.isFinite(lat)) return { ok: false, msg: "Latitude must be a number (or empty)." };
    if (!Number.isFinite(lng)) return { ok: false, msg: "Longitude must be a number (or empty)." };

    const pipeline = {
      pipeline_id: pid,
      pipe_name: pname,
      area,
      zone: z,
      material: mat,
      diameter_mm: diameter,
      length_m: length,
      install_year: year,
      corrosion_risk: form.corrosion_risk || "Low",
      leak_count: Number(form.leak_count || 0),
      last_maintenance_date: form.last_maintenance_date || "",
      gps_latitude: lat,
      gps_longitude: lng,
      status: form.status || "ACTIVE",
      maintenance_scheduled_date: form.maintenance_scheduled_date || "",
    };

    return { ok: true, pipeline };
  }

  function handleAddPipeline(e) {
    e.preventDefault();
    const res = validateAndBuildPipeline();
    if (!res.ok) {
      setFormError(res.msg);
      showToast?.(res.msg, "error");
      return;
    }

    setPipelines((prev) => [res.pipeline, ...prev]);
    setForm(emptyForm);
    setFormError("");

    showToast?.("Pipeline added successfully", "success");
  }

  function clearFilters() {
    setQ("");
    setZone("All");
    setRisk("All");
    setStatus("All");
    setMaterial("All");
    setHighOnly(false);
    setOverdueOnly(false);
    setSortBy("");
    showToast?.("Filters cleared", "success");
  }

  return (
    <div className="container" style={{ animation: "fadeIn 0.4s ease-in-out" }}>
      <div className="header" style={{ marginBottom: "24px" }}>
        <div>
          <div className="title" style={{ fontSize: "24px", color: "var(--text)" }}>Pipelines Management</div>
          <div className="subtitle" style={{ fontSize: "14px" }}>
            Manage pipeline records, filter by parameters, and export reports.
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
              fontWeight: 800
            }}
            type="button"
            onClick={() => exportToCSV("pipelines_report.csv", pipelines)}
          >
            <span style={{ fontSize: "14px" }}>📊</span> Export CSV
          </button>
          <span className="badge" style={{ background: "var(--primary)", borderColor: "var(--primary)", color: "#fff", padding: "6px 12px", fontSize: "14px" }}>
            {pipelines.length} Total
          </span>
        </div>
      </div>

      {/* Add New Pipeline */}
      <div className="card card-pad" style={{ background: "linear-gradient(135deg, #ffffff 0%, #f1f5f9 100%)", borderWidth: "1px", borderColor: "#cbd5e1", marginBottom: "20px" }}>
        <div className="hstack" style={{ justifyContent: "space-between" }}>
          <div>
            <div className="title" style={{ fontSize: 16, color: "var(--primary)" }}>➕ Add New Pipeline</div>
            <div className="small">Records are persisted automatically to your local browser storage.</div>
          </div>
        </div>

        <form onSubmit={handleAddPipeline} style={{ marginTop: 16 }}>
          <div className="formGrid">
            <input className="input" name="pipeline_id" value={form.pipeline_id} onChange={onFormChange} placeholder="Pipeline ID (PL-2001)" />
            <input className="input" name="pipe_name" value={form.pipe_name} onChange={onFormChange} placeholder="Pipe Name" />
            <input className="input" name="area" value={form.area} onChange={onFormChange} placeholder="Area" />

            <input className="input" name="zone" value={form.zone} onChange={onFormChange} placeholder="Zone (Z1/Z2...)" />
            <input className="input" name="material" value={form.material} onChange={onFormChange} placeholder="Material (PVC/GI/HDPE...)" />

            <select className="select" name="status" value={form.status} onChange={onFormChange} style={{ cursor: "pointer" }}>
              <option value="ACTIVE">Status: ACTIVE</option>
              <option value="UNDER_REPAIR">Status: UNDER_REPAIR</option>
              <option value="UNDER_MAINTENANCE">Status: UNDER_MAINTENANCE</option>
              <option value="INACTIVE">Status: INACTIVE</option>
            </select>

            <input className="input" name="diameter_mm" value={form.diameter_mm} onChange={onFormChange} placeholder="Diameter (mm)" />
            <input className="input" name="length_m" value={form.length_m} onChange={onFormChange} placeholder="Length (m)" />
            <input className="input" name="install_year" value={form.install_year} onChange={onFormChange} placeholder="Install Year" />

            <select className="select" name="corrosion_risk" value={form.corrosion_risk} onChange={onFormChange} style={{ cursor: "pointer" }}>
              <option value="Low">Risk: Low</option>
              <option value="Medium">Risk: Medium</option>
              <option value="High">Risk: High</option>
            </select>

            <input className="input" name="last_maintenance_date" value={form.last_maintenance_date} onChange={onFormChange} placeholder="Last Maintenance (YYYY-MM-DD)" />
            <div className="hstack" style={{ gap: "8px" }}>
              <input className="input" name="gps_latitude" value={form.gps_latitude} onChange={onFormChange} placeholder="GPS Lat" style={{ flex: 1 }} />
              <input className="input" name="gps_longitude" value={form.gps_longitude} onChange={onFormChange} placeholder="GPS Lng" style={{ flex: 1 }} />
            </div>
          </div>

          {formError ? <div className="formError" style={{ marginTop: 12 }}>{formError}</div> : null}

          <div className="hstack" style={{ marginTop: 16, justifyContent: "flex-end", gap: "10px" }}>
            <button className="btn" type="button" onClick={() => { setForm(emptyForm); setFormError(""); }} style={{ fontWeight: 800 }}>
              Cancel
            </button>
            <button className="btn primary" type="submit" style={{ fontWeight: 800 }}>
              Add Pipeline
            </button>
          </div>
        </form>
      </div>

      {/* Filters + Sorting + Toggles */}
      <div className="card card-pad" style={{ marginBottom: "20px", borderColor: "#e2e8f0" }}>
        <div style={{ paddingBottom: "10px", borderBottom: "1px solid var(--border)", marginBottom: "14px" }}>
          <div className="title" style={{ fontSize: "14px" }}>🔍 Filter & Sort</div>
        </div>
        <div className="toolbar" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <input
            className="input"
            placeholder="Search pipeline by ID, area, material, or zone..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ fontSize: "14px", padding: "12px", background: "#f8fafc" }}
          />

          <div className="hstack" style={{ flexWrap: "wrap", gap: "8px" }}>
            <select className="select" value={zone} onChange={(e) => setZone(e.target.value)} style={{ width: "auto" }}>
              {zones.map((z0) => <option key={z0} value={z0}>Zone: {z0 === "All" ? "All" : z0}</option>)}
            </select>

            <select className="select" value={material} onChange={(e) => setMaterial(e.target.value)} style={{ width: "auto" }}>
              {materials.map((m0) => <option key={m0} value={m0}>Material: {m0 === "All" ? "All" : m0}</option>)}
            </select>

            <select className="select" value={risk} onChange={(e) => setRisk(e.target.value)} style={{ width: "auto" }}>
              {risks.map((r0) => <option key={r0} value={r0}>Risk: {r0 === "All" ? "All" : r0}</option>)}
            </select>

            <select className="select" value={status} onChange={(e) => setStatus(e.target.value)} style={{ width: "auto" }}>
              {statuses.map((s0) => <option key={s0} value={s0}>Status: {s0 === "All" ? "All" : s0}</option>)}
            </select>

            <select className="select" value={sortBy} onChange={(e) => setSortBy(e.target.value)} style={{ width: "auto", fontWeight: 700 }}>
              <option value="">Sort: None</option>
              <option value="risk">Sort: Risk (High→Low)</option>
              <option value="leaks">Sort: Leak Count (High→Low)</option>
              <option value="maintenance">Sort: Oldest Maintenance First</option>
            </select>
          </div>

          <div className="hstack" style={{ borderTop: "1px dashed var(--border)", paddingTop: "12px", flexWrap: "wrap", gap: "10px" }}>
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
              className={`btn ${overdueOnly ? "warn" : ""}`}
              style={{ fontWeight: 800, fontSize: "12px" }}
              onClick={() => setOverdueOnly((v) => !v)}
            >
              {overdueOnly ? "🟠 Overdue: ON" : "Overdue Only (>365d)"}
            </button>

            <button type="button" className="btn" style={{ fontSize: "12px", background: "#f1f5f9" }} onClick={clearFilters}>
              Reset Filters
            </button>

            <div style={{ marginLeft: "auto", fontWeight: 800, color: "var(--muted)", fontSize: "13px" }}>
              Showing {sorted.length} results
            </div>
          </div>
        </div>
      </div>

      <div className="grid" style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: "20px", marginTop: "20px" }}>

        {/* Left Side: Map + Table */}
        <div className="vstack" style={{ gap: "20px" }}>
          <div className="card card-pad" style={{ padding: "0", overflow: "hidden" }}>
            <PipelineMapPlaceholder selected={selected} />
          </div>

          <div className="card card-pad" style={{ padding: "0" }}>
            <PipelineTable
              rows={sorted}
              selectedId={selected?.pipeline_id}
              onSelect={(p) => setSelected(p)}
            />
          </div>
        </div>

        {/* Right Side: Alerts & Inspection Details */}
        <div className="vstack" style={{ gap: "20px" }}>

          <AlertPanel alerts={alerts} />

          <div className="card card-pad" style={{ borderColor: selected ? "var(--primary)" : "#e2e8f0", transition: "all 0.3s" }}>
            <div className="title" style={{ fontSize: 16 }}>Pipeline Inspector</div>

            {selected ? (
              <div className="vstack" style={{ marginTop: 14 }}>
                <div style={{ borderBottom: "1px solid var(--border)", paddingBottom: "10px" }}>
                  <div style={{ fontSize: "18px", fontWeight: 900, color: "var(--primary)" }}>{selected.pipeline_id}</div>
                  <div style={{ color: "var(--text)", fontWeight: 600 }}>{selected.pipe_name}</div>
                  <div className="small" style={{ marginTop: "4px" }}>
                    📍 {selected.area} / {selected.zone}
                  </div>
                </div>

                <div className="hstack" style={{ flexWrap: "wrap", gap: "8px", marginTop: "4px" }}>
                  <span className="badge" style={{ background: "#f1f5f9" }}>{selected.material}</span>
                  <span className="badge" style={{ background: "#f1f5f9" }}>{selected.diameter_mm} mm</span>
                  <span className="badge" style={{ background: "#f1f5f9" }}>{selected.length_m} m</span>

                  <span
                    className={`badge ${selected.corrosion_risk === "High"
                        ? "danger"
                        : selected.corrosion_risk === "Medium"
                          ? "warn"
                          : "ok"
                      }`}
                  >
                    Risk: {selected.corrosion_risk}
                  </span>

                  <span className={`badge ${statusBadgeClass(selected.status)}`}>
                    {selected.status || "ACTIVE"}
                  </span>
                </div>

                <div className="small" style={{ marginTop: "8px", lineHeight: "1.6", background: "#f8fafc", padding: "12px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>Install Year:</span> <b>{selected.install_year}</b>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>Last Maintenance:</span> <b>{selected.last_maintenance_date || "—"}</b>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>Days Since Maint:</span> <b>{daysSince(selected.last_maintenance_date) ?? "—"}</b>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>Leak Reports:</span> <b style={{ color: selected.leak_count > 0 ? "var(--danger)" : "inherit" }}>{selected.leak_count}</b>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: "6px", paddingTop: "6px", borderTop: "1px dashed #cbd5e1" }}>
                    <span>GPS:</span> <span>{selected.gps_latitude}, {selected.gps_longitude}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="small" style={{ marginTop: 14, textAlign: "center", padding: "20px", background: "#f8fafc", borderRadius: "8px", border: "1px dashed #cbd5e1" }}>
                Click “View” on a pipeline in the table to display full inspection details here.
              </div>
            )}
          </div>
        </div>
      </div>

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
