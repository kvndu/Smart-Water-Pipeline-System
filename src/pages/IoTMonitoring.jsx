import { useEffect, useState, useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../utils/supabaseClient";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  Activity,
  ShieldCheck,
  AlertOctagon,
  Clock,
  Info,
  Droplets,
  LayoutGrid,
  WifiOff,
} from "lucide-react";

const UPDATE_INTERVAL = 3000;

export default function IoTMonitoring() {
  const [sensor1, setSensor1] = useState(0);
  const [sensor2, setSensor2] = useState(0);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(new Date());

  // AI Alert states
  const [aiAlerts, setAiAlerts] = useState([]);
  const [alertLoading, setAlertLoading] = useState(false);
  const prevLeakRef = useRef(false);

  // FIX 1: System online - inlet flow > 2 නම් system on
  const systemOnline = useMemo(() => sensor1 > 2, [sensor1]);

  // FIX 2: 20% difference threshold - fixed value 8 නෙවෙයි
  const isLeak = useMemo(() => {
    if (!systemOnline) return false;
    const diff = sensor1 - sensor2;
    return diff > sensor1 * 0.2;
  }, [sensor1, sensor2, systemOnline]);

  // AI Alert function
  async function sendAIAlert(flow1, flow2) {
    setAlertLoading(true);
    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          messages: [
            {
              role: "user",
              content: `Water pipe leak detected in IoT monitoring system.
Inlet flow (Sensor 1): ${flow1.toFixed(1)} mL/s
Outlet flow (Sensor 2): ${flow2.toFixed(1)} mL/s
Flow loss: ${(flow1 - flow2).toFixed(1)} mL/s (${(((flow1 - flow2) / flow1) * 100).toFixed(0)}%)

Give a SHORT alert (2-3 sentences only) with:
1. Severity level: LOW / MEDIUM / HIGH
2. Likely cause
3. Immediate action needed`,
            },
          ],
        }),
      });
      const data = await response.json();
      const message = data.content[0].text;

      setAiAlerts((prev) =>
        [
          {
            id: Date.now(),
            time: new Date().toLocaleTimeString(),
            flow1,
            flow2,
            loss: flow1 - flow2,
            message,
          },
          ...prev,
        ].slice(0, 10)
      );
    } catch (err) {
      console.error("AI Alert error:", err);
    }
    setAlertLoading(false);
  }

  useEffect(() => {
    async function fetchData() {
      try {
        const { data, error: fetchError } = await supabase
          .from("sensor_readings")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(1);

        if (fetchError) throw fetchError;
        if (!data || data.length === 0) {
          setLoading(false);
          return;
        }

        const v0 = Number(data[0].flow_rate_inlet || 0);
        const v1 = Number(data[0].flow_rate_outlet || 0);

        setSensor1(v0);
        setSensor2(v1);
        setLastUpdate(new Date(data[0].created_at));

        setHistory((prev) => {
          const newPoint = {
            time: new Date().toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            }),
            flow1: v0,
            flow2: v1,
          };
          const updated = [...prev, newPoint];
          if (updated.length > 20) return updated.slice(1);
          return updated;
        });

        setLoading(false);
        setError(null);

        // FIX 3: Leak state change වෙද්දී AI alert trigger
        const currentlyLeaking = v0 > 2 && (v0 - v1) > v0 * 0.2;
        if (currentlyLeaking && !prevLeakRef.current) {
          sendAIAlert(v0, v1);
        }
        prevLeakRef.current = currentlyLeaking;

      } catch (err) {
        console.error("IoT Fetch Error:", err);
        setError("Failed to retrieve live sensor data. Please check your database connection.");
      }
    }

    fetchData();
    const interval = setInterval(fetchData, UPDATE_INTERVAL);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="iotPage">
      {/* HERO */}
      <div className="iotHero">
        <div style={{ display: "flex", alignItems: "center", gap: "24px" }}>
          <div className="heroIconContainer">
            <img src="/logos/iot_sensor.png" alt="IoT Sensor" />
            <div className="pulseRing"></div>
          </div>
          <div>
            <div className="iotEyebrow">
              <span className="liveBadge">LIVE DATA</span>
              Pipeline Monitor
            </div>
            <h1>Water Flow Monitoring System</h1>
            <p className="iotSubtitle">
              Monitoring active water flow rates from ESP32 edge device
              <span
                className={`statusDot ${
                  loading ? "syncing" : systemOnline ? "online" : "offline"
                }`}
              ></span>
              {loading
                ? "Establishing Connection..."
                : systemOnline
                ? "Connected"
                : "System Offline"}
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="iotError">
          <div className="errorIcon">
            <AlertOctagon size={32} color="#dc2626" />
          </div>
          <div>
            <h3>Connection Warning</h3>
            <p>{error}</p>
          </div>
        </div>
      )}

      {/* FIX 4: System offline screen */}
      {!systemOnline && !loading ? (
        <div className="iotPanel offlinePanel">
          <WifiOff size={48} color="#94a3b8" />
          <h2>System Offline</h2>
          <p>No water flow detected. Turn on the pump to begin monitoring.</p>
        </div>
      ) : (
        <>
          {/* MAIN GRID */}
          <div className="iotMainGrid">
            {/* GAUGE 1 */}
            <div className="iotPanel gaugePanel">
              <div className="panelHead">
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <div className="panelIcon inlet">
                    <Droplets size={16} />
                  </div>
                  <h2>Inlet Flow Sensor</h2>
                </div>
                <span className="pinBadge">PIN V0</span>
              </div>
              <div className="gaugeContainer">
                <Gauge value={sensor1} max={25} label="mL/S" color="#0ea5e9" />
              </div>
              <div className="sensorMeta">
                <div className="metaItem">
                  <span>Operational Status</span>
                  <strong style={{ color: "#10b981" }}>OPTIMAL</strong>
                </div>
                <div className="metaItem">
                  <span>Hardware ID</span>
                  <strong>YF-S201-A</strong>
                </div>
              </div>
            </div>

            {/* SCHEMATIC */}
            <div className="iotPanel schematicPanel">
              <div className="panelHead">
                <h2>Flow Schematic</h2>
                <LayoutGrid size={16} color="#94a3b8" />
              </div>
              <div className="schematicContainer">
                <div className="pipeLine">
                  <div
                    className="flowIndicator"
                    style={{ animationDuration: `${2 - sensor1 / 15}s` }}
                  ></div>
                </div>
                <div className="schematicNodes">
                  <div className={`sNode ${sensor1 > 2 ? "active" : ""}`}>
                    <div className="nodeLabel">SENSOR 01</div>
                  </div>
                  <div className="pipeConnect"></div>
                  <div className={`sNode ${sensor2 > 2 ? "active" : ""}`}>
                    <div className="nodeLabel">SENSOR 02</div>
                  </div>
                </div>
                {isLeak && <div className="leakMark">FAULT DETECTED</div>}
              </div>
              <div className="schematicLegend">
                <span>
                  <Info size={12} /> Logical mapping of physical pipe segments.
                </span>
              </div>
            </div>

            {/* GAUGE 2 */}
            <div className="iotPanel gaugePanel">
              <div className="panelHead">
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <div className="panelIcon outlet">
                    <Droplets size={16} />
                  </div>
                  <h2>Outlet Flow Sensor</h2>
                </div>
                <span className="pinBadge">PIN V1</span>
              </div>
              <div className="gaugeContainer">
                <Gauge value={sensor2} max={25} label="mL/S" color="#6366f1" />
              </div>
              <div className="sensorMeta">
                <div className="metaItem">
                  <span>Operational Status</span>
                  <strong style={{ color: "#10b981" }}>OPTIMAL</strong>
                </div>
                <div className="metaItem">
                  <span>Hardware ID</span>
                  <strong>YF-S201-B</strong>
                </div>
              </div>
            </div>
          </div>

          {/* LEAK STATUS */}
          <div className="iotBottomGrid">
            <div className={`iotPanel integrityPanel ${isLeak ? "detected" : ""}`}>
              <div className="panelHead">
                <h2>Leak Detection Status</h2>
                <ShieldCheck size={18} />
              </div>
              <div className="integrityContent">
                {isLeak ? (
                  <div className="leakDetected">
                    <div
                      style={{
                        display: "flex",
                        gap: "24px",
                        alignItems: "center",
                        textAlign: "left",
                      }}
                    >
                      <div className="leakIcon">
                        <img src="/logos/leak_warning.png" alt="Leak Warning" />
                      </div>
                      <div>
                        <h3>Leakage Detected</h3>
                        <p>
                          Flow differential exceeds safe threshold (
                          {(sensor1 - sensor2).toFixed(1)} mL/S loss —{" "}
                          {(((sensor1 - sensor2) / sensor1) * 100).toFixed(0)}%).
                        </p>
                        <div className="leakTags">
                          <span className="tag danger">Warning</span>
                        </div>
                      </div>
                      <Link to="/alerts" className="leakActionBtn">
                        View Alerts
                      </Link>
                    </div>
                  </div>
                ) : (
                  <div className="leakSafe">
                    <div
                      style={{
                        display: "flex",
                        gap: "20px",
                        alignItems: "center",
                        textAlign: "left",
                      }}
                    >
                      <div className="safeIcon">
                        <ShieldCheck size={48} color="#10b981" />
                      </div>
                      <div style={{ flex: 1 }}>
                        <h3>No Leaks Detected</h3>
                        <p>
                          Active monitoring confirms zero leakage across monitored
                          segments.
                        </p>
                        <div className="safeProgress">
                          <div className="safeBar" style={{ width: "100%" }}></div>
                        </div>
                      </div>
                      <div className="integrityScore">
                        <span>STATUS</span>
                        <strong>Normal</strong>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* CHART */}
          <div className="iotPanel chartPanel">
            <div className="panelHead">
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <Activity size={18} />
                <h2>Live Flow Velocity Trend</h2>
              </div>
              <div className="iotTimeBox">
                <div className="timeLabel">
                  <Clock size={12} style={{ marginRight: "6px" }} /> Last Synchronized
                </div>
                <div className="timeValue">{lastUpdate.toLocaleTimeString()}</div>
              </div>
            </div>
            <div className="chartContainer">
              <ResponsiveContainer width="100%" height={320}>
                <AreaChart data={history}>
                  <defs>
                    <linearGradient id="colorFlow1" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorFlow2" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="#f1f5f9"
                  />
                  <XAxis
                    dataKey="time"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#94a3b8", fontSize: 11 }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#94a3b8", fontSize: 11 }}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: "14px",
                      border: "none",
                      boxShadow: "0 10px 30px rgba(0,0,0,0.1)",
                      padding: "12px",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="flow1"
                    stroke="#0ea5e9"
                    strokeWidth={4}
                    fillOpacity={1}
                    fill="url(#colorFlow1)"
                    name="Inlet"
                  />
                  <Area
                    type="monotone"
                    dataKey="flow2"
                    stroke="#6366f1"
                    strokeWidth={4}
                    fillOpacity={1}
                    fill="url(#colorFlow2)"
                    name="Outlet"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* FIX 5: AI Alert Log */}
          {(aiAlerts.length > 0 || alertLoading) && (
            <div className="iotPanel" style={{ marginTop: "24px" }}>
              <div className="panelHead">
                <h2>AI Leak Analysis Log</h2>
                {alertLoading && (
                  <span style={{ fontSize: "13px", color: "#f59e0b", fontWeight: 700 }}>
                    Analyzing...
                  </span>
                )}
              </div>
              {aiAlerts.map((alert) => (
                <div
                  key={alert.id}
                  style={{
                    background: "#fef2f2",
                    border: "1px solid #fecaca",
                    borderRadius: "12px",
                    padding: "16px",
                    marginBottom: "12px",
                  }}
                >
                  <div
                    style={{
                      fontSize: "12px",
                      color: "#94a3b8",
                      marginBottom: "8px",
                      fontWeight: 700,
                    }}
                  >
                    {alert.time} &nbsp;|&nbsp; Inlet: {alert.flow1.toFixed(1)} mL/s
                    &nbsp;|&nbsp; Outlet: {alert.flow2.toFixed(1)} mL/s &nbsp;|&nbsp;
                    Loss: {alert.loss.toFixed(1)} mL/s
                  </div>
                  <p
                    style={{
                      margin: 0,
                      color: "#991b1b",
                      fontSize: "14px",
                      fontWeight: 600,
                      lineHeight: 1.6,
                    }}
                  >
                    {alert.message}
                  </p>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <style>{`
        .iotPage {
          padding: 32px;
          max-width: 1800px;
          margin: 0 auto;
          animation: fadeIn 0.4s ease;
        }
        .iotHero {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 40px;
          background: white;
          padding: 32px;
          border-radius: 30px;
          border: 1px solid #e2e8f0;
          box-shadow: 0 10px 30px rgba(0,0,0,0.03);
        }
        .heroIconContainer {
          position: relative;
          width: 90px;
          height: 90px;
        }
        .heroIconContainer img {
          width: 100%;
          height: 100%;
          border-radius: 24px;
          position: relative;
          z-index: 2;
          box-shadow: 0 10px 25px rgba(0,0,0,0.1);
        }
        .pulseRing {
          position: absolute;
          top: 0; left: 0; right: 0; bottom: 0;
          border-radius: 24px;
          background: rgba(14, 165, 233, 0.2);
          animation: heroPulse 2s infinite;
          z-index: 1;
        }
        @keyframes heroPulse {
          0% { transform: scale(1); opacity: 0.8; }
          100% { transform: scale(1.4); opacity: 0; }
        }
        .iotEyebrow {
          display: flex;
          align-items: center;
          gap: 12px;
          color: #64748b;
          font-size: 14px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 1px;
          margin-bottom: 8px;
        }
        .liveBadge {
          background: #ef4444;
          color: white;
          font-size: 10px;
          padding: 3px 8px;
          border-radius: 4px;
          animation: blink 1s infinite;
        }
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        .iotSubtitle {
          margin: 8px 0 0;
          color: #64748b;
          display: flex;
          align-items: center;
          gap: 10px;
          font-weight: 600;
        }
        .statusDot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
        }
        .statusDot.online { background: #10b981; box-shadow: 0 0 10px #10b981; }
        .statusDot.syncing { background: #f59e0b; animation: pulse 1s infinite; }
        .statusDot.offline { background: #94a3b8; }
        @keyframes pulse {
          0% { opacity: 1; }
          50% { opacity: 0.3; }
          100% { opacity: 1; }
        }
        .offlinePanel {
          text-align: center;
          padding: 60px 32px;
          color: #94a3b8;
          margin-bottom: 24px;
        }
        .offlinePanel h2 { color: #64748b; margin: 16px 0 8px; font-size: 22px; }
        .offlinePanel p { color: #94a3b8; font-size: 15px; }
        .iotMainGrid {
          display: grid;
          grid-template-columns: 1fr 1.5fr 1fr;
          gap: 24px;
          margin-bottom: 24px;
        }
        .iotPanel {
          background: white;
          border-radius: 28px;
          padding: 24px;
          border: 1px solid #e2e8f0;
          box-shadow: 0 15px 35px rgba(0,0,0,0.05);
          transition: transform 0.3s ease, box-shadow 0.3s ease;
        }
        .iotPanel:hover {
          transform: translateY(-5px);
          box-shadow: 0 20px 45px rgba(0,0,0,0.08);
        }
        .panelHead {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }
        .panelHead h2 {
          font-size: 18px;
          margin: 0;
          color: #334155;
          font-weight: 800;
        }
        .panelIcon {
          width: 36px;
          height: 36px;
          border-radius: 10px;
          display: grid;
          place-items: center;
        }
        .panelIcon.inlet { background: #e0f2fe; color: #0ea5e9; }
        .panelIcon.outlet { background: #e0e7ff; color: #6366f1; }
        .pinBadge {
          background: #f1f5f9;
          color: #64748b;
          font-size: 10px;
          font-weight: 900;
          padding: 4px 8px;
          border-radius: 6px;
        }
        .gaugeContainer {
          display: flex;
          justify-content: center;
          padding: 20px 0;
        }
        .sensorMeta {
          margin-top: 20px;
          display: grid;
          gap: 12px;
          border-top: 1px solid #f1f5f9;
          padding-top: 20px;
        }
        .metaItem {
          display: flex;
          justify-content: space-between;
          font-size: 14px;
        }
        .metaItem span { color: #94a3b8; font-weight: 600; }
        .metaItem strong { color: #1e293b; }
        .schematicPanel { background: #0f172a !important; color: white !important; }
        .schematicPanel h2 { color: #f8fafc !important; }
        .schematicContainer {
          height: 200px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          position: relative;
          overflow: hidden;
        }
        .pipeLine {
          width: 80%;
          height: 40px;
          background: #1e293b;
          border: 2px solid #334155;
          border-radius: 10px;
          position: relative;
          overflow: hidden;
        }
        .flowIndicator {
          position: absolute;
          top: 0; left: 0; bottom: 0;
          width: 200%;
          background: repeating-linear-gradient(90deg, transparent, transparent 20px, #38bdf8 20px, #38bdf8 40px);
          animation: flowMove linear infinite;
        }
        @keyframes flowMove {
          from { transform: translateX(0); }
          to { transform: translateX(-40px); }
        }
        .schematicNodes {
          position: absolute;
          width: 90%;
          display: flex;
          justify-content: space-between;
          z-index: 3;
        }
        .sNode {
          width: 24px;
          height: 24px;
          background: #334155;
          border: 3px solid #0f172a;
          border-radius: 50%;
          position: relative;
        }
        .sNode.active { background: #38bdf8; box-shadow: 0 0 15px #38bdf8; }
        .nodeLabel {
          position: absolute;
          top: -25px;
          left: 50%;
          transform: translateX(-50%);
          font-size: 10px;
          font-weight: 950;
          white-space: nowrap;
          color: #94a3b8;
        }
        .leakMark {
          position: absolute;
          background: #ef4444;
          color: white;
          padding: 4px 10px;
          border-radius: 6px;
          font-size: 11px;
          font-weight: 950;
          animation: blink 0.5s infinite;
        }
        .schematicLegend {
          margin-top: 20px;
          font-size: 12px;
          color: #475569;
          text-align: center;
        }
        .iotBottomGrid { margin-bottom: 24px; }
        .integrityPanel { background: white; padding: 28px; }
        .integrityPanel.detected {
          background: linear-gradient(135deg, #fff5f5, #ffffff);
          border-color: #fecaca;
        }
        .integrityContent { margin-top: 10px; }
        .leakDetected { text-align: center; }
        .leakIcon img { width: 80px; height: 80px; }
        .leakDetected h3 { font-size: 24px; color: #dc2626; margin: 0; font-weight: 900; }
        .leakDetected p { color: #991b1b; font-size: 14px; margin: 10px 0 20px; font-weight: 600; }
        .leakTags { display: flex; gap: 10px; margin-top: 12px; }
        .tag { font-size: 10px; font-weight: 900; padding: 4px 10px; border-radius: 6px; }
        .tag.danger { background: #fee2e2; color: #b91c1c; }
        .leakActionBtn {
          display: inline-block;
          background: #dc2626;
          color: white;
          text-decoration: none;
          padding: 12px 24px;
          border-radius: 12px;
          font-weight: 900;
          box-shadow: 0 8px 20px rgba(220,38,38,0.25);
        }
        .leakSafe { text-align: center; }
        .leakSafe h3 { font-size: 24px; color: #059669; margin: 0; font-weight: 900; }
        .leakSafe p { color: #065f46; font-size: 14px; margin: 10px 0 25px; font-weight: 600; }
        .safeProgress { height: 8px; background: #ecfdf5; border-radius: 999px; overflow: hidden; }
        .safeBar { height: 100%; background: #10b981; }
        .integrityScore { text-align: right; background: #f8fafc; padding: 12px 20px; border-radius: 16px; }
        .integrityScore span { display: block; font-size: 10px; color: #94a3b8; font-weight: 800; }
        .integrityScore strong { display: block; font-size: 20px; color: #10b981; font-weight: 950; }
        .chartPanel { grid-column: span 3; }
        .chartContainer { margin-top: 30px; }
        .iotError {
          background: #fef2f2;
          border: 1px solid #fecaca;
          padding: 20px;
          border-radius: 20px;
          display: flex;
          gap: 20px;
          align-items: center;
          margin-bottom: 32px;
        }
        .iotError h3 { margin: 0; color: #991b1b; }
        .iotError p { margin: 5px 0 0; color: #b91c1c; font-weight: 600; }
        .iotTimeBox { text-align: right; }
        .timeLabel {
          display: flex;
          align-items: center;
          font-size: 11px;
          color: #94a3b8;
          font-weight: 700;
          text-transform: uppercase;
        }
        .timeValue { font-size: 14px; font-weight: 800; color: #334155; }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @media (max-width: 1100px) {
          .iotMainGrid { grid-template-columns: 1fr; }
          .chartPanel { grid-column: span 1; }
        }
      `}</style>
    </div>
  );
}

function Gauge({ value, max, label, color }) {
  const radius = 80;
  const stroke = 12;
  const normalizedValue = Math.min(value, max);
  const percentage = (normalizedValue / max) * 100;
  const circumference = 2 * Math.PI * radius;
  const arcLength = circumference / 2;
  const strokeDashoffset = arcLength - (percentage / 100) * arcLength;

  return (
    <div
      className="gaugeWrapper"
      style={{ position: "relative", width: radius * 2 + stroke, height: radius + stroke }}
    >
      <svg width={radius * 2 + stroke} height={radius + stroke}>
        <path
          d={`M ${stroke / 2},${radius + stroke / 2} A ${radius},${radius} 0 0 1 ${radius * 2 + stroke / 2},${radius + stroke / 2}`}
          fill="none"
          stroke="#f1f5f9"
          strokeWidth={stroke}
          strokeLinecap="round"
        />
        <path
          d={`M ${stroke / 2},${radius + stroke / 2} A ${radius},${radius} 0 0 1 ${radius * 2 + stroke / 2},${radius + stroke / 2}`}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={arcLength}
          strokeDashoffset={strokeDashoffset}
          style={{ transition: "stroke-dashoffset 0.5s ease" }}
        />
      </svg>
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          textAlign: "center",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        <span style={{ fontSize: "32px", fontWeight: "950", color: "#0f172a" }}>
          {Math.round(value)}
        </span>
        <span style={{ fontSize: "12px", fontWeight: "800", color: "#94a3b8", textTransform: "uppercase" }}>
          {label}
        </span>
      </div>
    </div>
  );
}
