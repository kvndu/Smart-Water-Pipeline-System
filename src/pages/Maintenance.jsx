import { useEffect, useMemo, useState } from "react";

const PIPELINES_LS_KEY = "waterflow_pipelines_v1";
const LOGS_LS_KEY = "waterflow_maint_logs_v1";

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

function loadLogs() {
  try {
    const raw = localStorage.getItem(LOGS_LS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveLogs(list) {
  localStorage.setItem(LOGS_LS_KEY, JSON.stringify(list));
}

function statusBadgeClass(status) {
  if (status === "UNDER_REPAIR") return "danger";
  if (status === "UNDER_MAINTENANCE") return "warn";
  if (status === "INACTIVE") return "";
  return "ok"; // ACTIVE
}

function maintBadgeClass(type) {
  if (type === "OVERDUE") return "danger";
  if (type === "DUE") return "warn";
  return "ok";
}

export default function Maintenance() {
  const [pipelines, setPipelines] = useState(() => loadPipelines() || []);
  const [logs, setLogs] = useState(() => loadLogs());
  const [activeTab, setActiveTab] = useState("scheduler"); // "scheduler" | "logs"

  // State for the "Mark Done" inline form
  const [completingId, setCompletingId] = useState(null);
  const [repairDesc, setRepairDesc] = useState("");
  const [repairCost, setRepairCost] = useState("");

  // keep LS in sync
  useEffect(() => {
    savePipelines(pipelines);
  }, [pipelines]);

  useEffect(() => {
    saveLogs(logs);
  }, [logs]);

  // compute maintenance category using rule-based thresholds
  const rows = useMemo(() => {
    return pipelines.map((p) => {
      const ds = daysSince(p.last_maintenance_date);
      let category = "OK";

      if (ds === null) category = "DUE"; // no date -> treat as due (safer)
      else if (ds > 365) category = "OVERDUE";
      else if (ds > 180) category = "DUE";

      return { ...p, days_since: ds, maintenance_category: category };
    });
  }, [pipelines]);

  const stats = useMemo(() => {
    const due = rows.filter((r) => r.maintenance_category === "DUE").length;
    const overdue = rows.filter((r) => r.maintenance_category === "OVERDUE").length;
    const ok = rows.filter((r) => r.maintenance_category === "OK").length;
    const totalCost = logs.reduce((sum, log) => sum + (parseFloat(log.cost) || 0), 0);
    return { due, overdue, ok, total: rows.length, totalCost };
  }, [rows, logs]);

  const filtered = useMemo(() => {
    // show Due + Overdue first, then others
    const rank = { OVERDUE: 0, DUE: 1, OK: 2 };
    return [...rows].sort((a, b) => rank[a.maintenance_category] - rank[b.maintenance_category]);
  }, [rows]);

  function scheduleMaintenance(pipeline_id) {
    setPipelines((prev) =>
      prev.map((p) => {
        if (p.pipeline_id !== pipeline_id) return p;

        return {
          ...p,
          status: "UNDER_MAINTENANCE",
          maintenance_scheduled_date: todayISO(),
        };
      })
    );
  }

  function startMarkDone(pipeline_id) {
    setCompletingId(pipeline_id);
    setRepairDesc("");
    setRepairCost("");
  }

  function cancelMarkDone() {
    setCompletingId(null);
  }

  function submitMarkDone(pipeline_id) {
    if (!repairDesc.trim() || !repairCost.trim()) {
      alert("Please enter both repair description and cost.");
      return;
    }

    const costNum = parseFloat(repairCost);
    if (isNaN(costNum) || costNum < 0) {
      alert("Please enter a valid cost.");
      return;
    }

    // Add to logs
    const newLog = {
      id: "LOG-" + Date.now(),
      pipeline_id,
      date: todayISO(),
      description: repairDesc,
      cost: costNum
    };

    setLogs((prev) => [newLog, ...prev]);

    // Update pipeline status
    setPipelines((prev) =>
      prev.map((p) => {
        if (p.pipeline_id !== pipeline_id) return p;

        return {
          ...p,
          status: "ACTIVE",
          last_maintenance_date: todayISO(),
          maintenance_scheduled_date: "",
        };
      })
    );

    setCompletingId(null);
  }

  return (
    <div className="container">
      <div className="header" style={{ marginBottom: "24px" }}>
        <div>
          <div className="title" style={{ fontSize: "24px" }}>Maintenance & Operations</div>
          <div className="subtitle" style={{ fontSize: "14px" }}>
            Track repairs, costs, and schedule future pipeline maintenance.
          </div>
        </div>
      </div>

      <div className="kpiGrid">
        <div className="card card-pad" style={{ background: "linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)" }}>
          <div className="kpiLabel">Total Pipelines</div>
          <div className="kpiValue">{stats.total}</div>
        </div>
        <div className="card card-pad" style={{ background: "linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)" }}>
          <div className="kpiLabel">Overdue ({">"}365d)</div>
          <div className="kpiValue" style={{ color: stats.overdue > 0 ? "var(--danger)" : "inherit" }}>
            {stats.overdue}
          </div>
        </div>
        <div className="card card-pad" style={{ background: "linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)" }}>
          <div className="kpiLabel">Due ({">"}180d)</div>
          <div className="kpiValue" style={{ color: stats.due > 0 ? "var(--warning)" : "inherit" }}>
            {stats.due}
          </div>
        </div>
        <div className="card card-pad" style={{ background: "linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)", borderColor: "#a7f3d0" }}>
          <div className="kpiLabel" style={{ color: "#065f46" }}>Total Maintenance Cost</div>
          <div className="kpiValue" style={{ color: "#064e3b" }}>
            ${stats.totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>
      </div>

      {/* TABS */}
      <div style={{ display: "flex", gap: "10px", marginTop: "24px", marginBottom: "16px", borderBottom: "2px solid var(--border)", paddingBottom: "10px" }}>
        <button
          className="btn"
          style={{
            background: activeTab === "scheduler" ? "var(--primary)" : "transparent",
            color: activeTab === "scheduler" ? "#fff" : "var(--text)",
            borderColor: activeTab === "scheduler" ? "var(--primary)" : "transparent",
            fontWeight: 800,
            borderRadius: "8px"
          }}
          onClick={() => setActiveTab("scheduler")}
        >
          Maintenance Scheduler
        </button>
        <button
          className="btn"
          style={{
            background: activeTab === "logs" ? "var(--primary)" : "transparent",
            color: activeTab === "logs" ? "#fff" : "var(--text)",
            borderColor: activeTab === "logs" ? "var(--primary)" : "transparent",
            fontWeight: 800,
            borderRadius: "8px"
          }}
          onClick={() => setActiveTab("logs")}
        >
          Maintenance Logs
        </button>
      </div>

      {activeTab === "scheduler" && (
        <div className="card card-pad" style={{ animation: "fadeIn 0.3s ease-in-out" }}>
          <div className="title" style={{ fontSize: 16 }}>Maintenance Scheduler</div>
          <div className="small" style={{ marginTop: 6, marginBottom: 16 }}>
            Overdue/Due pipelines are prioritized. Use “Schedule Maintenance” to mark as UNDER_MAINTENANCE.
          </div>

          <div style={{ overflowX: "auto" }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Pipeline</th>
                  <th>Area / Zone</th>
                  <th>Last Maintenance</th>
                  <th>Days Since</th>
                  <th>Category</th>
                  <th>Pipeline Status</th>
                  <th style={{ width: 300 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="small" style={{ textAlign: "center", padding: "20px" }}>
                      No pipelines found. Add pipelines in Pipelines page first.
                    </td>
                  </tr>
                ) : (
                  filtered.map((p) => (
                    <tr key={p.pipeline_id} style={{ transition: "background 0.2s" }}>
                      <td>
                        <b style={{ color: "var(--primary)" }}>{p.pipeline_id}</b>
                        <div className="small">{p.pipe_name || ""}</div>
                      </td>
                      <td className="small">
                        {p.area} / {p.zone}
                      </td>
                      <td className="small">
                        {p.last_maintenance_date ? p.last_maintenance_date : "—"}
                        {p.maintenance_scheduled_date ? (
                          <div className="small" style={{ marginTop: 4 }}>
                            Scheduled: <b>{p.maintenance_scheduled_date}</b>
                          </div>
                        ) : null}
                      </td>
                      <td className="small">
                        {p.days_since === null ? "—" : `${p.days_since} days`}
                      </td>
                      <td>
                        <span className={`badge ${maintBadgeClass(p.maintenance_category)}`}>
                          {p.maintenance_category}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${statusBadgeClass(p.status)}`}>
                          {p.status || "ACTIVE"}
                        </span>
                      </td>
                      <td>
                        {completingId === p.pipeline_id ? (
                          <div className="vstack" style={{ background: "#f8fafc", padding: "10px", borderRadius: "8px", border: "1px solid var(--border)" }}>
                            <div style={{ fontSize: "12px", fontWeight: "bold" }}>Complete Maintenance</div>
                            <input
                              type="text"
                              className="input"
                              placeholder="Repair Description (e.g., Replaced valve)"
                              style={{ padding: "8px", fontSize: "12px" }}
                              value={repairDesc}
                              onChange={(e) => setRepairDesc(e.target.value)}
                            />
                            <div className="hstack">
                              <span style={{ fontSize: "14px", fontWeight: "bold", color: "var(--muted)" }}>$</span>
                              <input
                                type="number"
                                className="input"
                                placeholder="Cost (e.g., 500)"
                                style={{ padding: "8px", fontSize: "12px" }}
                                value={repairCost}
                                onChange={(e) => setRepairCost(e.target.value)}
                              />
                            </div>
                            <div className="hstack" style={{ marginTop: "4px" }}>
                              <button className="btn primary" style={{ padding: "6px 12px", fontSize: "12px" }} onClick={() => submitMarkDone(p.pipeline_id)}>Submit</button>
                              <button className="btn" style={{ padding: "6px 12px", fontSize: "12px" }} onClick={cancelMarkDone}>Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <div className="hstack" style={{ flexWrap: "wrap", gap: "8px" }}>
                            <button
                              className="btn primary"
                              style={{ padding: "8px 12px", fontSize: "12px", transition: "transform 0.1s" }}
                              onMouseDown={e => e.currentTarget.style.transform = 'scale(0.95)'}
                              onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
                              onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                              type="button"
                              onClick={() => scheduleMaintenance(p.pipeline_id)}
                              disabled={p.status === "UNDER_MAINTENANCE"}
                            >
                              Schedule
                            </button>

                            <button
                              className="btn"
                              style={{ padding: "8px 12px", fontSize: "12px", transition: "transform 0.1s" }}
                              onMouseDown={e => e.currentTarget.style.transform = 'scale(0.95)'}
                              onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
                              onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                              type="button"
                              onClick={() => startMarkDone(p.pipeline_id)}
                              disabled={p.status !== "UNDER_MAINTENANCE"}
                            >
                              Mark Done
                            </button>
                          </div>
                        )}
                        <div className="small" style={{ marginTop: 8, fontSize: "10px" }}>
                          Rule: {">"}180d = Due, {">"}365d = Overdue
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "logs" && (
        <div className="card card-pad" style={{ animation: "fadeIn 0.3s ease-in-out" }}>
          <div className="title" style={{ fontSize: 16 }}>Maintenance Logs</div>
          <div className="small" style={{ marginTop: 6, marginBottom: 16 }}>
            A historical record of all repairs performed, including descriptive logs and costs incurred.
          </div>

          <div style={{ overflowX: "auto" }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Log ID</th>
                  <th>Pipeline ID</th>
                  <th>Date Completed</th>
                  <th>Repair Description</th>
                  <th>Cost Incurred</th>
                </tr>
              </thead>
              <tbody>
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="small" style={{ textAlign: "center", padding: "30px" }}>
                      No maintenance logs found. Complete a scheduled maintenance to generate logs.
                    </td>
                  </tr>
                ) : (
                  logs.map(log => (
                    <tr key={log.id}>
                      <td style={{ fontWeight: 600, color: "var(--muted)", fontSize: "12px" }}>{log.id}</td>
                      <td><b style={{ color: "var(--primary)" }}>{log.pipeline_id}</b></td>
                      <td>{log.date}</td>
                      <td style={{ maxWidth: "300px" }}>
                        <div style={{
                          padding: "6px 10px",
                          background: "#f1f5f9",
                          borderRadius: "6px",
                          fontSize: "13px"
                        }}>
                          {log.description}
                        </div>
                      </td>
                      <td style={{ fontWeight: 800, color: "#065f46" }}>
                        ${Number(log.cost).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(5px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
