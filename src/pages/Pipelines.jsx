import { useMemo, useState } from "react";
import PipelineTable from "../components/PipelineTable.jsx";
import PipelineMapPlaceholder from "../components/PipelineMapPlaceholder.jsx";
import AlertPanel from "../components/AlertPanel.jsx";

/** Demo dataset (later load from CSV/DB) */
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
  },
];

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
  });
  return alerts;
}

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
};

export default function Pipelines() {
  const [pipelines, setPipelines] = useState(INITIAL_PIPELINES);
  const [selected, setSelected] = useState(null);

  // filters
  const [q, setQ] = useState("");
  const [zone, setZone] = useState("All");
  const [risk, setRisk] = useState("All");

  // form
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState("");

  const zones = useMemo(
    () => ["All", ...Array.from(new Set(pipelines.map((p) => p.zone).filter(Boolean)))],
    [pipelines]
  );
  const risks = ["All", "Low", "Medium", "High"];

  const filtered = useMemo(() => {
    return pipelines.filter((p) => {
      const matchesQ =
        q.trim() === "" ||
        `${p.pipeline_id} ${p.pipe_name} ${p.area} ${p.material}`
          .toLowerCase()
          .includes(q.toLowerCase());
      const matchesZone = zone === "All" || p.zone === zone;
      const matchesRisk = risk === "All" || p.corrosion_risk === risk;
      return matchesQ && matchesZone && matchesRisk;
    });
  }, [pipelines, q, zone, risk]);

  const alerts = useMemo(() => buildAlerts(pipelines), [pipelines]);

  function onFormChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function validateAndBuildPipeline() {
    setFormError("");

    const pid = form.pipeline_id.trim();
    const pname = form.pipe_name.trim();
    const area = form.area.trim();
    const zone = form.zone.trim();
    const material = form.material.trim();

    if (!pid || !pname || !area || !zone || !material) {
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

    const lat = form.gps_latitude === "" ? null : Number(form.gps_latitude);
    const lng = form.gps_longitude === "" ? null : Number(form.gps_longitude);
    if (lat !== null && !Number.isFinite(lat)) return { ok: false, msg: "Latitude must be a number (or empty)." };
    if (lng !== null && !Number.isFinite(lng)) return { ok: false, msg: "Longitude must be a number (or empty)." };

    const pipeline = {
      pipeline_id: pid,
      pipe_name: pname,
      area,
      zone,
      material,
      diameter_mm: diameter,
      length_m: length,
      install_year: year,
      corrosion_risk: form.corrosion_risk || "Low",
      leak_count: Number(form.leak_count || 0),
      last_maintenance_date: form.last_maintenance_date || "",
      gps_latitude: lat ?? 0,
      gps_longitude: lng ?? 0,
    };

    return { ok: true, pipeline };
  }

  function handleAddPipeline(e) {
    e.preventDefault();
    const res = validateAndBuildPipeline();
    if (!res.ok) {
      setFormError(res.msg);
      return;
    }
    setPipelines((prev) => [res.pipeline, ...prev]);
    setForm(emptyForm);
    setFormError("");
  }

  return (
    <div className="container">
      <div className="header">
        <div>
          <div className="title">Pipelines</div>
          <div className="subtitle">Add new pipelines + view map & table (No AI)</div>
        </div>
        <span className="badge ok">Dataset-based</span>
      </div>

      {/* Add New Pipeline */}
      <div className="card card-pad">
        <div className="hstack" style={{ justifyContent: "space-between" }}>
          <div>
            <div className="title" style={{ fontSize: 14 }}>Add New Pipeline</div>
            <div className="small">Insert new pipeline details (frontend only). Later connect to DB.</div>
          </div>
          <span className="badge">{pipelines.length} total</span>
        </div>

        <form onSubmit={handleAddPipeline} style={{ marginTop: 12 }}>
          <div className="formGrid">
            <input className="input" name="pipeline_id" value={form.pipeline_id} onChange={onFormChange} placeholder="Pipeline ID (e.g., PL-2001)" />
            <input className="input" name="pipe_name" value={form.pipe_name} onChange={onFormChange} placeholder="Pipe Name" />
            <input className="input" name="area" value={form.area} onChange={onFormChange} placeholder="Area" />
            <input className="input" name="zone" value={form.zone} onChange={onFormChange} placeholder="Zone (e.g., Z1)" />
            <input className="input" name="material" value={form.material} onChange={onFormChange} placeholder="Material (PVC/GI/HDPE...)" />

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

          {formError ? (
            <div className="formError" style={{ marginTop: 10 }}>
              {formError}
            </div>
          ) : null}

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

      {/* Filters */}
      <div className="card card-pad" style={{ marginTop: 12 }}>
        <div className="toolbar">
          <input
            className="input"
            placeholder="Search pipeline / area / material..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />

          <div className="hstack">
            <select className="select" value={zone} onChange={(e) => setZone(e.target.value)}>
              {zones.map((z) => (
                <option key={z} value={z}>{z}</option>
              ))}
            </select>

            <select className="select" value={risk} onChange={(e) => setRisk(e.target.value)}>
              {risks.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="small">Filters use existing dataset fields only.</div>
      </div>

      <div className="grid" style={{ marginTop: 12 }}>
        <div className="vstack">
          <PipelineMapPlaceholder selected={selected} />

          <PipelineTable
            rows={filtered}
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
                <div><b>{selected.pipeline_id}</b> — {selected.pipe_name}</div>
                <div className="small">{selected.area} / {selected.zone}</div>

                <div className="hstack" style={{ flexWrap: "wrap" }}>
                  <span className="badge">{selected.material}</span>
                  <span className="badge">{selected.diameter_mm} mm</span>
                  <span className="badge">{selected.length_m} m</span>

                  <span className={`badge ${
                    selected.corrosion_risk === "High" ? "danger" :
                    selected.corrosion_risk === "Medium" ? "warn" : "ok"
                  }`}>
                    Risk: {selected.corrosion_risk}
                  </span>
                </div>

                <div className="small">
                  Install year: <b>{selected.install_year}</b><br/>
                  Last maintenance: <b>{selected.last_maintenance_date || "—"}</b><br/>
                  GPS: {selected.gps_latitude}, {selected.gps_longitude}<br/>
                  Leak reports: <b>{selected.leak_count}</b>
                </div>
              </div>
            ) : (
              <div className="small" style={{ marginTop: 10 }}>
                Click “View” in the table to see full details here.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
