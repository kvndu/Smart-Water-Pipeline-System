import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../utils/api.js";

const LS_KEY = "waterflow_incidents_v2";

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

function badgeClassForPriority(priority) {
  if (priority === "Critical") return "danger";
  if (priority === "Moderate") return "warn";
  return "ok";
}

function severityFromPipeline(p) {
  if (!p) return "LOW";
  if (p.risk_level === "High") return "HIGH";
  if (p.risk_level === "Medium") return "MEDIUM";
  return "LOW";
}

function getAutoAlertType(p) {
  const leaks = Number(p.previous_leak_count || 0);
  const months = Number(p.estimated_life_months || 24);

  if (p.risk_level === "High" && leaks >= 2) return "Critical repeated failure risk";
  if (p.risk_level === "High") return "High risk asset";
  if (leaks >= 2) return "Repeated leak history";
  if (months <= 6) return "Short remaining safe life";
  return "Routine watch";
}

function buildRuleBasedAlerts(pipelines) {
  const alerts = [];

  pipelines.forEach((p) => {
    const leaks = Number(p.previous_leak_count || 0);
    const months = Number(p.estimated_life_months || 24);
    const failureProbability = Number(p.failure_probability || 0);
    const maintenanceYear = Number(p.last_maintenance_year || new Date().getFullYear());
    const maintenanceGap = new Date().getFullYear() - maintenanceYear;

    if (p.risk_level === "High") {
      alerts.push({
        id: `${p.pipeline_id}-risk`,
        pipeline_id: p.pipeline_id,
        area_name: p.area_name,
        ds_division: p.ds_division,
        title: "High risk pipeline",
        severity: "HIGH",
        category: getAutoAlertType(p),
        reason: "This pipeline is currently classified as High risk by the predictive engine.",
        recommendation: p.recommendation || null,
        failure_probability: failureProbability,
        risk_trend: p.risk_trend || "Stable",
      });
    }

    if (leaks >= 2) {
      alerts.push({
        id: `${p.pipeline_id}-leaks`,
        pipeline_id: p.pipeline_id,
        area_name: p.area_name,
        ds_division: p.ds_division,
        title: "Repeated leaks detected",
        severity: p.risk_level === "High" ? "HIGH" : "MEDIUM",
        category: getAutoAlertType(p),
        reason: `This pipeline has ${leaks} recorded previous leaks.`,
        recommendation: p.recommendation || null,
        failure_probability: failureProbability,
        risk_trend: p.risk_trend || "Stable",
      });
    }

    if (months <= 6) {
      alerts.push({
        id: `${p.pipeline_id}-life`,
        pipeline_id: p.pipeline_id,
        area_name: p.area_name,
        ds_division: p.ds_division,
        title: "Short remaining safe life",
        severity: failureProbability >= 75 ? "HIGH" : "MEDIUM",
        category: getAutoAlertType(p),
        reason: `Predicted safe life is only ${months} months.`,
        recommendation: p.recommendation || null,
        failure_probability: failureProbability,
        risk_trend: p.risk_trend || "Stable",
      });
    }

    if (maintenanceGap >= 5) {
      alerts.push({
        id: `${p.pipeline_id}-maintenance`,
        pipeline_id: p.pipeline_id,
        area_name: p.area_name,
        ds_division: p.ds_division,
        title: "Maintenance overdue",
        severity: p.risk_level === "High" ? "HIGH" : "MEDIUM",
        category: "Maintenance gap",
        reason: `Last maintenance was ${maintenanceGap} years ago.`,
        recommendation: p.recommendation || null,
        failure_probability: failureProbability,
        risk_trend: p.risk_trend || "Stable",
      });
    }
  });

  return alerts;
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

function KpiCard({ label, value, tone = "" }) {
  return (
    <div className={`alertKpiCard ${tone}`}>
      <div className="alertKpiLabel">{label}</div>
      <div className="alertKpiValue">{value}</div>
    </div>
  );
}

function EmptyState({ title, message }) {
  return (
    <div className="alertsEmptyState">
      <div className="alertsEmptyIcon">📡</div>
      <div className="alertsEmptyTitle">{title}</div>
      <div className="alertsEmptyMessage">{message}</div>
    </div>
  );
}

export default function Alerts() {
  const [pipelines, setPipelines] = useState([]);
  const [loadingPipelines, setLoadingPipelines] = useState(true);

  const [incidents, setIncidents] = useState(() => loadIncidents());
  const [selectedId, setSelectedId] = useState(null);

  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [severityFilter, setSeverityFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");

  useEffect(() => {
    async function fetchPipelines() {
      try {
        setLoadingPipelines(true);
        const res = await api.get("/pipelines-with-risk?limit=2000");
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
    pipelines.forEach((p) => m.set(String(p.pipeline_id), p));
    return m;
  }, [pipelines]);

  const selectedIncident = useMemo(
    () => incidents.find((x) => x.incident_id === selectedId) || null,
    [incidents, selectedId]
  );

  const selectedPipeline = useMemo(() => {
    if (!selectedIncident) return null;
    return pipelineMap.get(String(selectedIncident.pipeline_id)) || null;
  }, [selectedIncident, pipelineMap]);

  const sortedIncidents = useMemo(() => {
    return [...incidents].sort((a, b) => (a.detected_at < b.detected_at ? 1 : -1));
  }, [incidents]);

  const filteredIncidents = useMemo(() => {
    return sortedIncidents.filter((inc) => {
      const matchesSearch =
        !search.trim() ||
        String(inc.pipeline_id).toLowerCase().includes(search.toLowerCase()) ||
        String(inc.type).toLowerCase().includes(search.toLowerCase()) ||
        String(inc.note || "").toLowerCase().includes(search.toLowerCase());

      const matchesSeverity =
        severityFilter === "ALL" || inc.severity === severityFilter;

      const matchesStatus =
        statusFilter === "ALL" || inc.status === statusFilter;

      return matchesSearch && matchesSeverity && matchesStatus;
    });
  }, [sortedIncidents, search, severityFilter, statusFilter]);

  const stats = useMemo(() => {
    return {
      total: incidents.length,
      high: incidents.filter((i) => i.severity === "HIGH").length,
      medium: incidents.filter((i) => i.severity === "MEDIUM").length,
      low: incidents.filter((i) => i.severity === "LOW").length,
      active: incidents.filter((i) =>
        ["NEW", "ACKNOWLEDGED", "DISPATCHED", "FIX_IN_PROGRESS"].includes(i.status)
      ).length,
      closed: incidents.filter((i) =>
        ["FIXED", "CLOSED"].includes(i.status)
      ).length,
    };
  }, [incidents]);

  const ruleBasedAlerts = useMemo(
    () => buildRuleBasedAlerts(pipelines).slice(0, 12),
    [pipelines]
  );

  function onChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function createIncident(e) {
    e.preventDefault();
    setError("");

    const pid = form.pipeline_id.trim();
    if (!pid) return setError("Select a pipeline first.");

    const p = pipelineMap.get(String(pid));
    if (!p) return setError("Invalid pipeline selected.");

    const severity = severityFromPipeline(p);
    const riskScore = Number(p.risk_score || 0);

    const incident = {
      incident_id: `INC-${Date.now()}`,
      pipeline_id: pid,
      type: form.type,
      severity,
      risk_score: riskScore.toFixed(3),
      detected_at: nowISO(),
      status: "NEW",
      pipeline_status: "UNDER_REPAIR",
      estimated_location: {
        lat: p.start_lat || null,
        lng: p.start_lng || null,
        label: `${p.area_name || "-"} (${p.ds_division || "-"})`,
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
    <div className="container" style={{ animation: "fadeIn 0.45s ease" }}>
      <div className="pageHero pageHeroCompact">
        <div>
          <div className="heroEyebrow">Operational Response</div>
          <div className="pageTitle">Incidents & Alerts Center</div>
          <div className="pageSubtitle">
            Track field incidents, review auto-generated alerts, and manage repair workflow from one page.
          </div>
        </div>

        <div className="pageActions">
          <span className="badge ok">Rule-based engine</span>
          <span className="badge">{stats.total} incidents</span>
          <span className="badge warn">{ruleBasedAlerts.length} auto alerts</span>
        </div>
      </div>

      <div className="alertsKpiGrid">
        <KpiCard label="Total incidents" value={stats.total} />
        <KpiCard label="High severity" value={stats.high} tone="toneDanger" />
        <KpiCard label="Medium severity" value={stats.medium} tone="toneWarn" />
        <KpiCard label="Low severity" value={stats.low} tone="toneOk" />
        <KpiCard label="Active workflow" value={stats.active} tone="toneActive" />
        <KpiCard label="Closed / resolved" value={stats.closed} tone="toneClosed" />
      </div>

      <div className="alertsTopGrid">
        <div className="card card-pad">
          <div className="sectionHeader">
            <div>
              <div className="sectionTitle">Report new incident</div>
              <div className="sectionSubtitle">
                Select a pipeline and incident type. Severity is derived from the current pipeline risk level.
              </div>
            </div>

            <span className="badge">
              {loadingPipelines ? "Loading assets..." : `${pipelines.length} assets`}
            </span>
          </div>

          <form onSubmit={createIncident}>
            <div className="alertsFormGrid">
              <select
                className="select"
                name="pipeline_id"
                value={form.pipeline_id}
                onChange={onChange}
              >
                <option value="">-- Select Pipeline --</option>
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
                placeholder="Optional field note (e.g., burst near school road)"
              />
            </div>

            {error ? (
              <div className="alertsErrorBox">{error}</div>
            ) : null}

            <div className="alertsActionRow">
              <button
                className="btn"
                type="button"
                onClick={() => {
                  setForm(emptyForm);
                  setError("");
                }}
              >
                Clear form
              </button>

              <button className="btn primary" type="submit">
                + Dispatch alert
              </button>
            </div>
          </form>
        </div>

        <div className="card card-pad">
          <div className="sectionHeader">
            <div>
              <div className="sectionTitle">Auto-generated alerts</div>
              <div className="sectionSubtitle">
                Pipelines flagged automatically from risk level, leak history, safe life, and maintenance gap.
              </div>
            </div>
          </div>

          <div className="alertsAutoList">
            {ruleBasedAlerts.length === 0 ? (
              <EmptyState
                title="No automatic alerts"
                message="The current dataset does not contain pipelines that match the alert rules."
              />
            ) : (
              ruleBasedAlerts.map((alert) => (
                <div key={alert.id} className="autoAlertCard">
                  <div className="autoAlertHead">
                    <div>
                      <div className="autoAlertTitle">{alert.title}</div>
                      <div className="autoAlertSub">
                        {alert.pipeline_id} • {alert.area_name || "-"} • {alert.ds_division || "-"}
                      </div>
                    </div>

                    <span className={`badge ${badgeClassForSeverity(alert.severity)}`}>
                      {alert.severity}
                    </span>
                  </div>

                  <div className="autoAlertMeta">
                    <div><strong>Category:</strong> {alert.category}</div>
                    <div><strong>Failure probability:</strong> {alert.failure_probability || 0}%</div>
                    <div><strong>Trend:</strong> {alert.risk_trend || "-"}</div>
                    <div><strong>Reason:</strong> {alert.reason}</div>
                    <div><strong>Action:</strong> {alert.recommendation?.action || "-"}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="card card-pad" style={{ marginTop: 24 }}>
        <div className="sectionHeader">
          <div>
            <div className="sectionTitle">Incident filters</div>
            <div className="sectionSubtitle">
              Search and filter incident records by severity and workflow status.
            </div>
          </div>
        </div>

        <div className="alertsFilterGrid">
          <input
            className="input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by pipeline ID, type, or note"
          />

          <select
            className="select"
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
          >
            <option value="ALL">All Severity</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>

          <select
            className="select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="ALL">All Status</option>
            {INCIDENT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <div className="small mutedText" style={{ marginTop: 10 }}>
          Showing {filteredIncidents.length} of {incidents.length} incidents.
        </div>
      </div>

      <div className="alertsMainGrid">
        <div className="vstack">
          <div className="card card-pad">
            <div className="sectionHeader">
              <div>
                <div className="sectionTitle">Incident log</div>
                <div className="sectionSubtitle">
                  Select one incident to inspect and manage the workflow.
                </div>
              </div>
            </div>

            <div className="incidentLogList">
              {filteredIncidents.length === 0 ? (
                <EmptyState
                  title="No incidents found"
                  message="Create a new incident or adjust the current filters."
                />
              ) : (
                filteredIncidents.map((inc) => (
                  <button
                    key={inc.incident_id}
                    onClick={() => setSelectedId(inc.incident_id)}
                    type="button"
                    className={`incidentLogCard ${
                      selectedId === inc.incident_id ? "selected" : ""
                    }`}
                  >
                    <div className="incidentLogHead">
                      <div className="incidentLogTitle">
                        {inc.type} <span>/ {inc.pipeline_id}</span>
                      </div>
                      <span className={`badge ${badgeClassForSeverity(inc.severity)}`}>
                        {inc.severity}
                      </span>
                    </div>

                    <div className="incidentLogMeta">
                      <div>
                        Status:{" "}
                        <span className={`badge ${badgeClassForIncidentStatus(inc.status)}`}>
                          {inc.status}
                        </span>
                      </div>
                      <div>
                        Score: <strong>{inc.risk_score}</strong>
                      </div>
                    </div>

                    <div className="incidentLogDate">
                      {new Date(inc.detected_at).toLocaleString()}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="vstack">
          <div className="card card-pad">
            <div className="sectionHeader">
              <div>
                <div className="sectionTitle">Response toolkit</div>
                <div className="sectionSubtitle">
                  Review the selected incident and move it through the repair workflow.
                </div>
              </div>
            </div>

            {!selectedIncident ? (
              <EmptyState
                title="Awaiting selection"
                message="Choose an incident from the log to inspect details and dispatch a response."
              />
            ) : (
              <div className="responseStack">
                <div
                  className={`incidentHero ${
                    selectedIncident.severity === "HIGH" ? "high" : ""
                  }`}
                >
                  <div className="incidentHeroTop">
                    <div>
                      <div className="incidentHeroTitle">
                        {selectedIncident.type} @ {selectedIncident.pipeline_id}
                      </div>
                      <div className="incidentHeroSub">
                        Detected: {new Date(selectedIncident.detected_at).toLocaleString()}
                      </div>
                    </div>

                    <div className="incidentHeroRight">
                      <span className={`badge ${badgeClassForSeverity(selectedIncident.severity)}`}>
                        {selectedIncident.severity} IMPACT
                      </span>
                      <div className="incidentHeroScore">
                        Risk Score {selectedIncident.risk_score}/1
                      </div>
                    </div>
                  </div>
                </div>

                <div className="workflowCard">
                  <div className="workflowTitle">Repair workflow</div>

                  <div className="workflowStatusRow">
                    <div>
                      <div className="workflowLabel">Incident state</div>
                      <span className={`badge ${badgeClassForIncidentStatus(selectedIncident.status)}`}>
                        {selectedIncident.status}
                      </span>
                    </div>

                    <div>
                      <div className="workflowLabel">Asset state</div>
                      <span className={`badge ${badgeClassForPipelineStatus(selectedIncident.pipeline_status)}`}>
                        {selectedIncident.pipeline_status || "—"}
                      </span>
                    </div>
                  </div>

                  <div className="workflowButtons">
                    {INCIDENT_STATUSES.map((s) => (
                      <button
                        key={s}
                        type="button"
                        className={`workflowBtn ${
                          selectedIncident.status === s ? "active" : ""
                        }`}
                        onClick={() => updateStatus(selectedIncident.incident_id, s)}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                {selectedPipeline ? (
                  <>
                    <div className="pipelineInfoCard">
                      <div className="workflowTitle">Selected pipeline</div>

                      <div className="pipelineInfoGrid">
                        <div><span>ID:</span> <strong>{selectedPipeline.pipeline_id}</strong></div>
                        <div><span>Division:</span> <strong>{selectedPipeline.ds_division || "-"}</strong></div>
                        <div><span>Area:</span> <strong>{selectedPipeline.area_name || "-"}</strong></div>
                        <div><span>Material:</span> <strong>{selectedPipeline.material_type || "-"}</strong></div>
                        <div><span>Diameter:</span> <strong>{selectedPipeline.diameter_mm || "-"} mm</strong></div>
                        <div><span>Length:</span> <strong>{selectedPipeline.pipe_length_m || "-"} m</strong></div>
                        <div><span>Install Year:</span> <strong>{selectedPipeline.install_year || "-"}</strong></div>
                        <div><span>Previous Leaks:</span> <strong>{selectedPipeline.previous_leak_count || 0}</strong></div>
                        <div><span>Risk Level:</span> <strong>{selectedPipeline.risk_level || "-"}</strong></div>
                        <div><span>Risk Score:</span> <strong>{Number(selectedPipeline.risk_score || 0).toFixed(3)}</strong></div>
                      </div>
                    </div>

                    <div className="pipelineInfoCard">
                      <div className="workflowTitle">Recommended response</div>

                      <div className="recommendHead">
                        <div className="recommendAction">
                          {selectedPipeline.recommendation?.action || "No action available"}
                        </div>
                        <span className={`badge ${badgeClassForPriority(selectedPipeline.recommendation?.priority)}`}>
                          {selectedPipeline.recommendation?.priority || "Low"}
                        </span>
                      </div>

                      <div className="recommendMessage">
                        {selectedPipeline.recommendation?.message || "No message available."}
                      </div>

                      <div>
                        <div className="workflowLabel" style={{ marginBottom: 8 }}>Reasons</div>
                        {Array.isArray(selectedPipeline.recommendation?.reasons) &&
                        selectedPipeline.recommendation.reasons.length > 0 ? (
                          <ul className="recommendReasons">
                            {selectedPipeline.recommendation.reasons.map((reason, index) => (
                              <li key={index}>{reason}</li>
                            ))}
                          </ul>
                        ) : (
                          <div className="mutedText">No reasons available.</div>
                        )}
                      </div>

                      <div style={{ marginTop: 10 }}>
                        <Link to={`/pipelines/${selectedPipeline.pipeline_id}`} className="mapPopupButton">
                          Open full pipeline details
                        </Link>
                      </div>
                    </div>
                  </>
                ) : null}

                {selectedIncident.note ? (
                  <div className="dispatcherNoteCard">
                    <div className="workflowTitle">Dispatcher notes</div>
                    <div className="dispatcherNoteText">"{selectedIncident.note}"</div>
                  </div>
                ) : null}

                <div className="responseBottomRow">
                  <button
                    type="button"
                    className="deleteIncidentBtn"
                    onClick={() => removeIncident(selectedIncident.incident_id)}
                  >
                    Retract incident
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="card card-pad actionMatrixCard">
            <div className="sectionTitle">Action matrix</div>
            <div className="actionMatrixList">
              <div><strong>HIGH IMPACT</strong> → Dispatch crisis crew and inspect the pipeline immediately.</div>
              <div><strong>MEDIUM IMPACT</strong> → Schedule field inspection within 24–48 hours.</div>
              <div><strong>LOW IMPACT</strong> → Continue routine monitoring and preventive maintenance.</div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .alertsKpiGrid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 16px;
          margin-bottom: 24px;
        }

        .alertKpiCard {
          background: #fff;
          border: 1px solid #e2e8f0;
          border-radius: 18px;
          padding: 18px;
          box-shadow: 0 4px 14px rgba(15, 23, 42, 0.04);
        }

        .alertKpiCard.toneDanger {
          background: #fff7ed;
        }

        .alertKpiCard.toneWarn {
          background: #fefce8;
        }

        .alertKpiCard.toneOk {
          background: #ecfdf5;
        }

        .alertKpiCard.toneActive {
          background: #eff6ff;
        }

        .alertKpiCard.toneClosed {
          background: #f8fafc;
        }

        .alertKpiLabel {
          color: #64748b;
          font-size: 13px;
          font-weight: 700;
          margin-bottom: 8px;
        }

        .alertKpiValue {
          font-size: 32px;
          font-weight: 900;
          color: var(--text);
        }

        .alertsTopGrid {
          display: grid;
          grid-template-columns: 1.05fr 1fr;
          gap: 24px;
        }

        .alertsFormGrid {
          display: grid;
          grid-template-columns: 1fr 1fr 2fr;
          gap: 16px;
        }

        .alertsActionRow {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          margin-top: 18px;
        }

        .alertsErrorBox {
          margin-top: 12px;
          padding: 10px 12px;
          background: #fef2f2;
          color: #dc2626;
          border: 1px solid #fecaca;
          border-radius: 10px;
          font-size: 13px;
          font-weight: 700;
        }

        .alertsAutoList,
        .incidentLogList,
        .responseStack {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .autoAlertCard {
          border: 1px solid #e2e8f0;
          border-radius: 14px;
          padding: 14px;
          background: #fff;
        }

        .autoAlertHead {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 10px;
          flex-wrap: wrap;
          margin-bottom: 8px;
        }

        .autoAlertTitle {
          font-weight: 900;
          color: var(--text);
        }

        .autoAlertSub {
          color: #64748b;
          font-size: 13px;
          margin-top: 4px;
        }

        .autoAlertMeta {
          color: #475569;
          font-size: 13px;
          line-height: 1.7;
        }

        .alertsFilterGrid {
          display: grid;
          grid-template-columns: minmax(200px, 1fr) 160px 180px;
          gap: 10px;
        }

        .alertsMainGrid {
          margin-top: 24px;
          display: grid;
          grid-template-columns: 1fr 1.2fr;
          gap: 24px;
        }

        .incidentLogCard {
          display: flex;
          flex-direction: column;
          gap: 8px;
          padding: 14px;
          background: #fff;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          cursor: pointer;
          text-align: left;
          transition: all 0.2s ease;
        }

        .incidentLogCard:hover {
          background: #f8fafc;
        }

        .incidentLogCard.selected {
          border: 2px solid #3b82f6;
          background: #f8fbff;
        }

        .incidentLogHead {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
        }

        .incidentLogTitle {
          font-size: 15px;
          font-weight: 900;
          color: var(--text);
        }

        .incidentLogTitle span {
          color: var(--muted);
          font-weight: 700;
        }

        .incidentLogMeta {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          flex-wrap: wrap;
          font-size: 12px;
          color: #64748b;
        }

        .incidentLogDate {
          font-size: 12px;
          color: #64748b;
          font-weight: 700;
        }

        .incidentHero {
          padding: 16px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 14px;
        }

        .incidentHero.high {
          background: #fef2f2;
          border-color: #fecaca;
        }

        .incidentHeroTop {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 14px;
          flex-wrap: wrap;
        }

        .incidentHeroTitle {
          font-size: 20px;
          font-weight: 900;
          color: var(--text);
        }

        .incidentHeroSub {
          font-size: 13px;
          color: var(--muted);
          margin-top: 6px;
        }

        .incidentHeroRight {
          text-align: right;
        }

        .incidentHeroScore {
          margin-top: 8px;
          font-size: 12px;
          color: var(--muted);
          font-weight: 800;
        }

        .workflowCard,
        .pipelineInfoCard,
        .dispatcherNoteCard {
          background: #fff;
          border: 1px solid #e2e8f0;
          border-radius: 14px;
          padding: 16px;
        }

        .workflowTitle {
          font-size: 14px;
          font-weight: 900;
          color: var(--text);
          margin-bottom: 12px;
        }

        .workflowStatusRow {
          display: flex;
          gap: 24px;
          flex-wrap: wrap;
          margin-bottom: 16px;
        }

        .workflowLabel {
          font-size: 12px;
          color: #64748b;
          font-weight: 800;
          margin-bottom: 6px;
        }

        .workflowButtons {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .workflowBtn {
          padding: 8px 12px;
          border-radius: 10px;
          border: none;
          background: #f1f5f9;
          color: #475569;
          font-size: 12px;
          font-weight: 800;
          cursor: pointer;
        }

        .workflowBtn.active {
          background: var(--primary);
          color: white;
        }

        .pipelineInfoGrid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          font-size: 13px;
          background: #f8fafc;
          padding: 12px;
          border-radius: 10px;
        }

        .pipelineInfoGrid span {
          color: #64748b;
        }

        .recommendHead {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
          margin-bottom: 10px;
        }

        .recommendAction {
          font-weight: 900;
          color: var(--text);
        }

        .recommendMessage {
          color: #475569;
          font-size: 13px;
          line-height: 1.7;
          margin-bottom: 12px;
        }

        .recommendReasons {
          margin: 0 0 0 18px;
          padding: 0;
          color: #0f172a;
        }

        .recommendReasons li {
          margin-bottom: 6px;
          line-height: 1.5;
        }

        .dispatcherNoteCard {
          background: #fefce8;
          border-color: #fde68a;
        }

        .dispatcherNoteText {
          font-size: 13px;
          color: #854d0e;
          font-style: italic;
        }

        .responseBottomRow {
          display: flex;
          justify-content: flex-end;
        }

        .deleteIncidentBtn {
          background: #fff;
          border: 1px solid #fecaca;
          color: #dc2626;
          padding: 8px 16px;
          border-radius: 10px;
          font-weight: 800;
          cursor: pointer;
        }

        .actionMatrixCard {
          background: #f0fdf4;
          border: 1px dashed #6ee7b7;
        }

        .actionMatrixList {
          margin-top: 10px;
          display: flex;
          flex-direction: column;
          gap: 8px;
          font-size: 13px;
          color: #064e3b;
          line-height: 1.6;
        }

        .alertsEmptyState {
          padding: 30px 20px;
          text-align: center;
          background: #f8fafc;
          border-radius: 12px;
          border: 1px dashed #cbd5e1;
          color: #64748b;
        }

        .alertsEmptyIcon {
          font-size: 28px;
          margin-bottom: 8px;
        }

        .alertsEmptyTitle {
          font-weight: 900;
          font-size: 16px;
          color: var(--text);
          margin-bottom: 4px;
        }

        .alertsEmptyMessage {
          font-size: 13px;
        }

        @media (max-width: 1100px) {
          .alertsTopGrid,
          .alertsMainGrid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 900px) {
          .alertsFormGrid,
          .alertsFilterGrid,
          .pipelineInfoGrid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}