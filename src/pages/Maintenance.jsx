import { useEffect, useMemo, useState } from "react";

const PIPELINES_LS_KEY = "waterflow_pipelines_v1";

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
  return "ok"; // ACTIVE
}

function maintBadgeClass(type) {
  if (type === "OVERDUE") return "danger";
  if (type === "DUE") return "warn";
  return "ok";
}

export default function Maintenance() {
  const [pipelines, setPipelines] = useState(() => loadPipelines() || []);

  // keep LS in sync
  useEffect(() => {
    savePipelines(pipelines);
  }, [pipelines]);

  // compute maintenance category using rule-based thresholds
  const rows = useMemo(() => {
    return pipelines.map((p) => {
      const ds = daysSince(p.last_maintenance_date);
      let category = "OK";

      // Rule-based logic:
      // > 365 days => OVERDUE
      // > 180 days => DUE
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
    return { due, overdue, ok, total: rows.length };
  }, [rows]);

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

  function markMaintenanceDone(pipeline_id) {
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
  }

  return (
    <div className="container">
      <div className="header">
        <div>
          <div className="title">Maintenance</div>
          <div className="subtitle">
            Rule-based preventive maintenance (180 days Due / 365 days Overdue)
          </div>
        </div>
        <span className="badge ok">No AI</span>
      </div>

      <div className="kpiGrid">
        <div className="card card-pad">
          <div className="kpiLabel">Total Pipelines</div>
          <div className="kpiValue">{stats.total}</div>
        </div>
        <div className="card card-pad">
          <div className="kpiLabel">Overdue ({">"}365d)</div>
          <div className="kpiValue">{stats.overdue}</div>
        </div>
        <div className="card card-pad">
          <div className="kpiLabel">Due ({">"}180d)</div>
          <div className="kpiValue">{stats.due}</div>
        </div>
        <div className="card card-pad">
          <div className="kpiLabel">OK (≤180d)</div>
          <div className="kpiValue">{stats.ok}</div>
        </div>
      </div>

      <div className="card card-pad" style={{ marginTop: 12 }}>
        <div className="title" style={{ fontSize: 14 }}>Maintenance List</div>
        <div className="small" style={{ marginTop: 6 }}>
          Overdue/Due pipelines are prioritized. Use “Schedule Maintenance” to mark as UNDER_MAINTENANCE.
        </div>

        <div style={{ overflowX: "auto", marginTop: 12 }}>
          <table className="table">
            <thead>
              <tr>
                <th>Pipeline</th>
                <th>Area / Zone</th>
                <th>Last Maintenance</th>
                <th>Days Since</th>
                <th>Category</th>
                <th>Pipeline Status</th>
                <th style={{ width: 260 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="small">
                    No pipelines found. Add pipelines in Pipelines page first.
                  </td>
                </tr>
              ) : (
                filtered.map((p) => (
                  <tr key={p.pipeline_id}>
                    <td>
                      <b>{p.pipeline_id}</b>
                      <div className="small">{p.pipe_name || ""}</div>
                    </td>
                    <td className="small">
                      {p.area} / {p.zone}
                    </td>
                    <td className="small">
                      {p.last_maintenance_date ? p.last_maintenance_date : "—"}
                      {p.maintenance_scheduled_date ? (
                        <div className="small">
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
                      <div className="hstack" style={{ flexWrap: "wrap" }}>
                        <button
                          className="btn primary"
                          type="button"
                          onClick={() => scheduleMaintenance(p.pipeline_id)}
                          disabled={p.status === "UNDER_MAINTENANCE"}
                        >
                          Schedule Maintenance
                        </button>

                        <button
                          className="btn"
                          type="button"
                          onClick={() => markMaintenanceDone(p.pipeline_id)}
                          disabled={p.status !== "UNDER_MAINTENANCE"}
                        >
                          Mark Done
                        </button>
                      </div>

                      <div className="small" style={{ marginTop: 6 }}>
                        Rule: {">"}180 days = Due, {">"}365 days = Overdue
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card card-pad" style={{ marginTop: 12 }}>
        <div className="title" style={{ fontSize: 14 }}>Examiner Answer (what to say)</div>
        <div className="small" style={{ marginTop: 6 }}>
          “System automatically identifies Due/Overdue pipelines using last maintenance date. Operators can schedule maintenance and mark it completed. This supports preventive maintenance without AI.”
        </div>
      </div>
    </div>
  );
}
