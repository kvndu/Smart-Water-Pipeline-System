import { useEffect, useMemo, useState } from "react";
import { supabase } from "../utils/supabaseClient";

const LS_LOGS_KEY = "pipeguard_maintenance_logs";
const LS_STATUS_KEY = "pipeguard_maintenance_statuses";
const PAGE_SIZE = 1000;

function num(v) {
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

function getId(p) {
  return p.WATMAINID ?? p.watmainid ?? p.id ?? p.OBJECTID;
}

function getCondition(p) {
  return num(p["Condition Score"] ?? p.CONDITION_SCORE ?? p.condition_score);
}

function getCriticality(p) {
  return num(p.CRITICALITY ?? p.criticality);
}

function getRisk(p) {
  const condition = getCondition(p);
  const criticality = getCriticality(p);

  if (condition !== null) {
    if (condition <= 4) return "HIGH";
    if (condition <= 7) return "MEDIUM";
    return "LOW";
  }

  if (criticality !== null) {
    if (criticality >= 8) return "HIGH";
    if (criticality >= 5) return "MEDIUM";
  }

  return "LOW";
}

function getPriority(p) {
  const risk = getRisk(p);
  const criticality = getCriticality(p) ?? 0;

  if (risk === "HIGH" || criticality >= 8) return "CRITICAL";
  if (risk === "MEDIUM" || criticality >= 5) return "MODERATE";
  return "LOW";
}

function getAction(p) {
  const priority = getPriority(p);

  if (priority === "CRITICAL") return "Immediate inspection required";
  if (priority === "MODERATE") return "Schedule preventive maintenance";
  return "Routine monitoring";
}

function badgeColor(value) {
  if (value === "HIGH" || value === "CRITICAL" || value === "IN_PROGRESS") {
    return "#ef4444";
  }

  if (value === "MEDIUM" || value === "MODERATE" || value === "SCHEDULED") {
    return "#f59e0b";
  }

  if (value === "COMPLETED") return "#22c55e";

  return "#0284c7";
}

function loadJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) || fallback;
  } catch {
    return fallback;
  }
}

async function fetchAllPipelines() {
  let allRows = [];
  let from = 0;

  while (true) {
    const to = from + PAGE_SIZE - 1;

    const { data, error } = await supabase
      .from("pipelines")
      .select("*")
      .range(from, to);

    if (error) throw error;

    const rows = data || [];
    allRows = [...allRows, ...rows];

    if (rows.length < PAGE_SIZE) break;

    from += PAGE_SIZE;
  }

  return allRows;
}

