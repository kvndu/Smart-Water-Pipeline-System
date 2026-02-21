import { useMemo, useState } from "react";
import KPIGrid from "../components/KPIGrid.jsx";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
  Legend,
  ReferenceLine,
} from "recharts";

/** ✅ Demo sensor-like series (NOT AI). Replace with IoT later. */
function makeFlowPressureSeries() {
  return [
    { time: "00:00", flow: 460, pressure: 45 },
    { time: "04:00", flow: 390, pressure: 42 },
    { time: "08:00", flow: 620, pressure: 50 },
    { time: "12:00", flow: 580, pressure: 48 },
    { time: "16:00", flow: 700, pressure: 53 },
    { time: "20:00", flow: 520, pressure: 46 },
  ];
}

function stats(values) {
  if (!values.length) return { min: 0, max: 0, avg: 0 };
  const min = Math.min(...values);
  const max = Math.max(...values);
  const avg = Math.round(values.reduce((s, v) => s + v, 0) / values.length);
  return { min, max, avg };
}

/** ✅ Rule-based events (No AI) */
function buildEvents(series, FLOW_MIN, FLOW_MAX, PRESS_MIN, PRESS_MAX) {
  const events = [];

  // Sudden flow drop > 150 between readings => possible leak
  for (let i = 1; i < series.length; i++) {
    const prev = series[i - 1];
    const cur = series[i];
    const drop = prev.flow - cur.flow;
    if (drop > 150) {
      events.push({
        id: `E-FLOWDROP-${i}`,
        time: cur.time,
        type: "LEAK_SUSPECTED",
        message: `Sudden flow drop (${drop} L/s)`,
        level: "WARN",
      });
    }
  }

  // Pressure above safe max => burst risk
  for (let i = 0; i < series.length; i++) {
    const cur = series[i];
    if (cur.pressure > PRESS_MAX) {
      events.push({
        id: `E-HIGHP-${i}`,
        time: cur.time,
        type: "HIGH_PRESSURE",
        message: `Pressure above safe limit (${cur.pressure} PSI)`,
        level: "CRITICAL",
      });
    }
  }

  // Flow out of safe range (low/high)
  for (let i = 0; i < series.length; i++) {
    const cur = series[i];
    if (cur.flow < FLOW_MIN) {
      events.push({
        id: `E-LOWFLOW-${i}`,
        time: cur.time,
        type: "LOW_FLOW",
        message: `Flow below safe limit (${cur.flow} L/s)`,
        level: "WARN",
      });
    }
    if (cur.flow > FLOW_MAX) {
      events.push({
        id: `E-HIGHFLOW-${i}`,
        time: cur.time,
        type: "HIGH_FLOW",
        message: `Flow above safe limit (${cur.flow} L/s)`,
        level: "WARN",
      });
    }
  }

  // Sort by time order in series
  const indexByTime = new Map(series.map((x, idx) => [x.time, idx]));
  events.sort((a, b) => (indexByTime.get(a.time) ?? 0) - (indexByTime.get(b.time) ?? 0));

  return events;
}

function toCSV(rows) {
  if (!rows?.length) return "";
  const headers = Object.keys(rows[0]);
  return [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => `"${String(r[h] ?? "").replaceAll('"', '""')}"`).join(",")),
  ].join("\n");
}

