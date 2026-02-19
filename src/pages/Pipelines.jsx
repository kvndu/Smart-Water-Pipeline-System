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
    <div className="container">
      <div className="header">
        <div>
          <div className="title">Pipelines</div>
          <div className="subtitle">Manage pipeline records + filters + export (No AI)</div>
        </div>

        <div className="hstack">
          <button className="btn" type="button" onClick={() => exportToCSV("pipelines_report.csv", pipelines)}>
            Export CSV
          </button>
          <span className="badge ok">{pipelines.length} total</span>
        </div>
      </div>

      {/* Add New Pipeline */}
      <div className="card card-pad">
        <div className="hstack" style={{ justifyContent: "space-between" }}>
          <div>
            <div className="title" style={{ fontSize: 14 }}>Add New Pipeline</div>
            <div className="small">Saved in LocalStorage (waterflow_pipelines_v1)</div>
          </div>
        </div>

        <form onSubmit={handleAddPipeline} style={{ marginTop: 12 }}>
          <div className="formGrid">
            <input className="input" name="pipeline_id" value={form.pipeline_id} onChange={onFormChange} placeholder="Pipeline ID (PL-2001)" />
            <input className="input" name="pipe_name" value={form.pipe_name} onChange={onFormChange} placeholder="Pipe Name" />
            <input className="input" name="area" value={form.area} onChange={onFormChange} placeholder="Area" />

            <input className="input" name="zone" value={form.zone} onChange={onFormChange} placeholder="Zone (Z1/Z2...)" />
            <input className="input" name="material" value={form.material} onChange={onFormChange} placeholder="Material (PVC/GI/HDPE...)" />

            <select className="select" name="status" value={form.status} onChange={onFormChange}>
              <option value="ACTIVE">Status: ACTIVE</option>
              <option value="UNDER_REPAIR">Status: UNDER_REPAIR</option>
              <option value="UNDER_MAINTENANCE">Status: UNDER_MAINTENANCE</option>
              <option value="INACTIVE">Status: INACTIVE</option>
            </select>

            <input className="input" name="diameter_mm" value={form.diameter_mm} onChange={onFormChange} placeholder="Diameter (mm)" />
            <input className="input" name="length_m" value={form.length_m} onChange={onFormChange} placeholder="Length (m)" />
            <input className="input" name="install_year" value={form.install_year} onChange={onFormChange} placeholder="Install Year" />

            <select className="select" name="corrosion_risk" value={form.corrosion_risk} onChange={onFormChange}>
              <option value="Low">Risk: Low</option>
              <option value="Medium">Risk: Medium</option>
              <option value="High">Risk: High</option>
            </select>

            <input className="input" name="last_maintenance_date" value={form.last_maintenance_date} onChange={onFormChange} placeholder="Last Maintenance (YYYY-MM-DD)" />
            <input className="input" name="gps_latitude" value={form.gps_latitude} onChange={onFormChange} placeholder="GPS Latitude (optional)" />
            <input className="input" name="gps_longitude" value={form.gps_longitude} onChange={onFormChange} placeholder="GPS Longitude (optional)" />
          </div>

          {formError ? <div className="formError" style={{ marginTop: 10 }}>{formError}</div> : null}

          <div className="hstack" style={{ marginTop: 12, justifyContent: "flex-end" }}>
            <button className="btn" type="button" onClick={() => { setForm(emptyForm); setFormError(""); }}>
              Clear
            </button>
            <button className="btn primary" type="submit">
              Add Pipeline
            </button>
          </div>
        </form>
      </div>

      {/* Filters + Sorting + Toggles */}
      <div className="card card-pad" style={{ marginTop: 12 }}>
        <div className="toolbar">
          <input
            className="input"
            placeholder="Search pipeline / area / material / zone..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />

          <div className="hstack" style={{ flexWrap: "wrap" }}>
            <select className="select" value={zone} onChange={(e) => setZone(e.target.value)}>
              {zones.map((z0) => <option key={z0} value={z0}>{z0}</option>)}
            </select>

            <select className="select" value={material} onChange={(e) => setMaterial(e.target.value)}>
              {materials.map((m0) => <option key={m0} value={m0}>{m0}</option>)}
            </select>

            <select className="select" value={risk} onChange={(e) => setRisk(e.target.value)}>
              {risks.map((r0) => <option key={r0} value={r0}>{r0}</option>)}
            </select>

            <select className="select" value={status} onChange={(e) => setStatus(e.target.value)}>
              {statuses.map((s0) => <option key={s0} value={s0}>{s0}</option>)}
            </select>

            <select className="select" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              <option value="">Sort: None</option>
              <option value="risk">Sort: Risk (High→Low)</option>
              <option value="leaks">Sort: Leak Count (High→Low)</option>
              <option value="maintenance">Sort: Oldest Maintenance First</option>
            </select>

            <button
              type="button"
              className={`btn ${highOnly ? "warn" : ""}`}
              onClick={() => setHighOnly((v) => !v)}
            >
              {highOnly ? "High Risk: ON" : "High Risk Only"}
            </button>

            <button
              type="button"
              className={`btn ${overdueOnly ? "danger" : ""}`}
              onClick={() => setOverdueOnly((v) => !v)}
            >
              {overdueOnly ? "Overdue: ON" : "Overdue Only (>365d)"}
            </button>

            <button type="button" className="btn" onClick={clearFilters}>
              Clear Filters
            </button>

            <span className="badge">{sorted.length} rows</span>
          </div>
        </div>

        <div className="small">
          Filters apply on dataset fields only. Overdue rule uses last_maintenance_date.
        </div>
      </div>

      <div className="grid" style={{ marginTop: 12 }}>
        <div className="vstack">
          <PipelineMapPlaceholder selected={selected} />

          <PipelineTable
            rows={sorted}
            selectedId={selected?.pipeline_id}
            onSelect={(p) => setSelected(p)}
          />
        </div>

        <div className="vstack">
          <AlertPanel alerts={alerts} />

          <div className="card card-pad">
            <div className="title" style={{ fontSize: 14 }}>Selected Pipeline</div>

            {selected ? (
              <div className="vstack" style={{ marginTop: 10 }}>
                <div>
                  <b>{selected.pipeline_id}</b> — {selected.pipe_name}
                </div>
                <div className="small">
                  {selected.area} / {selected.zone}
                </div>

                <div className="hstack" style={{ flexWrap: "wrap" }}>
                  <span className="badge">{selected.material}</span>
                  <span className="badge">{selected.diameter_mm} mm</span>
                  <span className="badge">{selected.length_m} m</span>

                  <span
                    className={`badge ${
                      selected.corrosion_risk === "High"
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

                <div className="small">
                  Install year: <b>{selected.install_year}</b>
                  <br />
                  Last maintenance: <b>{selected.last_maintenance_date || "—"}</b>
                  <br />
                  Days since maintenance:{" "}
                  <b>{daysSince(selected.last_maintenance_date) ?? "—"}</b>
                  <br />
                  GPS: {selected.gps_latitude}, {selected.gps_longitude}
                  <br />
                  Leak reports: <b>{selected.leak_count}</b>
                </div>
              </div>
            ) : (
              <div className="small" style={{ marginTop: 10 }}>
                Click “View” in the table to see details here.
              </div>
            )}
          </div>

          <div className="card card-pad">
            <div className="title" style={{ fontSize: 14 }}>Quick Actions</div>
            <div className="small" style={{ marginTop: 8 }}>
              • Export CSV report for submissions<br />
              • Use Maintenance page to schedule preventive maintenance<br />
              • Use Alerts page to track incidents
            </div>
          </div>
        </div>
      </div>

      <div className="card card-pad" style={{ marginTop: 12 }}>
        <div className="title" style={{ fontSize: 14 }}>Examiner Notes</div>
        <div className="small" style={{ marginTop: 6 }}>
          “Pipelines can be inserted, filtered, sorted, and exported as CSV reports. Maintenance overdue is identified via rule-based date thresholds (365 days). No AI is used.”
        </div>
      </div>
    </div>
  );
}
