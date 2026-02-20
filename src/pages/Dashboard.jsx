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
    <div className="container">
      {/* Header */}
      <div className="header">
        <div>
          <div className="title">Smart Water Pipeline Dashboard</div>
          <div className="subtitle">
            Live monitoring (demo sensor stream) • Rule-based interpretation • No AI/ML
          </div>
        </div>

        <div className="hstack" style={{ flexWrap: "wrap", justifyContent: "flex-end" }}>
          <span className={`badge ${health.badge}`}>System Health: {health.label}</span>
          <button className="btn" onClick={() => downloadCSV("sensor_readings.csv", series)} type="button">
            Download CSV
          </button>
        </div>
      </div>

      {/* Status Strip (Meaning first) */}
      <div className="card card-pad">
        <div className="statusStrip">
          <div>
            <div className="small">Now Flow</div>
            <div className="statusValue">{latest.flow} <span className="unit">L/s</span></div>
            <div className="small">
              Safe: <b>{FLOW_MIN}–{FLOW_MAX}</b>
            </div>
          </div>

          <div>
            <div className="small">Now Pressure</div>
            <div className="statusValue">{latest.pressure} <span className="unit">PSI</span></div>
            <div className="small">
              Safe: <b>{PRESS_MIN}–{PRESS_MAX}</b>
            </div>
          </div>

          <div>
            <div className="small">Last Updated</div>
            <div className="statusValue">{latest.time}</div>
            <div className="small">Range: <b>{range}</b></div>
          </div>

          <div>
            <div className="small">Flags</div>
            <div className="statusValue">
              <span className="badge warn">Warn {warnCount}</span>{" "}
              <span className="badge danger">Critical {criticalCount}</span>
            </div>
            <div className="small">Threshold rules</div>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ marginTop: 12 }}>
        <KPIGrid kpis={kpis} />
      </div>

      {/* Charts (Vertical) */}
      <div className="chartsSection">
        <div className="vstack">
          {/* Flow Chart */}
          <div className="card card-pad">
            <div className="chartHeader">
              <div>
                <div className="chartTitle">Flow Rate (L/s)</div>
                <div className="small">
                  Meaning: sudden drop → <b>possible leak</b>. Safe band shown by reference lines.
                </div>
              </div>

              <div className="hstack" style={{ flexWrap: "wrap", justifyContent: "flex-end" }}>
                <span className="badge">Min {flowS.min}</span>
                <span className="badge">Avg {flowS.avg}</span>
                <span className="badge">Max {flowS.max}</span>
              </div>
            </div>

            <div className="chartBox">
              <ResponsiveContainer width="100%" height={360}>
                <LineChart data={series}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <ReferenceLine y={FLOW_MIN} strokeDasharray="4 4" />
                  <ReferenceLine y={FLOW_MAX} strokeDasharray="4 4" />

                  <Line type="monotone" dataKey="flow" strokeWidth={3} dot />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Flow Events */}
            <div className="eventList">
              <div className="eventTitle">Detected Events</div>
              {events.filter((e) => e.type.includes("FLOW") || e.type.includes("LEAK")).length === 0 ? (
                <div className="small">No flow-related events.</div>
              ) : (
                events
                  .filter((e) => e.type.includes("FLOW") || e.type.includes("LEAK"))
                  .slice(-4)
                  .map((e) => (
                    <div key={e.id} className="eventRow">
                      <span className={`badge ${e.level === "CRITICAL" ? "danger" : "warn"}`}>
                        {e.type}
                      </span>
                      <div className="small">
                        <b>{e.time}</b> • {e.message}
                      </div>
                    </div>
                  ))
              )}
            </div>
          </div>

          {/* Pressure Chart */}
          <div className="card card-pad">
            <div className="chartHeader">
              <div>
                <div className="chartTitle">Pressure (PSI)</div>
                <div className="small">
                  Meaning: high pressure → <b>burst risk</b>. Safe band shown by reference lines.
                </div>
              </div>

              <div className="hstack" style={{ flexWrap: "wrap", justifyContent: "flex-end" }}>
                <span className="badge">Min {pressS.min}</span>
                <span className="badge">Avg {pressS.avg}</span>
                <span className="badge">Max {pressS.max}</span>
              </div>
            </div>

            <div className="chartBox">
              <ResponsiveContainer width="100%" height={360}>
                <BarChart data={series}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <ReferenceLine y={PRESS_MIN} strokeDasharray="4 4" />
                  <ReferenceLine y={PRESS_MAX} strokeDasharray="4 4" />
                  <Bar dataKey="pressure" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Pressure Events */}
            <div className="eventList">
              <div className="eventTitle">Detected Events</div>
              {events.filter((e) => e.type.includes("PRESSURE")).length === 0 ? (
                <div className="small">No pressure-related events.</div>
              ) : (
                events
                  .filter((e) => e.type.includes("PRESSURE"))
                  .slice(-4)
                  .map((e) => (
                    <div key={e.id} className="eventRow">
                      <span className={`badge ${e.level === "CRITICAL" ? "danger" : "warn"}`}>
                        {e.type}
                      </span>
                      <div className="small">
                        <b>{e.time}</b> • {e.message}
                      </div>
                    </div>
                  ))
              )}
            </div>
          </div>

          {/* Insights box */}
          <div className="card card-pad">
            <div className="title" style={{ fontSize: 14 }}>Quick Insights (What this means)</div>
            <div className="vstack" style={{ marginTop: 10 }}>
              {insightText.map((t, idx) => (
                <div key={idx} className="small">• {t}</div>
              ))}
            </div>
          </div>

          {/* Examiner Note */}
          <div className="card card-pad">
            <div className="title" style={{ fontSize: 14 }}>Examiner Note</div>
            <div className="small" style={{ marginTop: 6 }}>
              “Dashboard provides monitoring + interpretation using fixed safe ranges and rule-based flags. 
              CSV download provides evidence/history for reports. No AI/ML predictions are used.”
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}