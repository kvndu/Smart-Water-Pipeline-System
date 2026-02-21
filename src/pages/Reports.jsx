import { useState, useMemo } from "react";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip as RechartsTooltip,
    Legend,
    ResponsiveContainer,
    LineChart,
    Line,
    AreaChart,
    Area
} from "recharts";

const MOCK_EXPENDITURES = [
    { month: "Sep", cost: 1500 },
    { month: "Oct", cost: 2200 },
    { month: "Nov", cost: 1100 },
    { month: "Dec", cost: 2500 },
    { month: "Jan", cost: 1800 },
    { month: "Feb", cost: 3400 },
];

const MOCK_TRENDS = [
    { month: "Sep", emergency_repairs: 4, preventive_maint: 10 },
    { month: "Oct", emergency_repairs: 6, preventive_maint: 14 },
    { month: "Nov", emergency_repairs: 2, preventive_maint: 8 },
    { month: "Dec", emergency_repairs: 5, preventive_maint: 16 },
    { month: "Jan", emergency_repairs: 3, preventive_maint: 12 },
    { month: "Feb", emergency_repairs: 8, preventive_maint: 18 },
];

export default function Reports() {
    const [downloading, setDownloading] = useState("");

    const totalCost = useMemo(() => MOCK_EXPENDITURES.reduce((acc, curr) => acc + curr.cost, 0), []);
    const totalRepairs = useMemo(() => MOCK_TRENDS.reduce((acc, curr) => acc + curr.emergency_repairs + curr.preventive_maint, 0), []);

    const downloadCSV = () => {
        setDownloading("excel");
        setTimeout(() => {
            const headers = ["Month", "Expenditure_Cost_USD", "Emergency_Repairs", "Preventive_Maintenance"];
            const rows = MOCK_EXPENDITURES.map((exp, idx) => {
                const tr = MOCK_TRENDS[idx];
                return [exp.month, exp.cost, tr.emergency_repairs, tr.preventive_maint].join(",");
            });
            const csv = [headers.join(","), ...rows].join("\n");

            const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
            const a = document.createElement("a");
            a.href = url;
            a.download = "Kalutara_District_Report.csv";
            a.click();
            URL.revokeObjectURL(url);
            setDownloading("");
        }, 600);
    };

    const downloadPDF = () => {
        setDownloading("pdf");
        setTimeout(() => {
            window.print();
            setDownloading("");
        }, 600);
    };

    return (
        <div className="container" style={{ animation: "fadeIn 0.4s ease-in-out" }}>
            <div className="header" style={{ marginBottom: "24px" }}>
                <div>
                    <div className="title" style={{ fontSize: "24px", color: "var(--primary)" }}>Reports & Analytics</div>
                    <div className="subtitle" style={{ fontSize: "14px" }}>
                        Summary reports for Kalutara district: Pipeline maintenance trends and monthly expenditures.
                    </div>
                </div>
                <div className="hstack">
                    <button
                        className="btn"
                        style={{
                            borderColor: "#10b981",
                            color: "#059669",
                            background: "#ecfdf5",
                            display: "flex",
                            alignItems: "center",
                            gap: "6px"
                        }}
                        onClick={downloadCSV}
                        disabled={!!downloading}
                    >
                        <span style={{ fontSize: "16px" }}>📊</span>
                        {downloading === "excel" ? "Generating..." : "Download Excel"}
                    </button>
                    <button
                        className="btn primary"
                        style={{ display: "flex", alignItems: "center", gap: "6px" }}
                        onClick={downloadPDF}
                        disabled={!!downloading}
                    >
                        <span style={{ fontSize: "16px" }}>📄</span>
                        {downloading === "pdf" ? "Preparing..." : "Download PDF"}
                    </button>
                </div>
            </div>

            <div className="kpiGrid">
                <div className="card card-pad" style={{ background: "linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)", borderColor: "#bae6fd" }}>
                    <div className="kpiLabel" style={{ color: "#0369a1" }}>Total Covered Pipelines (Kalutara)</div>
                    <div className="kpiValue" style={{ color: "#0c4a6e" }}>142 km</div>
                </div>
                <div className="card card-pad" style={{ background: "linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)", borderColor: "#fecaca" }}>
                    <div className="kpiLabel" style={{ color: "#b91c1c" }}>Total Expenditure (6 months)</div>
                    <div className="kpiValue" style={{ color: "#7f1d1d" }}>
                        ${totalCost.toLocaleString()}
                    </div>
                </div>
                <div className="card card-pad" style={{ background: "linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)", borderColor: "#a7f3d0" }}>
                    <div className="kpiLabel" style={{ color: "#047857" }}>Avg Monthly Cost</div>
                    <div className="kpiValue" style={{ color: "#064e3b" }}>
                        ${Math.round(totalCost / 6).toLocaleString()}
                    </div>
                </div>
                <div className="card card-pad" style={{ background: "linear-gradient(135deg, #fdf4ff 0%, #fae8ff 100%)", borderColor: "#f5d0fe" }}>
                    <div className="kpiLabel" style={{ color: "#86198f" }}>Total Actions (Repairs + Maint)</div>
                    <div className="kpiValue" style={{ color: "#4a044e" }}>
                        {totalRepairs}
                    </div>
                </div>
            </div>

            <div className="chartsSection" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", marginTop: "24px" }}>
                {/* EXPENDITURE CHART */}
                <div className="card card-pad" style={{ height: "380px", display: "flex", flexDirection: "column" }}>
                    <div className="chartHeader" style={{ marginBottom: "16px" }}>
                        <div className="chartTitle" style={{ fontSize: "16px", color: "#334155" }}>
                            Monthly Expenditures (Kalutara District)
                        </div>
                    </div>
                    <div style={{ flex: 1, minHeight: 0 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={MOCK_EXPENDITURES} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorCost" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} />
                                <YAxis tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} />
                                <RechartsTooltip
                                    contentStyle={{ borderRadius: "8px", border: "1px solid #e2e8f0", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }}
                                    formatter={(value) => [`$${value}`, "Cost"]}
                                />
                                <Area type="monotone" dataKey="cost" stroke="#ef4444" strokeWidth={3} fillOpacity={1} fill="url(#colorCost)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* TRENDS CHART */}
                <div className="card card-pad" style={{ height: "380px", display: "flex", flexDirection: "column" }}>
                    <div className="chartHeader" style={{ marginBottom: "16px" }}>
                        <div className="chartTitle" style={{ fontSize: "16px", color: "#334155" }}>
                            Pipeline Maintenance Trends
                        </div>
                    </div>
                    <div style={{ flex: 1, minHeight: 0 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={MOCK_TRENDS} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} />
                                <YAxis tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} />
                                <RechartsTooltip
                                    cursor={{ fill: "#f1f5f9" }}
                                    contentStyle={{ borderRadius: "8px", border: "1px solid #e2e8f0", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }}
                                />
                                <Legend iconType="circle" wrapperStyle={{ fontSize: "12px", paddingTop: "10px" }} />
                                <Bar dataKey="preventive_maint" name="Preventive Maintenance" stackId="a" fill="#3b82f6" radius={[0, 0, 4, 4]} />
                                <Bar dataKey="emergency_repairs" name="Emergency Repairs" stackId="a" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(5px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        @media print {
          .sidebar, .btn { display: none !important; }
          .appMain { background: #fff !important; }
          .card { box-shadow: none !important; border-color: #000 !important; }
          body { background: #fff !important; }
        }
        
        @media (max-width: 1000px) {
          .chartsSection { grid-template-columns: 1fr !important; }
        }
      `}</style>
        </div>
    );
}
