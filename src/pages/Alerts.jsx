import { useEffect, useMemo, useState } from "react";

/** Demo pipeline list (later replace with DB/CSV shared state) */
const PIPELINES = [
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

const LS_KEY = "waterflow_incidents_v1";

function nowISO() {
  return new Date().toISOString();
}

function daysSince(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  const diffMs = Date.now() - d.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

/** RiskScore 0–100 (polished rule-based) */
function calcRiskScore(p) {
  let score = 0;

  // A) corrosion_risk
  const cr = (p.corrosion_risk || "").toLowerCase();
  if (cr === "low") score += 15;
  else if (cr === "medium") score += 35;
  else if (cr === "high") score += 55;

  // B) leak_count
  const leaks = Number(p.leak_count || 0);
  if (leaks === 1) score += 15;
  else if (leaks === 2) score += 30;
  else if (leaks >= 3) score += 45;

  // C) maintenance overdue
  const ds = daysSince(p.last_maintenance_date);
  if (ds !== null) {
    if (ds > 365) score += 35;
    else if (ds > 180) score += 20;
  } else {
    // no date → small penalty
    score += 10;
  }

  // D) pipeline age
  const year = Number(p.install_year);
  if (Number.isFinite(year)) {
    const age = new Date().getFullYear() - year;
    if (age > 15) score += 20;
    else if (age > 10) score += 10;
  }

  // clamp 0..100
  score = Math.max(0, Math.min(100, score));
  return score;
}

function scoreToSeverity(score) {
  if (score >= 70) return "HIGH";
  if (score >= 35) return "MEDIUM";
  return "LOW";
}

function badgeClassForSeverity(sev) {
  if (sev === "HIGH") return "danger";
  if (sev === "MEDIUM") return "warn";
  return "ok";
}

function loadIncidents() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveIncidents(list) {
  localStorage.setItem(LS_KEY, JSON.stringify(list));
}

const INCIDENT_STATUSES = [
  "NEW",
  "ACKNOWLEDGED",
  "DISPATCHED",
  "FIX_IN_PROGRESS",
  "FIXED",
  "CLOSED",
];

const INCIDENT_TYPES = ["LEAK", "BURST", "PRESSURE_DROP", "FLOW_ANOMALY"];

const emptyForm = {
  pipeline_id: "",
  type: "LEAK",
  note: "",
};

export default function Alerts() {
  const [incidents, setIncidents] = useState(() => loadIncidents());
  const [selectedId, setSelectedId] = useState(null);

  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");

  useEffect(() => {
    saveIncidents(incidents);
  }, [incidents]);

  const pipelineMap = useMemo(() => {
    const m = new Map();
    PIPELINES.forEach((p) => m.set(p.pipeline_id, p));
    return m;
  }, []);

  const selectedIncident = useMemo(
    () => incidents.find((x) => x.incident_id === selectedId) || null,
    [incidents, selectedId]
  );

  const selectedPipeline = useMemo(() => {
    if (!selectedIncident) return null;
    return pipelineMap.get(selectedIncident.pipeline_id) || null;
  }, [selectedIncident, pipelineMap]);

  const sortedIncidents = useMemo(() => {
    return [...incidents].sort((a, b) => (a.detected_at < b.detected_at ? 1 : -1));
  }, [incidents]);

  function onChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function createIncident(e) {
    e.preventDefault();
    setError("");

    const pid = form.pipeline_id.trim();
    if (!pid) return setError("Select a pipeline first.");
    const p = pipelineMap.get(pid);
    if (!p) return setError("Invalid pipeline selected.");

    const riskScore = calcRiskScore(p);
    const severity = scoreToSeverity(riskScore);

    const incident = {
      incident_id: `INC-${Date.now()}`,
      pipeline_id: pid,
      type: form.type,
      severity,
      risk_score: riskScore,
      detected_at: nowISO(),
      status: "NEW",
      estimated_location: {
        lat: p.gps_latitude ?? null,
        lng: p.gps_longitude ?? null,
        label: `${p.area} (${p.zone})`,
      },
      note: form.note?.trim() || "",
    };

    setIncidents((prev) => [incident, ...prev]);
    setForm(emptyForm);
    setSelectedId(incident.incident_id);
  }

  function updateStatus(incident_id, nextStatus) {
    setIncidents((prev) =>
      prev.map((x) =>
        x.incident_id === incident_id
          ? { ...x, status: nextStatus, updated_at: nowISO() }
          : x
      )
    );
  }

  function removeIncident(incident_id) {
    setIncidents((prev) => prev.filter((x) => x.incident_id !== incident_id));
    if (selectedId === incident_id) setSelectedId(null);
  }

  return (
    <div className="container">
      <div className="header">
        <div>
          <div className="title">Incidents & Alerts</div>
          <div className="subtitle">
            Report pipeline break/leak + track repair status (No AI)
          </div>
        </div>
        <span className="badge ok">Rule-based</span>
      </div>

      {/* Create Incident */}
      <div className="card card-pad">
        <div className="hstack" style={{ justifyContent: "space-between" }}>
          <div>
            <div className="title" style={{ fontSize: 14 }}>Report New Incident</div>
            <div className="small">
              Choose pipeline → type → system calculates RiskScore & Severity from dataset fields.
            </div>
          </div>
          <span className="badge">{incidents.length} incidents</span>
        </div>

        <form onSubmit={createIncident} style={{ marginTop: 12 }}>
          <div className="formGrid">
            <select className="select" name="pipeline_id" value={form.pipeline_id} onChange={onChange}>
              <option value="">Select Pipeline</option>
              {PIPELINES.map((p) => (
                <option key={p.pipeline_id} value={p.pipeline_id}>
                  {p.pipeline_id} — {p.pipe_name}
                </option>
              ))}
            </select>

            <select className="select" name="type" value={form.type} onChange={onChange}>
              {INCIDENT_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>

            <input
              className="input"
              name="note"
              value={form.note}
              onChange={onChange}
              placeholder="Optional note (e.g., burst near bridge, reported by public)"
            />
          </div>

          {error ? <div className="formError" style={{ marginTop: 10 }}>{error}</div> : null}

          <div className="hstack" style={{ marginTop: 12, justifyContent: "flex-end" }}>
            <button className="btn" type="button" onClick={() => { setForm(emptyForm); setError(""); }}>
              Clear
            </button>
            <button className="btn primary" type="submit">
              Create Incident
            </button>
          </div>
        </form>
      </div>

      <div className="grid" style={{ marginTop: 12 }}>
        {/* Left: incident list */}
        <div className="vstack">
          <div className="card card-pad">
            <div className="title" style={{ fontSize: 14 }}>Incident List</div>
            <div className="small" style={{ marginTop: 6 }}>
              Click an incident to see full pipeline details & update repair status.
            </div>

            <div style={{ marginTop: 12 }} className="vstack">
              {sortedIncidents.length === 0 ? (
                <div className="small">No incidents yet. Create one above.</div>
              ) : (
                sortedIncidents.map((inc) => (
                  <button
                    key={inc.incident_id}
                    className="incidentRow"
                    onClick={() => setSelectedId(inc.incident_id)}
                    type="button"
                  >
                    <div className="incidentRowTop">
                      <div className="incidentTitle">
                        {inc.type} — {inc.pipeline_id}
                      </div>
                      <span className={`badge ${badgeClassForSeverity(inc.severity)}`}>
                        {inc.severity}
                      </span>
                    </div>

                    <div className="small">
                      Status: <b>{inc.status}</b> • Score: <b>{inc.risk_score}</b> • {new Date(inc.detected_at).toLocaleString()}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right: details */}
        <div className="vstack">
          <div className="card card-pad">
            <div className="title" style={{ fontSize: 14 }}>Incident Details</div>

            {!selectedIncident ? (
              <div className="small" style={{ marginTop: 10 }}>
                Select an incident from the list to view details.
              </div>
            ) : (
              <div className="vstack" style={{ marginTop: 10 }}>
                <div className="hstack" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div><b>{selectedIncident.type}</b> — {selectedIncident.pipeline_id}</div>
                    <div className="small">
                      Detected: {new Date(selectedIncident.detected_at).toLocaleString()}
                    </div>
                  </div>

                  <span className={`badge ${badgeClassForSeverity(selectedIncident.severity)}`}>
                    {selectedIncident.severity} (Score {selectedIncident.risk_score})
                  </span>
                </div>

                <div className="card card-pad" style={{ boxShadow: "none" }}>
                  <div className="title" style={{ fontSize: 13 }}>Repair Status</div>
                  <div className="small" style={{ marginTop: 6 }}>
                    Current: <b>{selectedIncident.status}</b>
                  </div>

                  <div className="hstack" style={{ marginTop: 10, flexWrap: "wrap" }}>
                    {INCIDENT_STATUSES.map((s) => (
                      <button
                        key={s}
                        type="button"
                        className={`btn ${selectedIncident.status === s ? "primary" : ""}`}
                        onClick={() => updateStatus(selectedIncident.incident_id, s)}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                {selectedPipeline ? (
                  <div className="card card-pad" style={{ boxShadow: "none" }}>
                    <div className="title" style={{ fontSize: 13 }}>Pipeline Details (from dataset)</div>

                    <div className="small" style={{ marginTop: 8 }}>
                      <b>{selectedPipeline.pipeline_id}</b> — {selectedPipeline.pipe_name}<br />
                      Area/Zone: <b>{selectedPipeline.area}</b> / <b>{selectedPipeline.zone}</b><br />
                      Material: <b>{selectedPipeline.material}</b><br />
                      Diameter: <b>{selectedPipeline.diameter_mm} mm</b> • Length: <b>{selectedPipeline.length_m} m</b><br />
                      Install Year: <b>{selectedPipeline.install_year}</b><br />
                      Corrosion Risk: <b>{selectedPipeline.corrosion_risk}</b><br />
                      Leak Reports: <b>{selectedPipeline.leak_count}</b><br />
                      Last Maintenance: <b>{selectedPipeline.last_maintenance_date || "—"}</b><br />
                      GPS: <b>{selectedPipeline.gps_latitude}</b>, <b>{selectedPipeline.gps_longitude}</b>
                    </div>

                    <div className="small" style={{ marginTop: 10 }}>
                      <b>System reason (No AI):</b> Score is calculated from corrosion_risk + leak_count + maintenance overdue + pipeline age.
                    </div>
                  </div>
                ) : null}

                {selectedIncident.note ? (
                  <div className="card card-pad" style={{ boxShadow: "none" }}>
                    <div className="title" style={{ fontSize: 13 }}>Notes</div>
                    <div className="small" style={{ marginTop: 6 }}>{selectedIncident.note}</div>
                  </div>
                ) : null}

                <div className="hstack" style={{ justifyContent: "flex-end" }}>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => removeIncident(selectedIncident.incident_id)}
                  >
                    Delete Incident
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="card card-pad">
            <div className="title" style={{ fontSize: 14 }}>Recommended Actions</div>
            <div className="small" style={{ marginTop: 8 }}>
              HIGH → dispatch crew + isolate section immediately.<br />
              MEDIUM → schedule repair within 24–48 hours.<br />
              LOW → monitor and plan preventive maintenance.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
