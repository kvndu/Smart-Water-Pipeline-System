import { useEffect, useMemo, useState } from "react";
import api from "../utils/api.js";

const LS_KEY = "waterflow_incidents_v1";

function nowISO() {
  return new Date().toISOString();
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

function severityFromPipeline(p) {
  if (!p) return "LOW";
  if (p.risk_level === "High") return "HIGH";
  if (p.risk_level === "Medium") return "MEDIUM";
  return "LOW";
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
  const [pipelines, setPipelines] = useState([]);
  const [loadingPipelines, setLoadingPipelines] = useState(true);

  const [incidents, setIncidents] = useState(() => loadIncidents());
  const [selectedId, setSelectedId] = useState(null);

  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchPipelines() {
      try {
        setLoadingPipelines(true);
        const res = await api.get("/pipelines-with-risk?limit=100");
        setPipelines(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        console.error("Alerts fetch error:", err);
        setPipelines([]);
      } finally {
        setLoadingPipelines(false);
      }
    }

    fetchPipelines();
  }, []);

  useEffect(() => {
    saveIncidents(incidents);
  }, [incidents]);

  const pipelineMap = useMemo(() => {
    const m = new Map();
    pipelines.forEach((p) => m.set(p.pipeline_id, p));
    return m;
  }, [pipelines]);

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

  const stats = useMemo(() => {
    return {
      total: incidents.length,
      high: incidents.filter((i) => i.severity === "HIGH").length,
      medium: incidents.filter((i) => i.severity === "MEDIUM").length,
      low: incidents.filter((i) => i.severity === "LOW").length,
    };
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

    const severity = severityFromPipeline(p);
    const riskScore = Number(p.risk_score || 0);

    const incident = {
      incident_id: `INC-${Date.now()}`,
      pipeline_id: pid,
      type: form.type,
      severity,
      risk_score: riskScore,
      detected_at: nowISO(),
      status: "NEW",
      pipeline_status: "UNDER_REPAIR",
      estimated_location: {
        lat: null,
        lng: null,
        label: `${p.area_name} (${p.ds_division})`,
      },
      note: form.note?.trim() || "",
    };

    setIncidents((prev) => [incident, ...prev]);
    setForm(emptyForm);
    setSelectedId(incident.incident_id);
  }

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
      <div
        className="header"
        style={{ marginBottom: "28px", borderBottom: "1px solid #e2e8f0", paddingBottom: "16px" }}
      >
        <div>
          <div
            className="title"
            style={{ fontSize: "28px", color: "var(--text)", fontWeight: 900, marginBottom: "4px" }}
          >
            Incidents & Alerts
          </div>
          <div className="subtitle" style={{ fontSize: "15px", color: "var(--muted)" }}>
            Create and track rule-based incidents across the pipeline network.
          </div>
        </div>

        <div className="hstack" style={{ gap: "10px" }}>
          <span
            className="badge"
            style={{
              fontSize: "12px",
              padding: "6px 12px",
              background: "#fef3c7",
              color: "#d97706",
              border: "1px solid #fde68a",
            }}
          >
            🛡️ Rule-based Engine
          </span>

          <span
            className="badge"
            style={{
              fontSize: "12px",
              padding: "6px 12px",
              background: "#eff6ff",
              color: "#1d4ed8",
              border: "1px solid #bfdbfe",
            }}
          >
            {stats.total} Incidents
          </span>
        </div>
      </div>

      {/* KPI */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: "16px",
          marginBottom: "24px",
        }}
      >
        <div className="card card-pad">
          <div className="kpiLabel">Total Incidents</div>
          <div className="kpiValue">{stats.total}</div>
        </div>
        <div className="card card-pad" style={{ background: "#fff7ed" }}>
          <div className="kpiLabel">High Severity</div>
          <div className="kpiValue" style={{ color: "#dc2626" }}>{stats.high}</div>
        </div>
        <div className="card card-pad" style={{ background: "#fefce8" }}>
          <div className="kpiLabel">Medium Severity</div>
          <div className="kpiValue" style={{ color: "#d97706" }}>{stats.medium}</div>
        </div>
        <div className="card card-pad" style={{ background: "#ecfdf5" }}>
          <div className="kpiLabel">Low Severity</div>
          <div className="kpiValue" style={{ color: "#059669" }}>{stats.low}</div>
        </div>
      </div>

      {/* Create Incident */}
      <div
        className="card card-pad"
        style={{
          background: "linear-gradient(to right, #ffffff, #f8fafc)",
          border: "1px solid #e2e8f0",
          boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)",
        }}
      >
        <div
          className="hstack"
          style={{
            justifyContent: "space-between",
            borderBottom: "1px dashed #cbd5e1",
            paddingBottom: "12px",
            marginBottom: "16px",
          }}
        >
          <div>
            <div className="title" style={{ fontSize: "16px", color: "var(--text)" }}>
              📝 Report New Incident
            </div>
            <div className="small" style={{ color: "var(--muted)" }}>
              Select a pipeline and incident type. Severity is derived from the pipeline risk level.
            </div>
          </div>

          <span
            className="badge"
            style={{
              background: "#e2e8f0",
              color: "#334155",
              fontSize: "13px",
              fontWeight: 800,
            }}
          >
            {loadingPipelines ? "Loading assets..." : `${pipelines.length} Assets`}
          </span>
        </div>

        <form onSubmit={createIncident}>
          <div
            className="formGrid"
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 2fr",
              gap: "16px",
            }}
          >
            <select
              className="select"
              name="pipeline_id"
              value={form.pipeline_id}
              onChange={onChange}
              style={{
                width: "100%",
                padding: "12px",
                borderRadius: "8px",
                border: "1px solid #cbd5e1",
                background: "#fff",
                fontWeight: 600,
              }}
            >
              <option value="">-- Select Asset --</option>
              {pipelines.map((p) => (
                <option key={p.pipeline_id} value={p.pipeline_id}>
                  {p.pipeline_id} — {p.area_name} / {p.ds_division}
                </option>
              ))}
            </select>

            <select
              className="select"
              name="type"
              value={form.type}
              onChange={onChange}
              style={{
                width: "100%",
                padding: "12px",
                borderRadius: "8px",
                border: "1px solid #cbd5e1",
                background: "#fff",
                fontWeight: 600,
              }}
            >
              {INCIDENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>

            <input
              className="input"
              name="note"
              value={form.note}
              onChange={onChange}
              placeholder="Optional note (e.g., burst near bridge)"
              style={{
                width: "100%",
                padding: "12px",
                borderRadius: "8px",
                border: "1px solid #cbd5e1",
                background: "#fff",
              }}
            />
          </div>

          {error ? (
            <div
              style={{
                marginTop: "12px",
                padding: "10px",
                background: "#fef2f2",
                color: "#dc2626",
                borderRadius: "8px",
                fontSize: "13px",
                fontWeight: 700,
                border: "1px solid #fecaca",
              }}
            >
              {error}
            </div>
          ) : null}

          <div className="hstack" style={{ marginTop: "20px", justifyContent: "flex-end", gap: "12px" }}>
            <button
              className="btn"
              type="button"
              onClick={() => {
                setForm(emptyForm);
                setError("");
              }}
              style={{
                background: "#f1f5f9",
                border: "none",
                color: "#475569",
                fontWeight: 700,
                padding: "8px 16px",
              }}
            >
              Clear form
            </button>

            <button
              className="btn primary"
              type="submit"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                background: "var(--primary)",
                color: "#fff",
                padding: "8px 20px",
              }}
            >
              <span style={{ fontSize: "14px" }}>+</span> Dispatch Alert
            </button>
          </div>
        </form>
      </div>

      <div
        className="grid"
        style={{
          marginTop: 24,
          display: "grid",
          gridTemplateColumns: "1fr 1.2fr",
          gap: "24px",
        }}
      >
        {/* Left: Incident list */}
        <div className="vstack" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div
            className="card card-pad"
            style={{
              background: "#fff",
              border: "1px solid #e2e8f0",
              boxShadow: "0 4px 6px -1px rgba(0,0,0,0.02)",
            }}
          >
            <div style={{ marginBottom: "16px", borderBottom: "1px dashed #e2e8f0", paddingBottom: "12px" }}>
              <div className="title" style={{ fontSize: "16px", color: "var(--text)" }}>
                📋 Incident Log
              </div>
              <div className="small" style={{ color: "var(--muted)", marginTop: "4px" }}>
                Select a logged incident to manage workflow.
              </div>
            </div>

            <div
              className="vstack"
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "10px",
                maxHeight: "500px",
                overflowY: "auto",
                paddingRight: "4px",
              }}
            >
              {sortedIncidents.length === 0 ? (
                <div
                  style={{
                    padding: "30px",
                    textAlign: "center",
                    background: "#f8fafc",
                    borderRadius: "8px",
                    border: "1px dashed #cbd5e1",
                    color: "#64748b",
                    fontWeight: 600,
                  }}
                >
                  No incidents reported. System clear.
                </div>
              ) : (
                sortedIncidents.map((inc) => (
                  <button
                    key={inc.incident_id}
                    onClick={() => setSelectedId(inc.incident_id)}
                    type="button"
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "8px",
                      padding: "14px",
                      background: selectedId === inc.incident_id ? "#f1f5f9" : "#fff",
                      border: selectedId === inc.incident_id ? "2px solid #3b82f6" : "1px solid #e2e8f0",
                      borderRadius: "10px",
                      cursor: "pointer",
                      transition: "all 0.2s",
                      textAlign: "left",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        width: "100%",
                      }}
                    >
                      <div style={{ fontSize: "15px", fontWeight: 800, color: "var(--text)" }}>
                        {inc.type} <span style={{ color: "var(--muted)", fontWeight: 600 }}>/ {inc.pipeline_id}</span>
                      </div>
                      <span
                        className={`badge ${badgeClassForSeverity(inc.severity)}`}
                        style={{ fontSize: "11px", padding: "4px 8px" }}
                      >
                        Severity: {inc.severity}
                      </span>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        width: "100%",
                      }}
                    >
                      <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                        <span style={{ fontSize: "12px", color: "#64748b" }}>Status:</span>
                        <span
                          className={`badge ${badgeClassForIncidentStatus(inc.status)}`}
                          style={{ fontSize: "10px" }}
                        >
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

        {/* Right: Details */}
        <div className="vstack" style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          <div
            className="card card-pad"
            style={{
              background: "linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)",
              border: "1px solid #e2e8f0",
              boxShadow: "0 10px 15px -3px rgba(0,0,0,0.05)",
            }}
          >
            <div style={{ marginBottom: "16px", borderBottom: "1px dashed #e2e8f0", paddingBottom: "12px" }}>
              <div className="title" style={{ fontSize: "16px", color: "var(--text)" }}>
                🔍 Response Toolkit
              </div>
            </div>

            {!selectedIncident ? (
              <div
                style={{
                  padding: "40px 20px",
                  textAlign: "center",
                  background: "#f8fafc",
                  borderRadius: "12px",
                  border: "1px dashed #cbd5e1",
                  color: "#64748b",
                }}
              >
                <div style={{ fontSize: "32px", marginBottom: "12px" }}>🖱️</div>
                <div style={{ fontWeight: 800, fontSize: "16px", marginBottom: "4px", color: "var(--text)" }}>
                  Awaiting Selection
                </div>
                <div style={{ fontSize: "13px" }}>
                  Choose an incident from the log to view details and deploy response teams.
                </div>
              </div>
            ) : (
              <div className="vstack" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div
                  style={{
                    padding: "16px",
                    background: selectedIncident.severity === "HIGH" ? "#fef2f2" : "#f8fafc",
                    borderRadius: "12px",
                    border:
                      selectedIncident.severity === "HIGH"
                        ? "1px solid #fecaca"
                        : "1px solid #e2e8f0",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <div style={{ fontSize: "20px", fontWeight: 900, color: "var(--text)" }}>
                        {selectedIncident.type} <span style={{ color: "var(--muted)" }}>@ {selectedIncident.pipeline_id}</span>
                      </div>
                      <div style={{ fontSize: "13px", color: "var(--muted)", marginTop: "6px" }}>
                        Detected: <b style={{ color: "var(--text)" }}>{new Date(selectedIncident.detected_at).toLocaleString()}</b>
                      </div>
                    </div>

                    <div style={{ textAlign: "right" }}>
                      <span
                        className={`badge ${badgeClassForSeverity(selectedIncident.severity)}`}
                        style={{ fontSize: "12px", padding: "6px 10px" }}
                      >
                        {selectedIncident.severity} IMPACT
                      </span>
                      <div style={{ fontSize: "12px", color: "var(--muted)", marginTop: "6px", fontWeight: 800 }}>
                        Risk Score {selectedIncident.risk_score}/1
                      </div>
                    </div>
                  </div>
                </div>

                <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "16px" }}>
                  <div style={{ fontSize: "14px", fontWeight: 800, marginBottom: "12px", color: "var(--text)" }}>
                    🛠️ Repair Workflow
                  </div>

                  <div style={{ display: "flex", gap: "24px", marginBottom: "16px", flexWrap: "wrap" }}>
                    <div>
                      <div style={{ fontSize: "12px", color: "#64748b", fontWeight: 700, marginBottom: "4px" }}>
                        Incident State
                      </div>
                      <span className={`badge ${badgeClassForIncidentStatus(selectedIncident.status)}`} style={{ fontSize: "13px", padding: "6px 12px" }}>
                        {selectedIncident.status}
                      </span>
                    </div>

                    <div>
                      <div style={{ fontSize: "12px", color: "#64748b", fontWeight: 700, marginBottom: "4px" }}>
                        Asset State
                      </div>
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
                          padding: "8px 12px",
                          borderRadius: "8px",
                          fontSize: "12px",
                          fontWeight: selectedIncident.status === s ? 800 : 700,
                          cursor: "pointer",
                          transition: "all 0.2s",
                          background: selectedIncident.status === s ? "var(--primary)" : "#f1f5f9",
                          color: selectedIncident.status === s ? "#fff" : "#475569",
                          border: "none",
                        }}
                        onClick={() => updateStatus(selectedIncident.incident_id, s)}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                {selectedPipeline ? (
                  <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "16px" }}>
                    <div style={{ fontSize: "14px", fontWeight: 800, marginBottom: "12px", color: "var(--text)" }}>
                      ⚙️ Underlying Asset Schema
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: "12px",
                        fontSize: "13px",
                        background: "#f8fafc",
                        padding: "12px",
                        borderRadius: "8px",
                      }}
                    >
                      <div><span style={{ color: "#64748b" }}>ID:</span> <b style={{ color: "var(--text)" }}>{selectedPipeline.pipeline_id}</b></div>
                      <div><span style={{ color: "#64748b" }}>Division:</span> <b style={{ color: "var(--text)" }}>{selectedPipeline.ds_division}</b></div>
                      <div><span style={{ color: "#64748b" }}>Area:</span> <b style={{ color: "var(--text)" }}>{selectedPipeline.area_name}</b></div>
                      <div><span style={{ color: "#64748b" }}>Material:</span> <b style={{ color: "var(--text)" }}>{selectedPipeline.material_type}</b></div>
                      <div><span style={{ color: "#64748b" }}>Diameter:</span> <b style={{ color: "var(--text)" }}>{selectedPipeline.diameter_mm} mm</b></div>
                      <div><span style={{ color: "#64748b" }}>Length:</span> <b style={{ color: "var(--text)" }}>{selectedPipeline.pipe_length_m} m</b></div>
                      <div><span style={{ color: "#64748b" }}>Install Year:</span> <b style={{ color: "var(--text)" }}>{selectedPipeline.install_year}</b></div>
                      <div><span style={{ color: "#64748b" }}>Previous Leaks:</span> <b style={{ color: "var(--text)" }}>{selectedPipeline.previous_leak_count}</b></div>
                      <div><span style={{ color: "#64748b" }}>Risk Level:</span> <b style={{ color: "var(--text)" }}>{selectedPipeline.risk_level}</b></div>
                      <div><span style={{ color: "#64748b" }}>Recommendation:</span> <b style={{ color: "var(--text)" }}>{selectedPipeline.recommendation}</b></div>
                    </div>
                  </div>
                ) : null}

                {selectedIncident.note ? (
                  <div style={{ background: "#fefce8", border: "1px solid #fef08a", borderRadius: "12px", padding: "16px" }}>
                    <div style={{ fontSize: "14px", fontWeight: 800, marginBottom: "4px", color: "#854d0e" }}>
                      📒 Dispatcher Notes
                    </div>
                    <div style={{ fontSize: "13px", color: "#713f12", fontStyle: "italic" }}>
                      "{selectedIncident.note}"
                    </div>
                  </div>
                ) : null}

                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "8px" }}>
                  <button
                    type="button"
                    style={{
                      background: "#fff",
                      border: "1px solid #fecaca",
                      color: "#dc2626",
                      padding: "8px 16px",
                      borderRadius: "8px",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                    onClick={() => removeIncident(selectedIncident.incident_id)}
                  >
                    🗑️ Retract Incident
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="card card-pad" style={{ background: "#f0fdf4", border: "1px dashed #6ee7b7" }}>
            <div style={{ fontSize: "14px", fontWeight: 800, color: "#065f46" }}>💡 Action Matrix</div>
            <div
              style={{
                fontSize: "13px",
                marginTop: "8px",
                color: "#064e3b",
                lineHeight: "1.6",
                display: "flex",
                flexDirection: "column",
                gap: "6px",
              }}
            >
              <div><b style={{ color: "#e11d48" }}>HIGH IMPACT</b> → Dispatch crisis crew + isolate grid section immediately.</div>
              <div><b style={{ color: "#d97706" }}>MEDIUM IMPACT</b> → Schedule field repair within 24–48 hours.</div>
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