export default function Maintenance() {
  const [pipelines, setPipelines] = useState([]);
  const [logs, setLogs] = useState(() => loadJson(LS_LOGS_KEY, []));
  const [statusMap, setStatusMap] = useState(() => loadJson(LS_STATUS_KEY, {}));
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [search, setSearch] = useState("");
  const [riskFilter, setRiskFilter] = useState("ALL");
  const [priorityFilter, setPriorityFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const [activeTask, setActiveTask] = useState(null);
  const [repairType, setRepairType] = useState("Leak repaired and section reinforced");
  const [repairCost, setRepairCost] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        setLoadError("");

        const rows = await fetchAllPipelines();
        setPipelines(rows);
      } catch (error) {
        console.error("Maintenance fetch error:", error);
        setLoadError(error.message || "Failed to load maintenance data.");
        setPipelines([]);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  useEffect(() => {
    localStorage.setItem(LS_LOGS_KEY, JSON.stringify(logs));
  }, [logs]);

  useEffect(() => {
    localStorage.setItem(LS_STATUS_KEY, JSON.stringify(statusMap));
  }, [statusMap]);

  const enrichedPipelines = useMemo(() => {
    return pipelines.map((p) => {
      const id = String(getId(p));
      const completed = logs.find((log) => String(log.watmainid) === id);

      return {
        ...p,
        risk: getRisk(p),
        priority: getPriority(p),
        action: getAction(p),
        maintenance_status: completed
          ? "COMPLETED"
          : statusMap[id] || p.maintenance_status || "PENDING",
      };
    });
  }, [pipelines, logs, statusMap]);

  const filtered = useMemo(() => {
    return enrichedPipelines.filter((p) => {
      const q = search.toLowerCase();
      const watmainid = String(p.WATMAINID ?? "").toLowerCase();
      const material = String(p.MATERIAL ?? "").toLowerCase();
      const pipeSize = String(p.PIPE_SIZE ?? p.MAP_LABEL ?? "").toLowerCase();
      const zone = String(p.PRESSURE_ZONE ?? "").toLowerCase();

      const matchSearch =
        !q ||
        watmainid.includes(q) ||
        material.includes(q) ||
        pipeSize.includes(q) ||
        zone.includes(q);

      const matchRisk = riskFilter === "ALL" || p.risk === riskFilter;
      const matchPriority = priorityFilter === "ALL" || p.priority === priorityFilter;
      const matchStatus = statusFilter === "ALL" || p.maintenance_status === statusFilter;

      return matchSearch && matchRisk && matchPriority && matchStatus;
    });
  }, [enrichedPipelines, search, riskFilter, priorityFilter, statusFilter]);

  const stats = useMemo(() => {
    return {
      total: enrichedPipelines.length,
      critical: enrichedPipelines.filter((p) => p.priority === "CRITICAL").length,
      moderate: enrichedPipelines.filter((p) => p.priority === "MODERATE").length,
      pending: enrichedPipelines.filter((p) => p.maintenance_status === "PENDING").length,
      scheduled: enrichedPipelines.filter((p) => p.maintenance_status === "SCHEDULED").length,
      inProgress: enrichedPipelines.filter((p) => p.maintenance_status === "IN_PROGRESS").length,
      completed: enrichedPipelines.filter((p) => p.maintenance_status === "COMPLETED").length,
      cost: logs.reduce((sum, l) => sum + Number(l.cost || 0), 0),
    };
  }, [enrichedPipelines, logs]);

  function updateStatus(watmainid, status) {
    const id = String(watmainid);

    setStatusMap((prev) => ({
      ...prev,
      [id]: status,
    }));
  }

  function completeRepair(p) {
    if (!repairCost || Number(repairCost) < 0) {
      alert("Please enter repair cost.");
      return;
    }

    const id = getId(p);
    const condition = getCondition(p);
    const newCondition =
      condition !== null ? Math.min(10, condition + 2).toFixed(2) : "Improved";

    const log = {
      id: `LOG-${Date.now()}`,
      watmainid: id,
      objectId: p.OBJECTID,
      material: p.MATERIAL,
      pipeSize: p.PIPE_SIZE || p.MAP_LABEL,
      zone: p.PRESSURE_ZONE,
      oldRisk: p.risk,
      newRisk: condition !== null && condition + 2 > 7 ? "LOW" : p.risk,
      oldCondition: condition ?? "N/A",
      newCondition,
      repairType,
      cost: Number(repairCost),
      note,
      completedAt: new Date().toLocaleString(),
    };

    setLogs((prev) => [log, ...prev]);
    updateStatus(id, "COMPLETED");
    setActiveTask(null);
    setRepairCost("");
    setNote("");
  }

  if (loading) {
    return <div className="maintenancePage">Loading all maintenance data...</div>;
  }

  if (loadError) {
    return (
      <div className="maintenancePage">
        <div className="panel">
          <h2>Could not load maintenance data</h2>
          <p>{loadError}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="maintenancePage">
      <div className="hero">
        <div>
          <div className="eyebrow">Maintenance Operations</div>
          <h1>Pipeline Maintenance Center</h1>
        </div>

        <div className="heroBadges">
          <span>{stats.total.toLocaleString()} assets</span>
          <span>{stats.critical.toLocaleString()} critical</span>
          <span>{stats.completed.toLocaleString()} completed</span>
        </div>
      </div>

      <div className="kpiGrid">
        <Kpi title="Total Assets" value={stats.total.toLocaleString()} />
        <Kpi title="Critical Tasks" value={stats.critical.toLocaleString()} color="#ef4444" />
        <Kpi title="Moderate Tasks" value={stats.moderate.toLocaleString()} color="#f59e0b" />
        <Kpi title="Scheduled" value={stats.scheduled.toLocaleString()} color="#2563eb" />
        <Kpi title="In Progress" value={stats.inProgress.toLocaleString()} color="#dc2626" />
        <Kpi title="Total Cost" value={`Rs. ${stats.cost.toLocaleString()}`} color="#16a34a" />
      </div>

      <div className="panel">
        <div className="panelHead">
          <div>
            <h2>Maintenance Scheduler</h2>
            <p>Search, filter and manage maintenance workflow.</p>
          </div>
        </div>

        <div className="filters">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search WATMAINID, material, size, pressure zone..."
          />

          <select value={riskFilter} onChange={(e) => setRiskFilter(e.target.value)}>
            <option value="ALL">All Risk</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>

          <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)}>
            <option value="ALL">All Priority</option>
            <option value="CRITICAL">Critical</option>
            <option value="MODERATE">Moderate</option>
            <option value="LOW">Low</option>
          </select>

          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="ALL">All Status</option>
            <option value="PENDING">Pending</option>
            <option value="SCHEDULED">Scheduled</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="COMPLETED">Completed</option>
          </select>
        </div>

        <div className="smallText">
          Showing {filtered.length.toLocaleString()} of{" "}
          {enrichedPipelines.length.toLocaleString()} pipelines.
        </div>

        <div className="tableWrap">
          <table>
            <thead>
              <tr>
                <th>WATMAINID</th>
                <th>Material</th>
                <th>Pipe Size</th>
                <th>Pressure Zone</th>
                <th>Condition</th>
                <th>Criticality</th>
                <th>Risk</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Recommended Action</th>
                <th>Workflow</th>
              </tr>
            </thead>

            <tbody>
              {filtered.map((p, index) => {
                const id = getId(p);

                return (
                  <tr key={`${p.OBJECTID || id}-${index}`}>
                    <td className="strong">{p.WATMAINID || "N/A"}</td>
                    <td>{p.MATERIAL || "N/A"}</td>
                    <td>{p.PIPE_SIZE || p.MAP_LABEL || "N/A"}</td>
                    <td>{p.PRESSURE_ZONE || "N/A"}</td>
                    <td>{getCondition(p) ?? "N/A"}</td>
                    <td>{getCriticality(p) ?? "N/A"}</td>
                    <td>
                      <Badge value={p.risk} />
                    </td>
                    <td>
                      <Badge value={p.priority} />
                    </td>
                    <td>
                      <Badge value={p.maintenance_status} />
                    </td>
                    <td>{p.action}</td>
                    <td>
                      {String(activeTask) === String(id) ? (
                        <div className="repairBox">
                          <select
                            value={repairType}
                            onChange={(e) => setRepairType(e.target.value)}
                          >
                            <option>Leak repaired and section reinforced</option>
                            <option>Pipe joint repaired</option>
                            <option>Valve section restored</option>
                            <option>Pipe section replaced</option>
                            <option>Crack sealed and reinforced</option>
                          </select>

                          <input
                            type="number"
                            value={repairCost}
                            onChange={(e) => setRepairCost(e.target.value)}
                            placeholder="Repair cost"
                          />

                          <input
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            placeholder="Maintenance note"
                          />

                          <div className="btnRow">
                            <button onClick={() => completeRepair(p)}>Save Repair</button>
                            <button className="ghost" onClick={() => setActiveTask(null)}>
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="btnRow">
                          <button
                            onClick={() => updateStatus(id, "SCHEDULED")}
                            disabled={p.maintenance_status !== "PENDING"}
                          >
                            Schedule
                          </button>
                          <button
                            className="ghost"
                            onClick={() => updateStatus(id, "IN_PROGRESS")}
                            disabled={p.maintenance_status !== "SCHEDULED"}
                          >
                            Start
                          </button>
                          <button
                            className="ghost"
                            onClick={() => setActiveTask(id)}
                            disabled={p.maintenance_status !== "IN_PROGRESS"}
                          >
                            Complete
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel logsPanel">
        <div className="panelHead">
          <div>
            <h2>Maintenance Logs</h2>
            <p>Completed maintenance history with before/after risk summary.</p>
          </div>
        </div>

        {logs.length === 0 ? (
          <div className="empty">No completed maintenance logs yet.</div>
        ) : (
          <div className="logsGrid">
            {logs.map((log) => (
              <div key={log.id} className="logCard">
                <div className="logTop">
                  <strong>{log.id}</strong>
                  <span>{log.completedAt}</span>
                </div>
                <h3>Pipeline #{log.watmainid}</h3>
                <p>
                  {log.material} • {log.pipeSize} • {log.zone}
                </p>
                <div className="logInfo">
                  <div>Repair: {log.repairType}</div>
                  <div>
                    Risk: {log.oldRisk} → {log.newRisk}
                  </div>
                  <div>
                    Condition: {log.oldCondition} → {log.newCondition}
                  </div>
                  <div>Cost: Rs. {Number(log.cost || 0).toLocaleString()}</div>
                  {log.note && <div>Note: {log.note}</div>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <style>{`
        .maintenancePage {
          padding: 28px;
          animation: fadeIn 0.35s ease;
        }

        .hero {
          background: linear-gradient(135deg, #ffffff, #eff6ff);
          border: 1px solid #e2e8f0;
          border-radius: 24px;
          padding: 28px;
          display: flex;
          justify-content: space-between;
          gap: 20px;
          align-items: flex-start;
          margin-bottom: 22px;
          box-shadow: 0 18px 45px rgba(15,23,42,0.08);
        }

        .eyebrow {
          display: inline-block;
          background: #dbeafe;
          color: #2563eb;
          font-weight: 900;
          font-size: 12px;
          letter-spacing: 1px;
          padding: 7px 12px;
          border-radius: 999px;
          text-transform: uppercase;
          margin-bottom: 10px;
        }

        .hero h1 {
          margin: 0;
          font-size: 30px;
          color: #0f172a;
        }

        .heroBadges {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        .heroBadges span {
          background: #fff;
          border: 1px solid #e2e8f0;
          border-radius: 999px;
          padding: 8px 12px;
          font-size: 12px;
          font-weight: 900;
          color: #0f172a;
        }

        .kpiGrid {
          display: grid;
          grid-template-columns: repeat(6, 1fr);
          gap: 16px;
          margin-bottom: 22px;
        }

        .kpi {
          background: #fff;
          border: 1px solid #e2e8f0;
          border-radius: 18px;
          padding: 18px;
          box-shadow: 0 10px 25px rgba(15,23,42,0.05);
        }

        .kpiTitle {
          color: #64748b;
          font-size: 13px;
          font-weight: 800;
        }

        .kpiValue {
          margin-top: 8px;
          font-size: 30px;
          font-weight: 950;
        }

        .panel {
          background: #fff;
          border: 1px solid #e2e8f0;
          border-radius: 22px;
          padding: 20px;
          box-shadow: 0 18px 45px rgba(15,23,42,0.07);
          margin-bottom: 22px;
        }

        .panelHead h2 {
          margin: 0;
          font-size: 22px;
          color: #0f172a;
        }

        .panelHead p {
          margin: 6px 0 16px;
          color: #64748b;
          font-size: 14px;
        }

        .filters {
          display: grid;
          grid-template-columns: 1fr 160px 180px 180px;
          gap: 12px;
          margin-bottom: 12px;
        }

        input, select {
          height: 42px;
          border: 1px solid #cbd5e1;
          border-radius: 12px;
          padding: 0 12px;
          font-weight: 700;
          background: #fff;
          color: #0f172a;
        }

        .smallText {
          color: #64748b;
          font-size: 13px;
          font-weight: 800;
          margin-bottom: 14px;
        }

        .tableWrap {
          overflow-x: auto;
          max-height: 620px;
          overflow-y: auto;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          min-width: 1250px;
        }

        th {
          text-align: left;
          color: #475569;
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: .4px;
          padding: 12px;
          border-bottom: 1px solid #e2e8f0;
          background: #f8fafc;
          position: sticky;
          top: 0;
          z-index: 2;
        }

        td {
          padding: 12px;
          border-bottom: 1px solid #e2e8f0;
          font-size: 13px;
          color: #0f172a;
          vertical-align: top;
        }

        .strong {
          font-weight: 950;
          color: #2563eb;
        }

        .badge {
          color: #fff;
          padding: 6px 10px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 950;
          display: inline-block;
          white-space: nowrap;
        }

        .btnRow {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        button {
          border: none;
          background: #2563eb;
          color: #fff;
          border-radius: 10px;
          padding: 8px 12px;
          font-weight: 900;
          cursor: pointer;
        }

        button:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        button.ghost {
          background: #f1f5f9;
          color: #0f172a;
        }

        .repairBox {
          display: grid;
          gap: 8px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 14px;
          padding: 10px;
          min-width: 250px;
        }

        .logsGrid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 14px;
        }

        .logCard {
          border: 1px solid #e2e8f0;
          border-radius: 16px;
          padding: 16px;
          background: #fff;
        }

        .logTop {
          display: flex;
          justify-content: space-between;
          color: #64748b;
          font-size: 12px;
          gap: 10px;
        }

        .logCard h3 {
          margin: 10px 0 4px;
          color: #0f172a;
        }

        .logCard p {
          margin: 0 0 10px;
          color: #64748b;
          font-size: 13px;
        }

        .logInfo {
          display: grid;
          gap: 6px;
          font-size: 13px;
          color: #334155;
        }

        .empty {
          padding: 30px;
          text-align: center;
          color: #64748b;
          background: #f8fafc;
          border: 1px dashed #cbd5e1;
          border-radius: 14px;
          font-weight: 800;
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(5px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @media (max-width: 1200px) {
          .kpiGrid,
          .filters {
            grid-template-columns: 1fr 1fr;
          }
        }

        @media (max-width: 700px) {
          .hero,
          .filters,
          .kpiGrid {
            grid-template-columns: 1fr;
            display: grid;
          }
        }
      `}</style>
    </div>
  );
}

function Kpi({ title, value, color = "#0f172a" }) {
  return (
    <div className="kpi">
      <div className="kpiTitle">{title}</div>
      <div className="kpiValue" style={{ color }}>
        {value}
      </div>
    </div>
  );
}

function Badge({ value }) {
  return (
    <span className="badge" style={{ background: badgeColor(value) }}>
      {value}
    </span>
  );
}