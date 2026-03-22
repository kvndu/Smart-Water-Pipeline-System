import { useEffect, useMemo, useState } from "react";
import api from "../utils/api.js";

function priorityBadgeClass(level) {
  if (level === "High") return "danger";
  if (level === "Medium") return "warn";
  return "ok";
}

function statusBadgeClass(status) {
  if (status === "UNDER_REPAIR") return "danger";
  if (status === "UNDER_MAINTENANCE") return "warn";
  if (status === "INACTIVE") return "";
  return "ok";
}

function getPriorityScore(p) {
  const riskWeight = p.risk_level === "High" ? 3 : p.risk_level === "Medium" ? 2 : 1;
  const leakWeight = Number(p.previous_leak_count || 0);
  const ageWeight = 2025 - Number(p.install_year || 2025);
  return riskWeight * 100 + leakWeight * 10 + ageWeight;
}

export default function Maintenance() {
  const [pipelines, setPipelines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("scheduler"); // scheduler | logs

  // UI-only logs for prototype
  const [logs, setLogs] = useState([]);
  const [completingId, setCompletingId] = useState(null);
  const [repairDesc, setRepairDesc] = useState("");
  const [repairCost, setRepairCost] = useState("");

  useEffect(() => {
    async function fetchPipelines() {
      try {
        setLoading(true);
        const res = await api.get("/pipelines-with-risk?limit=100");
        const data = Array.isArray(res.data) ? res.data : [];

        // add local UI status fields
        const enriched = data.map((p) => ({
          ...p,
          status: p.risk_level === "High" ? "UNDER_MAINTENANCE" : "ACTIVE",
          maintenance_scheduled_date: "",
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
    const high = pipelines.filter((p) => p.risk_level === "High").length;
    const medium = pipelines.filter((p) => p.risk_level === "Medium").length;
    const low = pipelines.filter((p) => p.risk_level === "Low").length;
    const scheduled = pipelines.filter((p) => p.status === "UNDER_MAINTENANCE").length;
    const totalCost = logs.reduce((sum, log) => sum + (parseFloat(log.cost) || 0), 0);

    return { total, high, medium, low, scheduled, totalCost };
  }, [pipelines, logs]);

  const prioritized = useMemo(() => {
    return [...pipelines].sort((a, b) => getPriorityScore(b) - getPriorityScore(a));
  }, [pipelines]);

  function scheduleMaintenance(pipeline_id) {
    setPipelines((prev) =>
      prev.map((p) =>
        p.pipeline_id === pipeline_id
          ? {
              ...p,
              status: "UNDER_MAINTENANCE",
              maintenance_scheduled_date: new Date().toISOString().slice(0, 10),
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

    const newLog = {
      id: `LOG-${Date.now()}`,
      pipeline_id,
      date: new Date().toISOString().slice(0, 10),
      description: repairDesc,
      cost: costNum,
    };

    setLogs((prev) => [newLog, ...prev]);

    setPipelines((prev) =>
      prev.map((p) =>
        p.pipeline_id === pipeline_id
          ? {
              ...p,
              status: "ACTIVE",
              maintenance_scheduled_date: "",
            }
          : p
      )
    );

    setCompletingId(null);
    setRepairDesc("");
    setRepairCost("");
  }

  const topRepairCandidates = useMemo(() => prioritized.slice(0, 10), [prioritized]);

  return (
    <div className="container">
      <div className="header" style={{ marginBottom: "24px" }}>
        <div>
          <div className="title" style={{ fontSize: "24px" }}>Maintenance & Operations</div>
          <div className="subtitle" style={{ fontSize: "14px" }}>
            Prioritize repairs using risk score, leak history, and installation age.
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
              <div className="kpiLabel">High Risk</div>
              <div className="kpiValue" style={{ color: "#dc2626" }}>{stats.high}</div>
            </div>

            <div className="card card-pad" style={{ background: "linear-gradient(135deg, #fefce8 0%, #fef3c7 100%)" }}>
              <div className="kpiLabel">Medium Risk</div>
              <div className="kpiValue" style={{ color: "#d97706" }}>{stats.medium}</div>
            </div>

            <div className="card card-pad" style={{ background: "linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)" }}>
              <div className="kpiLabel">Scheduled</div>
              <div className="kpiValue" style={{ color: "#065f46" }}>{stats.scheduled}</div>
            </div>

            <div className="card card-pad" style={{ background: "linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)" }}>
              <div className="kpiLabel">Maintenance Cost</div>
              <div className="kpiValue" style={{ color: "#1d4ed8" }}>
                ${stats.totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div
            style={{
              display: "flex",
              gap: "10px",
              marginTop: "24px",
              marginBottom: "16px",
              borderBottom: "2px solid var(--border)",
              paddingBottom: "10px",
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
                  Highest priority pipelines based on risk level, leak count, and pipe age.
                </div>

                <div style={{ overflowX: "auto" }}>
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Pipeline ID</th>
                        <th>Division</th>
                        <th>Area</th>
                        <th>Material</th>
                        <th>Install Year</th>
                        <th>Leaks</th>
                        <th>Risk Score</th>
                        <th>Risk</th>
                        <th>Recommendation</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topRepairCandidates.map((p) => (
                        <tr key={p.pipeline_id}>
                          <td><b style={{ color: "var(--primary)" }}>{p.pipeline_id}</b></td>
                          <td>{p.ds_division}</td>
                          <td>{p.area_name}</td>
                          <td>{p.material_type}</td>
                          <td>{p.install_year}</td>
                          <td>{p.previous_leak_count}</td>
                          <td>{p.risk_score}</td>
                          <td>
                            <span className={`badge ${priorityBadgeClass(p.risk_level)}`}>
                              {p.risk_level}
                            </span>
                          </td>
                          <td>{p.recommendation}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="card card-pad" style={{ animation: "fadeIn 0.3s ease-in-out" }}>
                <div className="title" style={{ fontSize: 16 }}>Maintenance Scheduler</div>
                <div className="small" style={{ marginTop: 6, marginBottom: 16 }}>
                  Schedule and complete maintenance for risk-prioritized pipelines.
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
                        <th style={{ width: 320 }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {prioritized.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="small" style={{ textAlign: "center", padding: "20px" }}>
                            No pipelines found.
                          </td>
                        </tr>
                      ) : (
                        prioritized.map((p) => (
                          <tr key={p.pipeline_id}>
                            <td>
                              <b style={{ color: "var(--primary)" }}>{p.pipeline_id}</b>
                            </td>
                            <td className="small">
                              {p.area_name} / {p.ds_division}
                            </td>
                            <td>{p.material_type}</td>
                            <td>{p.install_year}</td>
                            <td>{p.previous_leak_count}</td>
                            <td>
                              <span className={`badge ${priorityBadgeClass(p.risk_level)}`}>
                                {p.risk_level}
                              </span>
                            </td>
                            <td>
                              <span className={`badge ${statusBadgeClass(p.status)}`}>
                                {p.status || "ACTIVE"}
                              </span>
                            </td>
                            <td className="small">
                              {p.recommendation}
                              {p.maintenance_scheduled_date ? (
                                <div style={{ marginTop: "4px" }}>
                                  Scheduled: <b>{p.maintenance_scheduled_date}</b>
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

                                  <div className="hstack" style={{ marginTop: "4px" }}>
                                    <button
                                      className="btn primary"
                                      style={{ padding: "6px 12px", fontSize: "12px" }}
                                      onClick={() => submitMarkDone(p.pipeline_id)}
                                    >
                                      Submit
                                    </button>
                                    <button
                                      className="btn"
                                      style={{ padding: "6px 12px", fontSize: "12px" }}
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
                                    disabled={p.status === "UNDER_MAINTENANCE"}
                                  >
                                    Schedule
                                  </button>

                                  <button
                                    className="btn"
                                    style={{ padding: "8px 12px", fontSize: "12px" }}
                                    type="button"
                                    onClick={() => startMarkDone(p.pipeline_id)}
                                    disabled={p.status !== "UNDER_MAINTENANCE"}
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
                      logs.map((log) => (
                        <tr key={log.id}>
                          <td style={{ fontWeight: 600, color: "var(--muted)", fontSize: "12px" }}>{log.id}</td>
                          <td><b style={{ color: "var(--primary)" }}>{log.pipeline_id}</b></td>
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
      `}</style>
    </div>
  );
}