import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../utils/api.js";

function riskBadgeClass(level) {
  if (level === "High") return "danger";
  if (level === "Medium") return "warn";
  return "ok";
}

function priorityBadgeClass(priority) {
  if (priority === "Critical") return "danger";
  if (priority === "Moderate") return "warn";
  return "ok";
}

function statusBadgeClass(status) {
  if (status === "IN_PROGRESS") return "danger";
  if (status === "SCHEDULED") return "warn";
  if (status === "PENDING") return "warn";
  if (status === "COMPLETED") return "ok";
  return "ok";
}

function getPriorityScore(p) {
  const riskWeight = p.risk_level === "High" ? 3 : p.risk_level === "Medium" ? 2 : 1;
  const leakWeight = Number(p.previous_leak_count || 0);
  const ageWeight = new Date().getFullYear() - Number(p.install_year || new Date().getFullYear());
  return riskWeight * 100 + leakWeight * 10 + ageWeight;
}

function initialStatusFromPipeline(p) {
  if (p.risk_level === "High") return "PENDING";
  if (p.risk_level === "Medium") return "PENDING";
  return "COMPLETED";
}

export default function Maintenance() {
  const [pipelines, setPipelines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("scheduler");

  const [logs, setLogs] = useState([]);
  const [completingId, setCompletingId] = useState(null);
  const [repairDesc, setRepairDesc] = useState("");
  const [repairCost, setRepairCost] = useState("");

  const [search, setSearch] = useState("");
  const [riskFilter, setRiskFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [priorityFilter, setPriorityFilter] = useState("ALL");

  useEffect(() => {
    async function fetchPipelines() {
      try {
        setLoading(true);
        const res = await api.get("/pipelines-with-risk?limit=2000");
        const data = Array.isArray(res.data) ? res.data : [];

        const enriched = data.map((p) => ({
          ...p,
          maintenance_status: initialStatusFromPipeline(p),
          maintenance_scheduled_date: "",
          maintenance_started_date: "",
          maintenance_completed_date: "",
        }));

        setPipelines(enriched);
      } catch (err) {
        console.error("Maintenance fetch error:", err);
        setPipelines([]);
      } finally {
        setLoading(false);
      }
    }

    fetchPipelines();
  }, []);

  const stats = useMemo(() => {
    const total = pipelines.length;
    const critical = pipelines.filter((p) => p.recommendation?.priority === "Critical").length;
    const moderate = pipelines.filter((p) => p.recommendation?.priority === "Moderate").length;
    const low = pipelines.filter((p) => (p.recommendation?.priority || "Low") === "Low").length;
    const scheduled = pipelines.filter((p) => p.maintenance_status === "SCHEDULED").length;
    const inProgress = pipelines.filter((p) => p.maintenance_status === "IN_PROGRESS").length;
    const completed = pipelines.filter((p) => p.maintenance_status === "COMPLETED").length;
    const totalCost = logs.reduce((sum, log) => sum + (parseFloat(log.cost) || 0), 0);

    return {
      total,
      critical,
      moderate,
      low,
      scheduled,
      inProgress,
      completed,
      totalCost,
    };
  }, [pipelines, logs]);

  const prioritized = useMemo(() => {
    return [...pipelines].sort((a, b) => getPriorityScore(b) - getPriorityScore(a));
  }, [pipelines]);

  const filteredPipelines = useMemo(() => {
    return prioritized.filter((p) => {
      const matchesSearch =
        !search.trim() ||
        String(p.pipeline_id).toLowerCase().includes(search.toLowerCase()) ||
        String(p.area_name || "").toLowerCase().includes(search.toLowerCase()) ||
        String(p.ds_division || "").toLowerCase().includes(search.toLowerCase()) ||
        String(p.material_type || "").toLowerCase().includes(search.toLowerCase());

      const matchesRisk = riskFilter === "ALL" || p.risk_level === riskFilter;
      const matchesStatus =
        statusFilter === "ALL" || p.maintenance_status === statusFilter;
      const matchesPriority =
        priorityFilter === "ALL" ||
        (p.recommendation?.priority || "Low") === priorityFilter;

      return matchesSearch && matchesRisk && matchesStatus && matchesPriority;
    });
  }, [prioritized, search, riskFilter, statusFilter, priorityFilter]);

  const topRepairCandidates = useMemo(() => prioritized.slice(0, 10), [prioritized]);

  function scheduleMaintenance(pipeline_id) {
    setPipelines((prev) =>
      prev.map((p) =>
        p.pipeline_id === pipeline_id
          ? {
              ...p,
              maintenance_status: "SCHEDULED",
              maintenance_scheduled_date: new Date().toISOString().slice(0, 10),
            }
          : p
      )
    );
  }

  function startMaintenance(pipeline_id) {
    setPipelines((prev) =>
      prev.map((p) =>
        p.pipeline_id === pipeline_id
          ? {
              ...p,
              maintenance_status: "IN_PROGRESS",
              maintenance_started_date: new Date().toISOString().slice(0, 10),
            }
          : p
      )
    );
  }

  function startMarkDone(pipeline_id) {
    setCompletingId(pipeline_id);
    setRepairDesc("");
    setRepairCost("");
  }

  function cancelMarkDone() {
    setCompletingId(null);
    setRepairDesc("");
    setRepairCost("");
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

    const target = pipelines.find((p) => p.pipeline_id === pipeline_id);

    const newLog = {
      id: `LOG-${Date.now()}`,
      pipeline_id,
      date: new Date().toISOString().slice(0, 10),
      description: repairDesc,
      cost: costNum,
      area_name: target?.area_name || "-",
      ds_division: target?.ds_division || "-",
    };

    setLogs((prev) => [newLog, ...prev]);

    setPipelines((prev) =>
      prev.map((p) =>
        p.pipeline_id === pipeline_id
          ? {
              ...p,
              maintenance_status: "COMPLETED",
              maintenance_scheduled_date: "",
              maintenance_started_date: "",
              maintenance_completed_date: new Date().toISOString().slice(0, 10),
            }
          : p
      )
    );

    setCompletingId(null);
    setRepairDesc("");
    setRepairCost("");
  }

  return (
    <div className="container" style={{ animation: "fadeIn 0.35s ease" }}>
      <div className="pageHero">
        <div>
          <div className="heroEyebrow">Operations</div>
          <div className="pageTitle">Maintenance & Operations</div>
          <div className="pageSubtitle">
            Prioritize repair work using risk level, leak history, age, and backend-generated recommendations.
          </div>
        </div>
      </div>

      {loading ? (
        <div className="card card-pad">Loading maintenance data...</div>
      ) : (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "16px",
              marginBottom: "24px",
            }}
          >
            <div className="card card-pad" style={{ background: "linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)" }}>
              <div className="kpiLabel">Total Pipelines</div>
              <div className="kpiValue">{stats.total}</div>
            </div>

            <div className="card card-pad" style={{ background: "linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)" }}>
              <div className="kpiLabel">Critical Tasks</div>
              <div className="kpiValue" style={{ color: "#dc2626" }}>{stats.critical}</div>
            </div>

            <div className="card card-pad" style={{ background: "linear-gradient(135deg, #fefce8 0%, #fef3c7 100%)" }}>
              <div className="kpiLabel">Scheduled</div>
              <div className="kpiValue" style={{ color: "#d97706" }}>{stats.scheduled}</div>
            </div>

            <div className="card card-pad" style={{ background: "linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)" }}>
              <div className="kpiLabel">In Progress</div>
              <div className="kpiValue" style={{ color: "#b91c1c" }}>{stats.inProgress}</div>
            </div>

            <div className="card card-pad" style={{ background: "linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)" }}>
              <div className="kpiLabel">Completed</div>
              <div className="kpiValue" style={{ color: "#065f46" }}>{stats.completed}</div>
            </div>

            <div className="card card-pad" style={{ background: "linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)" }}>
              <div className="kpiLabel">Maintenance Cost</div>
              <div className="kpiValue" style={{ color: "#1d4ed8" }}>
                ${stats.totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              gap: "10px",
              marginTop: "24px",
              marginBottom: "16px",
              borderBottom: "2px solid var(--border)",
              paddingBottom: "10px",
              flexWrap: "wrap",
            }}
          >
            <button
              className="btn"
              style={{
                background: activeTab === "scheduler" ? "var(--primary)" : "transparent",
                color: activeTab === "scheduler" ? "#fff" : "var(--text)",
                borderColor: activeTab === "scheduler" ? "var(--primary)" : "transparent",
                fontWeight: 800,
                borderRadius: "8px",
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
                borderRadius: "8px",
              }}
              onClick={() => setActiveTab("logs")}
            >
              Maintenance Logs
            </button>
          </div>

          {activeTab === "scheduler" && (
            <>
              <div className="card card-pad" style={{ marginBottom: "20px" }}>
                <div className="title" style={{ fontSize: 16 }}>Top 10 Repair Candidates</div>
                <div className="small" style={{ marginTop: 6, marginBottom: 16 }}>
                  Highest priority pipelines based on risk level, leak count, age, and recommendation priority.
                </div>

                <div style={{ overflowX: "auto" }}>
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Pipeline ID</th>
                        <th>Division</th>
                        <th>Area</th>
                        <th>Risk</th>
                        <th>Risk Score</th>
                        <th>Leaks</th>
                        <th>Priority</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topRepairCandidates.map((p) => (
                        <tr key={p.pipeline_id}>
                          <td>
                            <Link
                              to={`/pipelines/${p.pipeline_id}`}
                              style={{ color: "var(--primary)", fontWeight: 800, textDecoration: "none" }}
                            >
                              {p.pipeline_id}
                            </Link>
                          </td>
                          <td>{p.ds_division || "-"}</td>
                          <td>{p.area_name || "-"}</td>
                          <td>
                            <span className={`badge ${riskBadgeClass(p.risk_level)}`}>
                              {p.risk_level}
                            </span>
                          </td>
                          <td>{Number(p.risk_score || 0).toFixed(3)}</td>
                          <td>{p.previous_leak_count || 0}</td>
                          <td>
                            <span className={`badge ${priorityBadgeClass(p.recommendation?.priority || "Low")}`}>
                              {p.recommendation?.priority || "Low"}
                            </span>
                          </td>
                          <td>{p.recommendation?.action || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="card card-pad" style={{ marginBottom: "20px" }}>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "minmax(220px, 1.3fr) 160px 180px 180px",
                    gap: "12px",
                  }}
                  className="maintenanceFilterGrid"
                >
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by pipeline ID, area, division, or material"
                    style={{
                      width: "100%",
                      padding: "11px 12px",
                      borderRadius: "8px",
                      border: "1px solid #cbd5e1",
                      background: "#fff",
                    }}
                  />

                  <select
                    value={riskFilter}
                    onChange={(e) => setRiskFilter(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "11px 12px",
                      borderRadius: "8px",
                      border: "1px solid #cbd5e1",
                      background: "#fff",
                      fontWeight: 600,
                    }}
                  >
                    <option value="ALL">All Risk</option>
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>

                  <select
                    value={priorityFilter}
                    onChange={(e) => setPriorityFilter(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "11px 12px",
                      borderRadius: "8px",
                      border: "1px solid #cbd5e1",
                      background: "#fff",
                      fontWeight: 600,
                    }}
                  >
                    <option value="ALL">All Priority</option>
                    <option value="Critical">Critical</option>
                    <option value="Moderate">Moderate</option>
                    <option value="Low">Low</option>
                  </select>

                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "11px 12px",
                      borderRadius: "8px",
                      border: "1px solid #cbd5e1",
                      background: "#fff",
                      fontWeight: 600,
                    }}
                  >
                    <option value="ALL">All Status</option>
                    <option value="PENDING">Pending</option>
                    <option value="SCHEDULED">Scheduled</option>
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="COMPLETED">Completed</option>
                  </select>
                </div>

                <div className="small" style={{ marginTop: 12, color: "var(--muted)" }}>
                  Showing {filteredPipelines.length} of {pipelines.length} pipelines.
                </div>
              </div>

              <div className="card card-pad" style={{ animation: "fadeIn 0.3s ease-in-out" }}>
                <div className="title" style={{ fontSize: 16 }}>Maintenance Scheduler</div>
                <div className="small" style={{ marginTop: 6, marginBottom: 16 }}>
                  Schedule, start, and complete maintenance for risk-prioritized pipelines.
                </div>

                <div style={{ overflowX: "auto" }}>
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Pipeline</th>
                        <th>Area / Division</th>
                        <th>Material</th>
                        <th>Install Year</th>
                        <th>Leaks</th>
                        <th>Risk</th>
                        <th>Status</th>
                        <th>Recommendation</th>
                        <th style={{ width: 340 }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPipelines.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="small" style={{ textAlign: "center", padding: "20px" }}>
                            No pipelines found.
                          </td>
                        </tr>
                      ) : (
                        filteredPipelines.map((p) => (
                          <tr key={p.pipeline_id}>
                            <td>
                              <Link
                                to={`/pipelines/${p.pipeline_id}`}
                                style={{ color: "var(--primary)", fontWeight: 800, textDecoration: "none" }}
                              >
                                {p.pipeline_id}
                              </Link>
                            </td>
                            <td className="small">
                              {p.area_name || "-"} / {p.ds_division || "-"}
                            </td>
                            <td>{p.material_type || "-"}</td>
                            <td>{p.install_year || "-"}</td>
                            <td>{p.previous_leak_count || 0}</td>
                            <td>
                              <span className={`badge ${riskBadgeClass(p.risk_level)}`}>
                                {p.risk_level}
                              </span>
                            </td>
                            <td>
                              <span className={`badge ${statusBadgeClass(p.maintenance_status)}`}>
                                {p.maintenance_status || "PENDING"}
                              </span>
                            </td>
                            <td className="small">
                              <div style={{ fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>
                                {p.recommendation?.action || "-"}
                              </div>
                              <div style={{ marginBottom: 4 }}>
                                <span className={`badge ${priorityBadgeClass(p.recommendation?.priority || "Low")}`}>
                                  {p.recommendation?.priority || "Low"}
                                </span>
                              </div>
                              <div style={{ color: "var(--muted)", lineHeight: 1.5 }}>
                                {p.recommendation?.message || "No message available."}
                              </div>

                              {p.maintenance_scheduled_date ? (
                                <div style={{ marginTop: 6 }}>
                                  Scheduled: <b>{p.maintenance_scheduled_date}</b>
                                </div>
                              ) : null}

                              {p.maintenance_started_date ? (
                                <div style={{ marginTop: 4 }}>
                                  Started: <b>{p.maintenance_started_date}</b>
                                </div>
                              ) : null}

                              {p.maintenance_completed_date ? (
                                <div style={{ marginTop: 4 }}>
                                  Completed: <b>{p.maintenance_completed_date}</b>
                                </div>
                              ) : null}
                            </td>
                            <td>
                              {completingId === p.pipeline_id ? (
                                <div
                                  className="vstack"
                                  style={{
                                    background: "#f8fafc",
                                    padding: "10px",
                                    borderRadius: "8px",
                                    border: "1px solid var(--border)",
                                  }}
                                >
                                  <div style={{ fontSize: "12px", fontWeight: "bold" }}>Complete Maintenance</div>

                                  <input
                                    type="text"
                                    className="input"
                                    placeholder="Repair Description"
                                    style={{ padding: "8px", fontSize: "12px" }}
                                    value={repairDesc}
                                    onChange={(e) => setRepairDesc(e.target.value)}
                                  />

                                  <div className="hstack">
                                    <span style={{ fontSize: "14px", fontWeight: "bold", color: "var(--muted)" }}>$</span>
                                    <input
                                      type="number"
                                      className="input"
                                      placeholder="Cost"
                                      style={{ padding: "8px", fontSize: "12px" }}
                                      value={repairCost}
                                      onChange={(e) => setRepairCost(e.target.value)}
                                    />
                                  </div>

                                  <div className="hstack" style={{ marginTop: "4px", gap: 8, flexWrap: "wrap" }}>
                                    <button
                                      className="btn primary"
                                      style={{ padding: "6px 12px", fontSize: "12px" }}
                                      type="button"
                                      onClick={() => submitMarkDone(p.pipeline_id)}
                                    >
                                      Submit
                                    </button>
                                    <button
                                      className="btn"
                                      style={{ padding: "6px 12px", fontSize: "12px" }}
                                      type="button"
                                      onClick={cancelMarkDone}
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="hstack" style={{ flexWrap: "wrap", gap: "8px" }}>
                                  <button
                                    className="btn primary"
                                    style={{ padding: "8px 12px", fontSize: "12px" }}
                                    type="button"
                                    onClick={() => scheduleMaintenance(p.pipeline_id)}
                                    disabled={
                                      p.maintenance_status === "SCHEDULED" ||
                                      p.maintenance_status === "IN_PROGRESS" ||
                                      p.maintenance_status === "COMPLETED"
                                    }
                                  >
                                    Schedule
                                  </button>

                                  <button
                                    className="btn"
                                    style={{ padding: "8px 12px", fontSize: "12px" }}
                                    type="button"
                                    onClick={() => startMaintenance(p.pipeline_id)}
                                    disabled={
                                      p.maintenance_status !== "SCHEDULED"
                                    }
                                  >
                                    Start
                                  </button>

                                  <button
                                    className="btn"
                                    style={{ padding: "8px 12px", fontSize: "12px" }}
                                    type="button"
                                    onClick={() => startMarkDone(p.pipeline_id)}
                                    disabled={p.maintenance_status !== "IN_PROGRESS"}
                                  >
                                    Mark Done
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {activeTab === "logs" && (
            <div className="card card-pad" style={{ animation: "fadeIn 0.3s ease-in-out" }}>
              <div className="title" style={{ fontSize: 16 }}>Maintenance Logs</div>
              <div className="small" style={{ marginTop: 6, marginBottom: 16 }}>
                Prototype-level local logs of completed maintenance actions.
              </div>

              <div style={{ overflowX: "auto" }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Log ID</th>
                      <th>Pipeline ID</th>
                      <th>Area</th>
                      <th>Division</th>
                      <th>Date Completed</th>
                      <th>Repair Description</th>
                      <th>Cost Incurred</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="small" style={{ textAlign: "center", padding: "30px" }}>
                          No maintenance logs found. Complete a maintenance task to generate logs.
                        </td>
                      </tr>
                    ) : (
                      logs.map((log) => (
                        <tr key={log.id}>
                          <td style={{ fontWeight: 600, color: "var(--muted)", fontSize: "12px" }}>{log.id}</td>
                          <td>
                            <b style={{ color: "var(--primary)" }}>{log.pipeline_id}</b>
                          </td>
                          <td>{log.area_name}</td>
                          <td>{log.ds_division}</td>
                          <td>{log.date}</td>
                          <td style={{ maxWidth: "300px" }}>
                            <div
                              style={{
                                padding: "6px 10px",
                                background: "#f1f5f9",
                                borderRadius: "6px",
                                fontSize: "13px",
                              }}
                            >
                              {log.description}
                            </div>
                          </td>
                          <td style={{ fontWeight: 800, color: "#065f46" }}>
                            ${Number(log.cost).toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(5px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @media (max-width: 900px) {
          .maintenanceFilterGrid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}