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

function mapLogRowToUi(log) {
  return {
    id: log.log_id,
    raw_log_id: log.log_id,
    pipeline_id: log.pipeline_id,
    date: log.date_completed,
    description: log.repair_description,
    cost: Number(log.repair_cost || 0),
    area_name: log.area_name || "-",
    ds_division: log.ds_division || "-",
    before_risk_score: log.old_risk_score,
    after_risk_score: log.new_risk_score,
    before_risk_level: log.old_risk_level,
    after_risk_level: log.new_risk_level,
    condition_after: log.condition_after,
    status_after: log.status_after,
  };
}

function sortLogsNewestFirst(logRows) {
  return [...logRows].sort((a, b) => {
    const aNum = Number(String(a.raw_log_id || "").replace("LOG-", ""));
    const bNum = Number(String(b.raw_log_id || "").replace("LOG-", ""));
    return bNum - aNum;
  });
}

export default function Maintenance() {
  const [pipelines, setPipelines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("scheduler");

  const [logs, setLogs] = useState([]);
  const [completingId, setCompletingId] = useState(null);
  const [repairDesc, setRepairDesc] = useState("");
  const [repairCost, setRepairCost] = useState("");
  const [conditionAfter, setConditionAfter] = useState("Improved");
  const [leakReduction, setLeakReduction] = useState("1");
  const [statusAfter, setStatusAfter] = useState("Active");
  const [repairResults, setRepairResults] = useState({});
  const [submittingRepair, setSubmittingRepair] = useState(false);

  const [search, setSearch] = useState("");
  const [riskFilter, setRiskFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [priorityFilter, setPriorityFilter] = useState("ALL");

  async function fetchMaintenanceLogs() {
    try {
      const res = await api.get("/maintenance-logs");
      const data = Array.isArray(res.data) ? res.data : [];

      const mappedLogs = sortLogsNewestFirst(data.map(mapLogRowToUi));
      setLogs(mappedLogs);

      const repairMap = {};
      data.forEach((log) => {
        repairMap[log.pipeline_id] = {
          before: {
            risk_score: log.old_risk_score,
            risk_level: log.old_risk_level,
          },
          after: {
            risk_score: log.new_risk_score,
            risk_level: log.new_risk_level,
          },
          condition_after: log.condition_after,
          status_after: log.status_after,
        };
      });
      setRepairResults(repairMap);
    } catch (err) {
      console.error("Failed to fetch maintenance logs:", err);
      setLogs([]);
    }
  }

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);

        const [pipelinesRes, logsRes] = await Promise.all([
          api.get("/pipelines-with-risk?limit=2000"),
          api.get("/maintenance-logs"),
        ]);

        const pipelineData = Array.isArray(pipelinesRes.data) ? pipelinesRes.data : [];
        const logsData = Array.isArray(logsRes.data) ? logsRes.data : [];

        const completedPipelineIds = new Set(logsData.map((log) => log.pipeline_id));

        const enriched = pipelineData.map((p) => {
          const matchingLog = logsData.find((log) => log.pipeline_id === p.pipeline_id);

          return {
            ...p,
            maintenance_status: completedPipelineIds.has(p.pipeline_id)
              ? "COMPLETED"
              : initialStatusFromPipeline(p),
            maintenance_scheduled_date: "",
            maintenance_started_date: "",
            maintenance_completed_date: matchingLog?.date_completed || "",
          };
        });

        setPipelines(enriched);

        const mappedLogs = sortLogsNewestFirst(logsData.map(mapLogRowToUi));
        setLogs(mappedLogs);

        const repairMap = {};
        logsData.forEach((log) => {
          repairMap[log.pipeline_id] = {
            before: {
              risk_score: log.old_risk_score,
              risk_level: log.old_risk_level,
            },
            after: {
              risk_score: log.new_risk_score,
              risk_level: log.new_risk_level,
            },
            condition_after: log.condition_after,
            status_after: log.status_after,
          };
        });
        setRepairResults(repairMap);
      } catch (err) {
        console.error("Maintenance fetch error:", err);
        setPipelines([]);
        setLogs([]);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  const stats = useMemo(() => {
    const total = pipelines.length;
    const critical = pipelines.filter((p) => p.recommendation?.priority === "Critical").length;
    const moderate = pipelines.filter((p) => p.recommendation?.priority === "Moderate").length;
    const low = pipelines.filter((p) => (p.recommendation?.priority || "Low") === "Low").length;
    const scheduled = pipelines.filter((p) => p.maintenance_status === "SCHEDULED").length;
    const inProgress = pipelines.filter((p) => p.maintenance_status === "IN_PROGRESS").length;
    const completed = logs.length;
    const totalCost = logs.reduce((sum, log) => sum + Number(log.cost || 0), 0);

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
      const matchesStatus = statusFilter === "ALL" || p.maintenance_status === statusFilter;
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

  function resetRepairForm() {
    setCompletingId(null);
    setRepairDesc("");
    setRepairCost("");
    setConditionAfter("Improved");
    setLeakReduction("1");
    setStatusAfter("Active");
    setSubmittingRepair(false);
  }

  function startMarkDone(pipeline_id) {
    setCompletingId(pipeline_id);
    setRepairDesc("");
    setRepairCost("");
    setConditionAfter("Improved");
    setLeakReduction("1");
    setStatusAfter("Active");
  }

  function cancelMarkDone() {
    resetRepairForm();
  }

  async function submitMarkDone(pipeline_id) {
    if (!repairDesc.trim() || !repairCost.trim()) {
      alert("Please select a repair description and enter the repair cost.");
      return;
    }

    const costNum = parseFloat(repairCost);
    const leakReductionNum = parseInt(leakReduction, 10);

    if (Number.isNaN(costNum) || costNum < 0) {
      alert("Please enter a valid cost.");
      return;
    }

    if (Number.isNaN(leakReductionNum) || leakReductionNum < 0) {
      alert("Please enter a valid leak reduction value.");
      return;
    }

    const target = pipelines.find((p) => p.pipeline_id === pipeline_id);

    try {
      setSubmittingRepair(true);

      const res = await api.post(`/pipelines/${pipeline_id}/repair-complete`, {
        repair_description: repairDesc,
        repair_cost: costNum,
        leak_reduction: leakReductionNum,
        condition_after: conditionAfter,
        status_after: statusAfter,
      });

      const result = res.data;

      const updatedPipeline = {
        ...target,
        ...result.pipeline,
        maintenance_status: "COMPLETED",
        maintenance_scheduled_date: "",
        maintenance_started_date: "",
        maintenance_completed_date: new Date().toISOString().slice(0, 10),
      };

      setPipelines((prev) =>
        prev.map((p) => (p.pipeline_id === pipeline_id ? updatedPipeline : p))
      );

      setRepairResults((prev) => ({
        ...prev,
        [pipeline_id]: result,
      }));

      await fetchMaintenanceLogs();
      resetRepairForm();
    } catch (err) {
      console.error("Repair completion error:", err);
      alert(err?.response?.data?.detail || "Failed to mark pipeline as repaired.");
      setSubmittingRepair(false);
    }
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
                Rs. {stats.totalCost.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
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
                        filteredPipelines.map((p) => {
                          const repairResult = repairResults[p.pipeline_id];

                          return (
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

                                {repairResult ? (
                                  <div
                                    style={{
                                      marginTop: 10,
                                      background: "#eff6ff",
                                      border: "1px solid #bfdbfe",
                                      borderRadius: 10,
                                      padding: "10px 12px",
                                    }}
                                  >
                                    <div style={{ fontWeight: 800, marginBottom: 6, color: "#1d4ed8" }}>
                                      After Repair Summary
                                    </div>
                                    <div>Old Risk: <b>{Number(repairResult.before?.risk_score || 0).toFixed(3)}</b> ({repairResult.before?.risk_level || "-"})</div>
                                    <div>New Risk: <b>{Number(repairResult.after?.risk_score || 0).toFixed(3)}</b> ({repairResult.after?.risk_level || "-"})</div>
                                    <div>Condition: <b>{repairResult.condition_after || "Improved"}</b></div>
                                    <div>Status: <b>{repairResult.status_after || "Active"}</b></div>
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
                                      gap: 8,
                                    }}
                                  >
                                    <div style={{ fontSize: "12px", fontWeight: "bold" }}>Mark as Repaired</div>

                                    <select
                                      value={repairDesc}
                                      onChange={(e) => setRepairDesc(e.target.value)}
                                      style={{
                                        padding: "8px",
                                        fontSize: "12px",
                                        borderRadius: 8,
                                        border: "1px solid #cbd5e1",
                                      }}
                                    >
                                      <option value="">Select Repair Type</option>
                                      <option value="Leak repaired and section reinforced">
                                        Leak repaired and section reinforced
                                      </option>
                                      <option value="Pipe joint repaired">
                                        Pipe joint repaired
                                      </option>
                                      <option value="Valve section restored">
                                        Valve section restored
                                      </option>
                                      <option value="Pipe section replaced">
                                        Pipe section replaced
                                      </option>
                                      <option value="Crack sealed and reinforced">
                                        Crack sealed and reinforced
                                      </option>
                                    </select>

                                    <div className="hstack">
                                      <span style={{ fontSize: "14px", fontWeight: "bold", color: "var(--muted)" }}>
                                        Rs.
                                      </span>
                                      <input
                                        type="number"
                                        className="input"
                                        placeholder="Cost"
                                        style={{ padding: "8px", fontSize: "12px" }}
                                        value={repairCost}
                                        onChange={(e) => setRepairCost(e.target.value)}
                                      />
                                    </div>

                                    <select
                                      value={conditionAfter}
                                      onChange={(e) => setConditionAfter(e.target.value)}
                                      style={{ padding: "8px", fontSize: "12px", borderRadius: 8, border: "1px solid #cbd5e1" }}
                                    >
                                      <option value="Improved">Condition Improved</option>
                                      <option value="Stable">Condition Stable</option>
                                      <option value="Replaced Section">Section Replaced</option>
                                    </select>

                                    <select
                                      value={leakReduction}
                                      onChange={(e) => setLeakReduction(e.target.value)}
                                      style={{ padding: "8px", fontSize: "12px", borderRadius: 8, border: "1px solid #cbd5e1" }}
                                    >
                                      <option value="0">Incident not reduced</option>
                                      <option value="1">Reduce incidents by 1</option>
                                      <option value="2">Reduce incidents by 2</option>
                                      <option value="3">Reduce incidents by 3</option>
                                    </select>

                                    <select
                                      value={statusAfter}
                                      onChange={(e) => setStatusAfter(e.target.value)}
                                      style={{ padding: "8px", fontSize: "12px", borderRadius: 8, border: "1px solid #cbd5e1" }}
                                    >
                                      <option value="Active">Status: Active</option>
                                      <option value="Monitored">Status: Monitored</option>
                                      <option value="Restored">Status: Restored</option>
                                    </select>

                                    <div className="hstack" style={{ marginTop: "4px", gap: 8, flexWrap: "wrap" }}>
                                      <button
                                        className="btn primary"
                                        style={{ padding: "6px 12px", fontSize: "12px" }}
                                        type="button"
                                        onClick={() => submitMarkDone(p.pipeline_id)}
                                        disabled={submittingRepair}
                                      >
                                        {submittingRepair ? "Saving..." : "Save Repair"}
                                      </button>
                                      <button
                                        className="btn"
                                        style={{ padding: "6px 12px", fontSize: "12px" }}
                                        type="button"
                                        onClick={cancelMarkDone}
                                        disabled={submittingRepair}
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
                                      disabled={p.maintenance_status !== "SCHEDULED"}
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
                                      Mark as Repaired
                                    </button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })
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
                Completed repair actions with before and after risk comparison.
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
                      <th>Risk Change</th>
                      <th>Condition / Status</th>
                      <th>Cost Incurred</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="small" style={{ textAlign: "center", padding: "30px" }}>
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
                          <td style={{ maxWidth: "280px" }}>
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
                          <td>
                            <div style={{ fontSize: 13 }}>
                              <div>Old: <b>{Number(log.before_risk_score || 0).toFixed(3)}</b> ({log.before_risk_level || "-"})</div>
                              <div>New: <b>{Number(log.after_risk_score || 0).toFixed(3)}</b> ({log.after_risk_level || "-"})</div>
                            </div>
                          </td>
                          <td>
                            <div style={{ fontSize: 13 }}>
                              <div>{log.condition_after || "Improved"}</div>
                              <div style={{ color: "var(--muted)" }}>{log.status_after || "Active"}</div>
                            </div>
                          </td>
                          <td style={{ fontWeight: 800, color: "#065f46" }}>
                            Rs. {Number(log.cost || 0).toLocaleString(undefined, {
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