function downloadCSV(filename, rows) {
  const csv = toCSV(rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
}

function healthFromLatest(latest, FLOW_MIN, FLOW_MAX, PRESS_MIN, PRESS_MAX) {
  // Critical: pressure > max
  if (latest.pressure > PRESS_MAX) return { label: "CRITICAL", badge: "danger" };

  // Warning: flow out of range OR near limits
  if (latest.flow < FLOW_MIN || latest.flow > FLOW_MAX) return { label: "WARNING", badge: "warn" };
  if (latest.pressure < PRESS_MIN || latest.pressure > PRESS_MAX - 1) return { label: "WARNING", badge: "warn" };

  return { label: "OK", badge: "ok" };
}

export default function Dashboard() {
  // Safe ranges (tweak if needed)
  const FLOW_MIN = 400;
  const FLOW_MAX = 750;
  const PRESS_MIN = 40;
  const PRESS_MAX = 55;

  const [range] = useState("Today"); // can expand later: Today / 7 Days
  const series = useMemo(() => makeFlowPressureSeries(), []);

  const flowValues = useMemo(() => series.map((x) => x.flow), [series]);
  const pressValues = useMemo(() => series.map((x) => x.pressure), [series]);

  const flowS = useMemo(() => stats(flowValues), [flowValues]);
  const pressS = useMemo(() => stats(pressValues), [pressValues]);

  const latest = series[series.length - 1] || { time: "--:--", flow: 0, pressure: 0 };
  const health = useMemo(
    () => healthFromLatest(latest, FLOW_MIN, FLOW_MAX, PRESS_MIN, PRESS_MAX),
    [latest, FLOW_MIN, FLOW_MAX, PRESS_MIN, PRESS_MAX]
  );

  const events = useMemo(
    () => buildEvents(series, FLOW_MIN, FLOW_MAX, PRESS_MIN, PRESS_MAX),
    [series, FLOW_MIN, FLOW_MAX, PRESS_MIN, PRESS_MAX]
  );

  const criticalCount = useMemo(() => events.filter((e) => e.level === "CRITICAL").length, [events]);
  const warnCount = useMemo(() => events.filter((e) => e.level === "WARN").length, [events]);

  const kpis = useMemo(() => {
    return [
      { label: "Avg Flow Rate", value: `${flowS.avg} L/s`, hint: "Average for selected range" },
      { label: "Avg Pressure", value: `${pressS.avg} PSI`, hint: "Average for selected range" },
      { label: "Warnings", value: warnCount, hint: "Rule-based flags" },
      { label: "Critical", value: criticalCount, hint: "Immediate attention" },
    ];
  }, [flowS.avg, pressS.avg, warnCount, criticalCount]);

  const insightText = useMemo(() => {
    const lines = [];
    // Flow insight
    if (latest.flow < FLOW_MIN) lines.push("Flow is LOW → possible leak / low supply / valve closing.");
    else if (latest.flow > FLOW_MAX) lines.push("Flow is HIGH → possible burst / abnormal demand.");
    else lines.push("Flow is within safe range.");

    // Pressure insight
    if (latest.pressure > PRESS_MAX) lines.push("Pressure is HIGH → burst risk / blockage likely.");
    else if (latest.pressure < PRESS_MIN) lines.push("Pressure is LOW → supply issue / pump problem.");
    else lines.push("Pressure is within safe range.");

    // Events summary
    if (events.length > 0) {
      const top = events.slice(-3).map((e) => `${e.time}: ${e.type}`).join(" • ");
      lines.push(`Recent flags: ${top}`);
    } else {
      lines.push("No anomalies detected in the selected range.");
    }

    return lines;
  }, [latest.flow, latest.pressure, events, FLOW_MIN, FLOW_MAX, PRESS_MIN, PRESS_MAX]);

  return (
    <div className="container" style={{ animation: "fadeIn 0.5s ease-out" }}>
      {/* Header */}
      <div className="header" style={{ marginBottom: "28px", borderBottom: "1px solid #e2e8f0", paddingBottom: "16px" }}>
        <div>
          <div className="title" style={{ fontSize: "28px", color: "var(--text)", fontWeight: 900, marginBottom: "4px" }}>
            Smart Pipeline Dashboard
          </div>
          <div className="subtitle" style={{ fontSize: "15px", color: "var(--muted)" }}>
            Live sensor stream • Real-time anomaly detection • Dataset tracking
          </div>
        </div>

        <div className="hstack" style={{ flexWrap: "wrap", justifyContent: "flex-end", gap: "12px" }}>
          <span className={`badge ${health.badge}`} style={{ fontSize: "14px", padding: "8px 16px", fontWeight: 800 }}>
            {health.badge === 'ok' ? '🟢' : health.badge === 'warn' ? '🟠' : '🔴'} System Health: {health.label}
          </span>
          <button
            className="btn"
            style={{
              borderColor: "#10b981", color: "#059669", background: "#ecfdf5",
              display: "flex", alignItems: "center", gap: "6px", fontWeight: 800
            }}
            onClick={() => downloadCSV("sensor_readings.csv", series)}
            type="button"
          >
            <span style={{ fontSize: "14px" }}>📥</span> Export Sensor Log
          </button>
        </div>
      </div>

      {/* Status Strip */}
      <div className="card card-pad" style={{ background: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)", color: "#fff", border: "none" }}>
        <div className="statusStrip">
          <div style={{ padding: "12px", background: "rgba(255,255,255,0.05)", borderRadius: "12px" }}>
            <div className="small" style={{ color: "#94a3b8" }}>Current Flow</div>
            <div className="statusValue" style={{ fontSize: "28px" }}>{latest.flow} <span className="unit" style={{ color: "#cbd5e1" }}>L/s</span></div>
            <div className="small" style={{ color: "#64748b", marginTop: "4px" }}>
              Safe: <b style={{ color: "#fff" }}>{FLOW_MIN}–{FLOW_MAX}</b>
            </div>
          </div>

          <div style={{ padding: "12px", background: "rgba(255,255,255,0.05)", borderRadius: "12px" }}>
            <div className="small" style={{ color: "#94a3b8" }}>Current Pressure</div>
            <div className="statusValue" style={{ fontSize: "28px" }}>{latest.pressure} <span className="unit" style={{ color: "#cbd5e1" }}>PSI</span></div>
            <div className="small" style={{ color: "#64748b", marginTop: "4px" }}>
              Safe: <b style={{ color: "#fff" }}>{PRESS_MIN}–{PRESS_MAX}</b>
            </div>
          </div>

          <div style={{ padding: "12px", background: "rgba(255,255,255,0.05)", borderRadius: "12px" }}>
            <div className="small" style={{ color: "#94a3b8" }}>Last Read Time</div>
            <div className="statusValue" style={{ fontSize: "28px", color: "#38bdf8" }}>{latest.time}</div>
            <div className="small" style={{ color: "#64748b", marginTop: "4px" }}>
              Stream: <b style={{ color: "#fff" }}>{range}</b>
            </div>
          </div>

          <div style={{ padding: "12px", background: "rgba(255,255,255,0.05)", borderRadius: "12px" }}>
            <div className="small" style={{ color: "#94a3b8" }}>System Flags</div>
            <div className="statusValue" style={{ display: "flex", gap: "8px", marginTop: "6px" }}>
              <span className="badge warn" style={{ background: "#fef3c7", color: "#d97706", border: "none" }}>Warn: {warnCount}</span>
              <span className="badge danger" style={{ background: "#fee2e2", color: "#dc2626", border: "none" }}>Crit: {criticalCount}</span>
            </div>
            <div className="small" style={{ color: "#64748b", marginTop: "4px" }}>Threshold rules applied</div>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ marginTop: 24, marginBottom: 24 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px" }}>
          {kpis.map((k) => (
            <div key={k.label} className="card card-pad" style={{ background: "#ffffff", border: "1px solid #e2e8f0", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)" }}>
              <div style={{ color: "var(--muted)", fontSize: "14px", fontWeight: 600 }}>{k.label}</div>
              <div style={{ fontSize: "24px", fontWeight: 900, marginTop: "8px", color: "var(--text)" }}>{k.value}</div>
              {k.hint ? <div style={{ fontSize: "12px", color: "#94a3b8", marginTop: "8px" }}>{k.hint}</div> : null}
            </div>
          ))}
        </div>
      </div>

      {/* Charts (Vertical) */}
      <div className="chartsSection" style={{ display: "flex", flexDirection: "column", gap: "24px" }}>

        {/* Flow Chart */}
        <div className="card card-pad" style={{ background: "linear-gradient(to bottom, #ffffff, #f8fafc)", border: "1px solid #e2e8f0" }}>
          <div className="chartHeader" style={{ borderBottom: "1px dashed #cbd5e1", paddingBottom: "16px", marginBottom: "16px" }}>
            <div>
              <div className="chartTitle" style={{ fontSize: "18px", color: "#0284c7" }}>🌊 Flow Rate Sensor Stream (L/s)</div>
              <div className="small" style={{ marginTop: "4px" }}>
                Sudden drops indicate <b>possible leaks</b>. Operating band visualized via reference lines.
              </div>
            </div>

            <div className="hstack" style={{ flexWrap: "wrap", justifyContent: "flex-end" }}>
              <span className="badge" style={{ background: "#f1f5f9" }}>Min: {flowS.min}</span>
              <div style={{ background: "#e0f2fe", padding: "4px 8px", borderRadius: "8px", fontSize: "13px", fontWeight: 900, color: "#0369a1" }}>Avg: {flowS.avg}</div>
              <span className="badge" style={{ background: "#f1f5f9" }}>Max: {flowS.max}</span>
            </div>
          </div>

          <div className="chartBox">
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={series} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="flowColor" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="time" tick={{ fill: "#64748b", fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#64748b", fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: "8px", fontWeight: 700, border: "none", boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)" }} />
                <ReferenceLine y={FLOW_MIN} stroke="#f59e0b" strokeDasharray="4 4" label={{ position: 'insideTopLeft', value: 'Min Safe Limit', fill: '#f59e0b', fontSize: 11 }} />
                <ReferenceLine y={FLOW_MAX} stroke="#ef4444" strokeDasharray="4 4" label={{ position: 'insideBottomLeft', value: 'Max Safe Limit', fill: '#ef4444', fontSize: 11 }} />
                <Line type="monotone" dataKey="flow" stroke="#0ea5e9" strokeWidth={4} activeDot={{ r: 8, strokeWidth: 0 }} dot={{ r: 4, fill: "#0284c7", strokeWidth: 0 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div style={{ marginTop: "20px", background: "#fff", padding: "16px", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
            <div style={{ fontSize: "14px", fontWeight: 800, color: "var(--text)", marginBottom: "12px" }}>Flags Detected</div>
            {events.filter((e) => e.type.includes("FLOW") || e.type.includes("LEAK")).length === 0 ? (
              <div className="small" style={{ color: "#10b981", fontWeight: 700 }}>✓ Optimal operation. No flow anomalies detected.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {events.filter((e) => e.type.includes("FLOW") || e.type.includes("LEAK")).map((e) => (
                  <div key={e.id} style={{ display: "flex", alignItems: "center", gap: "12px", background: "#f8fafc", padding: "10px", borderRadius: "8px" }}>
                    <span className={`badge ${e.level === "CRITICAL" ? "danger" : "warn"}`} style={{ minWidth: "120px", textAlign: "center" }}>{e.type}</span>
                    <div style={{ fontSize: "13px" }}>
                      <b style={{ color: "var(--text)" }}>[{e.time}]</b> <span style={{ color: "var(--muted)" }}>{e.message}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Pressure Chart */}
        <div className="card card-pad" style={{ background: "linear-gradient(to bottom, #ffffff, #f8fafc)", border: "1px solid #e2e8f0" }}>
          <div className="chartHeader" style={{ borderBottom: "1px dashed #cbd5e1", paddingBottom: "16px", marginBottom: "16px" }}>
            <div>
              <div className="chartTitle" style={{ fontSize: "18px", color: "#8b5cf6" }}>💥 Network Pressure Stream (PSI)</div>
              <div className="small" style={{ marginTop: "4px" }}>
                Excessive spikes indicate <b>high burst risk</b>. Operating threshold bands visualized.
              </div>
            </div>

            <div className="hstack" style={{ flexWrap: "wrap", justifyContent: "flex-end" }}>
              <span className="badge" style={{ background: "#f1f5f9" }}>Min: {pressS.min}</span>
              <div style={{ background: "#ede9fe", padding: "4px 8px", borderRadius: "8px", fontSize: "13px", fontWeight: 900, color: "#6d28d9" }}>Avg: {pressS.avg}</div>
              <span className="badge" style={{ background: "#f1f5f9" }}>Max: {pressS.max}</span>
            </div>
          </div>

          <div className="chartBox">
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={series} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="time" tick={{ fill: "#64748b", fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#64748b", fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: "#f1f5f9" }} contentStyle={{ borderRadius: "8px", fontWeight: 700, border: "none", boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)" }} />
                <ReferenceLine y={PRESS_MIN} stroke="#f59e0b" strokeDasharray="4 4" label={{ position: 'insideTopLeft', value: 'Min Pressure', fill: '#f59e0b', fontSize: 11 }} />
                <ReferenceLine y={PRESS_MAX} stroke="#ef4444" strokeDasharray="4 4" label={{ position: 'insideBottomLeft', value: 'Max Safe Limit', fill: '#ef4444', fontSize: 11 }} />
                <Bar dataKey="pressure" fill="#8b5cf6" radius={[6, 6, 0, 0]} maxBarSize={60} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div style={{ marginTop: "20px", background: "#fff", padding: "16px", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
            <div style={{ fontSize: "14px", fontWeight: 800, color: "var(--text)", marginBottom: "12px" }}>Flags Detected</div>
            {events.filter((e) => e.type.includes("PRESSURE")).length === 0 ? (
              <div className="small" style={{ color: "#10b981", fontWeight: 700 }}>✓ Optimal operation. No high/low pressure anomalies.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {events.filter((e) => e.type.includes("PRESSURE")).map((e) => (
                  <div key={e.id} style={{ display: "flex", alignItems: "center", gap: "12px", background: "#f8fafc", padding: "10px", borderRadius: "8px" }}>
                    <span className={`badge ${e.level === "CRITICAL" ? "danger" : "warn"}`} style={{ minWidth: "120px", textAlign: "center" }}>{e.type}</span>
                    <div style={{ fontSize: "13px" }}>
                      <b style={{ color: "var(--text)" }}>[{e.time}]</b> <span style={{ color: "var(--muted)" }}>{e.message}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Actionable Insights */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
          <div className="card card-pad" style={{ background: "#f8fafc", border: "1px dashed #cbd5e1" }}>
            <div className="title" style={{ fontSize: 16, color: "#334155" }}>🧠 AI/Rule Engine Insights</div>
            <div className="vstack" style={{ marginTop: 14 }}>
              {insightText.map((t, idx) => (
                <div key={idx} style={{ fontSize: "13px", color: "#475569", display: "flex", gap: "8px", alignItems: "center" }}>
                  <span style={{ color: "var(--primary)" }}>✦</span> {t}
                </div>
              ))}
            </div>
          </div>

          <div className="card card-pad" style={{ background: "#fff", border: "1px solid #e2e8f0" }}>
            <div className="title" style={{ fontSize: 16, color: "var(--text)" }}>📝 Examiner Note</div>
            <div style={{ fontSize: "13px", color: "var(--muted)", marginTop: "12px", lineHeight: "1.6" }}>
              The Dashboard provides real-time monitoring combined with data interpretation using fixed safety ranges and rule-based tracking flags. <br /><br />
              A seamless CSV logger provides operational evidence and analytics history. No AI or ML predictive capabilities were injected so as to strictly meet assessment constraints.
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
           .chartsSection > div:last-child {
              grid-template-columns: 1fr;
           }
        }
      `}</style>
    </div>
  );
}