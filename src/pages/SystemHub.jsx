import { useMemo, useState, useEffect } from "react";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend, BarChart, CartesianGrid, XAxis, YAxis, Bar } from "recharts";

const PIPELINES_LS_KEY = "waterflow_pipelines_v1";
const LOGS_LS_KEY = "waterflow_maint_logs_v1";

function loadPipelines() {
    try {
        const raw = localStorage.getItem(PIPELINES_LS_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
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

function daysSince(dateStr) {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return null;
    const diffMs = Date.now() - d.getTime();
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

const PIE_COLORS = { Low: "#10b981", Medium: "#f59e0b", High: "#ef4444" };

export default function SystemHub() {
    const [pipelines, setPipelines] = useState([]);
    const [logs, setLogs] = useState([]);

    useEffect(() => {
        // Initial fetch
        setPipelines(loadPipelines());
        setLogs(loadLogs());

        // Listen for storage changes in the same window frame
        const handleStorageChange = () => {
            setPipelines(loadPipelines());
            setLogs(loadLogs());
        };

        window.addEventListener("storage", handleStorageChange);
        return () => window.removeEventListener("storage", handleStorageChange);
    }, []);

    const totalPipelines = pipelines.length;
    // Pipelines maintained can be derived from unique pipeline IDs in logs
    const maintainedCount = useMemo(() => new Set(logs.map(l => l.pipeline_id)).size, [logs]);
    const estimatedCost = useMemo(() => logs.reduce((sum, l) => sum + (Number(l.cost) || 0), 0), [logs]);

    const riskData = useMemo(() => {
        let low = 0, med = 0, high = 0;
        pipelines.forEach(p => {
            const r = p.corrosion_risk || "Low";
            if (r === "High") high++;
            else if (r === "Medium") med++;
            else low++;
        });
        return [
            { name: "Low Risk", value: low, fill: PIE_COLORS.Low },
            { name: "Medium Risk", value: med, fill: PIE_COLORS.Medium },
            { name: "High Risk", value: high, fill: PIE_COLORS.High },
        ];
    }, [pipelines]);

    const alerts = useMemo(() => {
        const arr = [];
        pipelines.forEach(p => {
            if (p.corrosion_risk === "High") {
                arr.push({
                    id: p.pipeline_id + "-risk",
                    pipeline_id: p.pipeline_id,
                    title: "High Risk Criticality",
                    type: "CRITICAL",
                    message: "Pipeline is currently classified as High Risk."
                });
            }

            const ds = daysSince(p.last_maintenance_date);
            if (ds === null || ds > 365) {
                arr.push({
                    id: p.pipeline_id + "-overdue",
                    pipeline_id: p.pipeline_id,
                    title: "Maintenance Overdue",
                    type: "WARN",
                    message: `Pipeline is past-due for scheduled maintenance (${ds === null ? 'Never Maintained' : ds + ' Days Since'}).`
                });
            }
        });
        return arr;
    }, [pipelines]);

    return (
        <div className="container" style={{ animation: "fadeIn 0.5s ease-out" }}>
            {/* Header */}
            <div className="header" style={{ marginBottom: "28px", borderBottom: "1px solid #e2e8f0", paddingBottom: "16px" }}>
                <div>
                    <div className="title" style={{ fontSize: "28px", color: "var(--text)", fontWeight: 900, marginBottom: "4px" }}>
                        Decision Hub
                    </div>
                    <div className="subtitle" style={{ fontSize: "15px", color: "var(--muted)" }}>
                        A centralized overview to make critical engineering decisions faster.
                    </div>
                </div>
                <div className="hstack">
                    <span className="badge" style={{ fontSize: "12px", padding: "6px 12px", background: "var(--primary)", color: "#fff", border: "none" }}>
                        🌟 Executive Hub Overview
                    </span>
                </div>
            </div>

            {/* Key Metrics */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "20px", marginBottom: "32px" }}>
                <div className="card card-pad" style={{ background: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)", color: "#fff", border: "none", boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div>
                            <div style={{ color: "#94a3b8", fontSize: "14px", fontWeight: 800 }}>Total Pipelines</div>
                            <div style={{ fontSize: "36px", fontWeight: 900, marginTop: "8px" }}>{totalPipelines}</div>
                        </div>
                        <div style={{ fontSize: "32px" }}>🌐</div>
                    </div>
                    <div style={{ marginTop: "16px", paddingTop: "12px", borderTop: "1px solid rgba(255,255,255,0.1)", fontSize: "12px", color: "#94a3b8" }}>
                        Total assets actively monitored globally.
                    </div>
                </div>

                <div className="card card-pad" style={{ background: "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)", color: "#fff", border: "none", boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div>
                            <div style={{ color: "#bae6fd", fontSize: "14px", fontWeight: 800 }}>Maintained Pipelines</div>
                            <div style={{ fontSize: "36px", fontWeight: 900, marginTop: "8px" }}>{maintainedCount}</div>
                        </div>
                        <div style={{ fontSize: "32px" }}>🛡️</div>
                    </div>
                    <div style={{ marginTop: "16px", paddingTop: "12px", borderTop: "1px solid rgba(255,255,255,0.1)", fontSize: "12px", color: "#bae6fd" }}>
                        Unique pipelines with logged maintenance histories.
                    </div>
                </div>

                <div className="card card-pad" style={{ background: "linear-gradient(135deg, #059669 0%, #047857 100%)", color: "#fff", border: "none", boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div>
                            <div style={{ color: "#a7f3d0", fontSize: "14px", fontWeight: 800 }}>Maint. Expenditures</div>
                            <div style={{ fontSize: "36px", fontWeight: 900, marginTop: "8px" }}>
                                ${estimatedCost.toLocaleString()}
                            </div>
                        </div>
                        <div style={{ fontSize: "32px" }}>💲</div>
                    </div>
                    <div style={{ marginTop: "16px", paddingTop: "12px", borderTop: "1px solid rgba(255,255,255,0.1)", fontSize: "12px", color: "#a7f3d0" }}>
                        Total cost accrued from existing service repairs.
                    </div>
                </div>
            </div>

            {/* Main Content Areas: Risk Overview & Automated Alerts Panel */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>

                {/* Left: Risk Overview (Pie Chart) */}
                <div className="card card-pad" style={{ display: "flex", flexDirection: "column", border: "1px solid #e2e8f0", background: "linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)" }}>
                    <div style={{ marginBottom: "16px", borderBottom: "1px dashed #cbd5e1", paddingBottom: "12px" }}>
                        <div style={{ fontSize: "18px", color: "var(--text)", fontWeight: 900 }}>⚖️ Risk Overview</div>
                        <div style={{ fontSize: "13px", color: "var(--muted)", marginTop: "4px" }}>System-wide distribution by evaluated asset risk category.</div>
                    </div>

                    <div style={{ flex: 1, minHeight: "360px", width: "100%" }}>
                        {totalPipelines === 0 ? (
                            <div style={{ display: "flex", height: "100%", justifyContent: "center", alignItems: "center", color: "var(--muted)", fontSize: "14px", fontWeight: 700 }}>
                                No pipelines available in the system.
                            </div>
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Tooltip contentStyle={{ borderRadius: "8px", fontWeight: 800, border: "none", boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)" }} />
                                    <Legend iconType="circle" wrapperStyle={{ fontSize: "14px", fontWeight: 800 }} />
                                    <Pie
                                        data={riskData}
                                        dataKey="value"
                                        nameKey="name"
                                        cx="50%"
                                        cy="45%"
                                        innerRadius={80}
                                        outerRadius={120}
                                        paddingAngle={4}
                                        label={{ fill: "#334155", fontSize: "13px", fontWeight: 900 }}
                                    >
                                        {riskData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.fill} stroke="transparent" />
                                        ))}
                                    </Pie>
                                </PieChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </div>

                {/* Right: Automated Alerts Panel */}
                <div className="card card-pad" style={{ display: "flex", flexDirection: "column", border: "1px solid #e2e8f0", background: "linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)" }}>
                    <div style={{ marginBottom: "16px", borderBottom: "1px dashed #cbd5e1", paddingBottom: "12px" }}>
                        <div style={{ fontSize: "18px", color: "var(--text)", fontWeight: 900 }}>🚨 Automated Alerts Panel</div>
                        <div style={{ fontSize: "13px", color: "var(--muted)", marginTop: "4px" }}>AI-like notification alerts for past-due assets & excessive risks.</div>
                    </div>

                    <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "10px", maxHeight: "400px", paddingRight: "6px" }}>
                        {alerts.length === 0 ? (
                            <div style={{ padding: "40px 20px", textAlign: "center", borderRadius: "12px", background: "#ecfdf5", border: "1px dashed #10b981", color: "#059669", fontWeight: 800 }}>
                                <div style={{ fontSize: "28px", marginBottom: "8px" }}>🟢</div>
                                All pipelines are operating safely.<br />No overdue maintenance or critical risks.
                            </div>
                        ) : (
                            alerts.map((alert) => (
                                <div key={alert.id} style={{
                                    padding: "16px",
                                    borderRadius: "12px",
                                    background: alert.type === "CRITICAL" ? "#fef2f2" : "#fffbeb",
                                    border: `1px solid ${alert.type === 'CRITICAL' ? '#fecaca' : '#fde68a'}`,
                                    boxShadow: "0 2px 4px rgba(0,0,0,0.02)"
                                }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                                        <span className={`badge ${alert.type === "CRITICAL" ? "danger" : "warn"}`} style={{ fontSize: "11px", border: "none" }}>
                                            {alert.title}
                                        </span>
                                        <span style={{ fontSize: "14px", fontWeight: 900, color: "var(--text)" }}>{alert.pipeline_id}</span>
                                    </div>
                                    <div style={{ fontSize: "13px", color: alert.type === "CRITICAL" ? "#991b1b" : "#92400e", fontWeight: 600 }}>
                                        {alert.message}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        ::-webkit-scrollbar {
           width: 6px;
        }
        ::-webkit-scrollbar-track {
           background: transparent;
        }
        ::-webkit-scrollbar-thumb {
           background: #cbd5e1;
           border-radius: 10px;
        }
        ::-webkit-scrollbar-thumb:hover {
           background: #94a3b8;
        }
        
        @media (max-width: 900px) {
           .container > div:last-child {
              grid-template-columns: 1fr !important;
           }
        }
      `}</style>
        </div>
    );
}
