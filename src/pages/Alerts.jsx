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
    status: "ACTIVE",
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
    score += 10;
  }

  // D) pipeline age
  const year = Number(p.install_year);
  if (Number.isFinite(year)) {
    const age = new Date().getFullYear() - year;
    if (age > 15) score += 20;
    else if (age > 10) score += 10;
  }

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

function badgeClassForIncidentStatus(st) {
  if (st === "NEW") return "danger";
  if (st === "ACKNOWLEDGED" || st === "DISPATCHED") return "warn";
  if (st === "FIX_IN_PROGRESS") return "warn";
  if (st === "FIXED" || st === "CLOSED") return "ok";
  return "";
}

function badgeClassForPipelineStatus(st) {
  if (st === "UNDER_REPAIR") return "danger";
  if (st === "UNDER_MAINTENANCE") return "warn";
  if (st === "INACTIVE") return "";
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
      // ✅ start pipeline status for this incident
      pipeline_status: "UNDER_REPAIR",
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

  // ✅ Incident status -> pipeline status mapping (for demo)
  function updateStatus(incident_id, nextStatus) {
    setIncidents((prev) =>
      prev.map((x) => {
        if (x.incident_id !== incident_id) return x;

        let pipeline_status = x.pipeline_status || "ACTIVE";

        if (
          nextStatus === "NEW" ||
          nextStatus === "ACKNOWLEDGED" ||
          nextStatus === "DISPATCHED" ||
          nextStatus === "FIX_IN_PROGRESS"
        ) {
          pipeline_status = "UNDER_REPAIR";
        }

        if (nextStatus === "FIXED" || nextStatus === "CLOSED") {
          pipeline_status = "ACTIVE";
        }

        return { ...x, status: nextStatus, pipeline_status, updated_at: nowISO() };
      })
    );
  }

  function removeIncident(incident_id) {
    setIncidents((prev) => prev.filter((x) => x.incident_id !== incident_id));
    if (selectedId === incident_id) setSelectedId(null);
  }

  return (
    <div className="container" style={{ animation: "fadeIn 0.5s ease-out" }}>
      {/* Header */}
      <div className="header" style={{ marginBottom: "28px", borderBottom: "1px solid #e2e8f0", paddingBottom: "16px" }}>
        <div>
          <div className="title" style={{ fontSize: "28px", color: "var(--text)", fontWeight: 900, marginBottom: "4px" }}>
            Incidents & Alerts
          </div>
          <div className="subtitle" style={{ fontSize: "15px", color: "var(--muted)" }}>
            Create and track critical incidents across the pipeline network.
          </div>
        </div>
        <div className="hstack">
          <span className="badge" style={{ fontSize: "12px", padding: "6px 12px", background: "#fef3c7", color: "#d97706", border: "1px solid #fde68a" }}>
            🛡️ Rule-based Engine
          </span>
        </div>
      </div>

      {/* Create Incident */}
      <div className="card card-pad" style={{ background: "linear-gradient(to right, #ffffff, #f8fafc)", border: "1px solid #e2e8f0", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)" }}>
        <div className="hstack" style={{ justifyContent: "space-between", borderBottom: "1px dashed #cbd5e1", paddingBottom: "12px", marginBottom: "16px" }}>
          <div>
            <div className="title" style={{ fontSize: "16px", color: "var(--text)" }}>📝 Report New Incident</div>
            <div className="small" style={{ color: "var(--muted)" }}>
              Choose a pipeline and incident type. System automatically calculates threat Severity & RiskScore.
            </div>
          </div>
          <span className="badge" style={{ background: "#e2e8f0", color: "#334155", fontSize: "13px", fontWeight: 800 }}>{incidents.length} Records</span>
        </div>

        <form onSubmit={createIncident}>
          <div className="formGrid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 2fr", gap: "16px" }}>
            <select className="select" name="pipeline_id" value={form.pipeline_id} onChange={onChange} style={{ width: "100%", padding: "12px", borderRadius: "8px", border: "1px solid #cbd5e1", background: "#fff", fontWeight: 600 }}>
              <option value="">-- Select Asset --</option>
              {PIPELINES.map((p) => (
                <option key={p.pipeline_id} value={p.pipeline_id}>
                  {p.pipeline_id} — {p.pipe_name}
                </option>
              ))}
            </select>

            <select className="select" name="type" value={form.type} onChange={onChange} style={{ width: "100%", padding: "12px", borderRadius: "8px", border: "1px solid #cbd5e1", background: "#fff", fontWeight: 600 }}>
              {INCIDENT_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>

            <input
              className="input"
              name="note"
              value={form.note}
              onChange={onChange}
              placeholder="Optional operational note (e.g., burst near bridge)"
              style={{ width: "100%", padding: "12px", borderRadius: "8px", border: "1px solid #cbd5e1", background: "#fff" }}
            />
          </div>

          {error ? <div style={{ marginTop: "12px", padding: "10px", background: "#fef2f2", color: "#dc2626", borderRadius: "8px", fontSize: "13px", fontWeight: 700, border: "1px solid #fecaca" }}>{error}</div> : null}

          <div className="hstack" style={{ marginTop: "20px", justifyContent: "flex-end", gap: "12px" }}>
            <button className="btn" type="button" onClick={() => { setForm(emptyForm); setError(""); }} style={{ background: "#f1f5f9", border: "none", color: "#475569", fontWeight: 700, padding: "8px 16px" }}>
              Clear form
            </button>
            <button className="btn primary" type="submit" style={{ display: "flex", alignItems: "center", gap: "6px", background: "var(--primary)", color: "#fff", padding: "8px 20px" }}>
              <span style={{ fontSize: "14px" }}>+</span> Dispatch Alert
            </button>
          </div>
        </form>
      </div>

      <div className="grid" style={{ marginTop: 24, display: "grid", gridTemplateColumns: "1fr 1.2fr", gap: "24px" }}>
        {/* Left: incident list */}
        <div className="vstack" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div className="card card-pad" style={{ background: "#fff", border: "1px solid #e2e8f0", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.02)" }}>
            <div style={{ marginBottom: "16px", borderBottom: "1px dashed #e2e8f0", paddingBottom: "12px" }}>
              <div className="title" style={{ fontSize: "16px", color: "var(--text)" }}>📋 Incident Log</div>
              <div className="small" style={{ color: "var(--muted)", marginTop: "4px" }}>
                Select a logged incident to manage workflow.
              </div>
            </div>

            <div className="vstack" style={{ display: "flex", flexDirection: "column", gap: "10px", maxHeight: "500px", overflowY: "auto", paddingRight: "4px" }}>
              {sortedIncidents.length === 0 ? (
                <div style={{ padding: "30px", textAlign: "center", background: "#f8fafc", borderRadius: "8px", border: "1px dashed #cbd5e1", color: "#64748b", fontWeight: 600 }}>
                  No incidents reported. System clear.
                </div>
              ) : (
                sortedIncidents.map((inc) => (
                  <button
                    key={inc.incident_id}
                    onClick={() => setSelectedId(inc.incident_id)}
                    type="button"
                    style={{
                      display: "flex", flexDirection: "column", gap: "8px", padding: "14px",
                      background: selectedId === inc.incident_id ? "#f1f5f9" : "#fff",
                      border: selectedId === inc.incident_id ? "2px solid #3b82f6" : "1px solid #e2e8f0",
                      borderRadius: "10px", cursor: "pointer", transition: "all 0.2s",
                      textAlign: "left"
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
                      <div style={{ fontSize: "15px", fontWeight: 800, color: "var(--text)" }}>
                        {inc.type} <span style={{ color: "var(--muted)", fontWeight: 600 }}>/ {inc.pipeline_id}</span>
                      </div>
                      <span className={`badge ${badgeClassForSeverity(inc.severity)}`} style={{ fontSize: "11px", padding: "4px 8px" }}>
                        Severity: {inc.severity}
                      </span>
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
                      <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                        <span style={{ fontSize: "12px", color: "#64748b" }}>Status:</span>
                        <span className={`badge ${badgeClassForIncidentStatus(inc.status)}`} style={{ fontSize: "10px" }}>
                          {inc.status}
                        </span>
                      </div>
                      <div style={{ fontSize: "12px", color: "#64748b", fontWeight: 600 }}>
                        Score: <span style={{ color: "var(--text)", fontWeight: 800 }}>{inc.risk_score}</span>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right: details */}
        <div className="vstack" style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          <div className="card card-pad" style={{ background: "linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)", border: "1px solid #e2e8f0", boxShadow: "0 10px 15px -3px rgba(0,0,0,0.05)" }}>
            <div style={{ marginBottom: "16px", borderBottom: "1px dashed #e2e8f0", paddingBottom: "12px" }}>
              <div className="title" style={{ fontSize: "16px", color: "var(--text)" }}>🔍 Response Toolkit</div>
            </div>

            {!selectedIncident ? (
              <div style={{ padding: "40px 20px", textAlign: "center", background: "#f8fafc", borderRadius: "12px", border: "1px dashed #cbd5e1", color: "#64748b" }}>
                <div style={{ fontSize: "32px", marginBottom: "12px" }}>🖱️</div>
                <div style={{ fontWeight: 800, fontSize: "16px", marginBottom: "4px", color: "var(--text)" }}>Awaiting Selection</div>
                <div style={{ fontSize: "13px" }}>Choose an incident from the log to view details and deploy response teams.</div>
              </div>
            ) : (
              <div className="vstack" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

                {/* Header card */}
                <div style={{ padding: "16px", background: selectedIncident.severity === "HIGH" ? "#fef2f2" : "#f8fafc", borderRadius: "12px", border: selectedIncident.severity === "HIGH" ? "1px solid #fecaca" : "1px solid #e2e8f0" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <div style={{ fontSize: "20px", fontWeight: 900, color: "var(--text)" }}>{selectedIncident.type} <span style={{ color: "var(--muted)" }}>@ {selectedIncident.pipeline_id}</span></div>
                      <div style={{ fontSize: "13px", color: "var(--muted)", marginTop: "6px" }}>
                        Detected: <b style={{ color: "var(--text)" }}>{new Date(selectedIncident.detected_at).toLocaleString()}</b>
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <span className={`badge ${badgeClassForSeverity(selectedIncident.severity)}`} style={{ fontSize: "12px", padding: "6px 10px" }}>
                        {selectedIncident.severity} IMPACT
                      </span>
                      <div style={{ fontSize: "12px", color: "var(--muted)", marginTop: "6px", fontWeight: 800 }}>Risk Score {selectedIncident.risk_score}/100</div>
                    </div>
                  </div>
                </div>

                {/* Workflow Controls */}
                <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "16px" }}>
                  <div style={{ fontSize: "14px", fontWeight: 800, marginBottom: "12px", color: "var(--text)" }}>🛠️ Repair Workflow</div>

                  <div style={{ display: "flex", gap: "24px", marginBottom: "16px" }}>
                    <div>
                      <div style={{ fontSize: "12px", color: "#64748b", fontWeight: 700, marginBottom: "4px" }}>Incident State</div>
                      <span className={`badge ${badgeClassForIncidentStatus(selectedIncident.status)}`} style={{ fontSize: "13px", padding: "6px 12px" }}>
                        {selectedIncident.status}
                      </span>
                    </div>
                    <div>
                      <div style={{ fontSize: "12px", color: "#64748b", fontWeight: 700, marginBottom: "4px" }}>Asset State</div>
                      <span className={`badge ${badgeClassForPipelineStatus(selectedIncident.pipeline_status)}`} style={{ fontSize: "13px", padding: "6px 12px" }}>
                        {selectedIncident.pipeline_status || "—"}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                    {INCIDENT_STATUSES.map((s) => (
                      <button
                        key={s}
                        type="button"
                        style={{
                          padding: "8px 12px", borderRadius: "8px", fontSize: "12px", fontWeight: selectedIncident.status === s ? 800 : 700,
                          cursor: "pointer", transition: "all 0.2s",
                          background: selectedIncident.status === s ? "var(--primary)" : "#f1f5f9",
                          color: selectedIncident.status === s ? "#fff" : "#475569",
                          border: "none",
                          boxShadow: selectedIncident.status === s ? "0 4px 6px -1px rgba(59,130,246,0.3)" : "none"
                        }}
                        onClick={() => updateStatus(selectedIncident.incident_id, s)}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                {/* DB Details */}
                {selectedPipeline ? (
                  <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "16px" }}>
                    <div style={{ fontSize: "14px", fontWeight: 800, marginBottom: "12px", color: "var(--text)" }}>⚙️ Underlying Asset Schema</div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", fontSize: "13px", background: "#f8fafc", padding: "12px", borderRadius: "8px" }}>
                      <div><span style={{ color: "#64748b" }}>ID:</span> <b style={{ color: "var(--text)" }}>{selectedPipeline.pipeline_id}</b></div>
                      <div><span style={{ color: "#64748b" }}>Name:</span> <b style={{ color: "var(--text)" }}>{selectedPipeline.pipe_name}</b></div>
                      <div><span style={{ color: "#64748b" }}>Zone:</span> <b style={{ color: "var(--text)" }}>{selectedPipeline.area} / {selectedPipeline.zone}</b></div>
                      <div><span style={{ color: "#64748b" }}>Material:</span> <b style={{ color: "var(--text)" }}>{selectedPipeline.material}</b></div>
                      <div><span style={{ color: "#64748b" }}>Spec:</span> <b style={{ color: "var(--text)" }}>{selectedPipeline.diameter_mm}mm x {selectedPipeline.length_m}m</b></div>
                      <div><span style={{ color: "#64748b" }}>Vintage:</span> <b style={{ color: "var(--text)" }}>{selectedPipeline.install_year}</b></div>
                      <div><span style={{ color: "#64748b" }}>GPS:</span> <b style={{ color: "var(--text)", fontFamily: "monospace" }}>{selectedPipeline.gps_latitude}, {selectedPipeline.gps_longitude}</b></div>
                      <div><span style={{ color: "#64748b" }}>Corrosion:</span> <b style={{ color: "var(--text)" }}>{selectedPipeline.corrosion_risk}</b></div>
                      <div><span style={{ color: "#64748b" }}>Leak Hist:</span> <b style={{ color: "var(--text)" }}>{selectedPipeline.leak_count}</b></div>
                      <div><span style={{ color: "#64748b" }}>Last Ops:</span> <b style={{ color: "var(--text)" }}>{selectedPipeline.last_maintenance_date || "N/A"}</b></div>
                    </div>
                  </div>
                ) : null}

                {/* Notes */}
                {selectedIncident.note ? (
                  <div style={{ background: "#fefce8", border: "1px solid #fef08a", borderRadius: "12px", padding: "16px" }}>
                    <div style={{ fontSize: "14px", fontWeight: 800, marginBottom: "4px", color: "#854d0e" }}>📒 Dispatcher Notes</div>
                    <div style={{ fontSize: "13px", color: "#713f12", fontStyle: "italic" }}>"{selectedIncident.note}"</div>
                  </div>
                ) : null}

                {/* Delete Button */}
                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "8px" }}>
                  <button
                    type="button"
                    style={{ background: "#fff", border: "1px solid #fecaca", color: "#dc2626", padding: "8px 16px", borderRadius: "8px", fontWeight: 700, cursor: "pointer", transition: "all 0.2s" }}
                    onClick={() => removeIncident(selectedIncident.incident_id)}
                    onMouseEnter={(e) => { e.currentTarget.style.background = '#fef2f2'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = '#fff'; }}
                  >
                    🗑️ Retract Incident
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="card card-pad" style={{ background: "#f0fdf4", border: "1px dashed #6ee7b7" }}>
            <div style={{ fontSize: "14px", fontWeight: 800, color: "#065f46" }}>💡 Action Matrix</div>
            <div style={{ fontSize: "13px", marginTop: "8px", color: "#064e3b", lineHeight: "1.6", display: "flex", flexDirection: "column", gap: "6px" }}>
              <div><b style={{ color: "#e11d48" }}>HIGH IMPACT</b> → Dispatch crisis crew + Isolate grid section immediately.</div>
              <div><b style={{ color: "#d97706" }}>MEDIUM IMPACT</b> → Schedule civil repair within 24–48 operating hours.</div>
              <div><b style={{ color: "#059669" }}>LOW IMPACT</b> → Monitor asset telemetry and plan preventive maintenance.</div>
            </div>
          </div>
        </div>
      </div>
      <style>{`
      @keyframes fadeIn {
        from { opacity: 0; transform: translateY(10px); }
        to { opacity: 1; transform: translateY(0); }
      }
      @media (max-width: 900px) {
        .grid { grid-template-columns: 1fr !important; }
        .formGrid { grid-template-columns: 1fr !important; }
      }
    `}</style>
    </div>
  );
}
