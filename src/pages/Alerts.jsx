import { useEffect, useMemo, useState } from "react";
import { supabase } from "../utils/supabaseClient";
import { Link } from "react-router-dom";
import {
  fetchIncidents,
  insertIncident,
  insertAuditLog,
} from "../utils/databaseService";
import { 
  AlertTriangle, 
  Bell, 
  ShieldAlert, 
  History, 
  Search, 
  Filter,
  CheckCircle2,
  Zap,
  Activity
} from "lucide-react";

const TYPES = ["LEAK", "BURST", "PRESSURE_DROP", "LOW_FLOW"];

function getNum(value) {
  const n = Number(value);
  return Number.isNaN(n) ? null : n;
}

function getConditionScore(p) {
  return getNum(p["Condition Score"] ?? p.CONDITION_SCORE);
}

function getCriticality(p) {
  return getNum(p.CRITICALITY);
}

function getRisk(p) {
  const condition = getConditionScore(p);
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

function getRiskColor(risk) {
  if (risk === "HIGH") return "#dc2626";
  if (risk === "MEDIUM") return "#d97706";
  return "#0b6fa4";
}

function getAlertTitle(risk) {
  if (risk === "HIGH") return "Immediate inspection required";
  if (risk === "MEDIUM") return "Preventive maintenance recommended";
  return "Routine monitoring";
}

function getAlertAction(risk) {
  if (risk === "HIGH") return "Assign field team as soon as possible.";
  if (risk === "MEDIUM") return "Add to next maintenance schedule.";
  return "Continue normal monitoring.";
}

function buildAlerts(pipelines) {
  return pipelines
    .map((p) => {
      const risk = getRisk(p);
      const condition = getConditionScore(p);
      const criticality = getCriticality(p);

      return {
        id: `${p.OBJECTID || p.WATMAINID}-${risk}`,
        risk,
        pipeline_id: p.WATMAINID || p.watmainid || p.OBJECTID || p.objectid,
        material: p.MATERIAL || p.material || "Unknown",
        size: p.PIPE_SIZE || p.pipe_size || p.MAP_LABEL || p.map_label || "Unknown size",
        zone: p.PRESSURE_ZONE || p.pressure_zone || "Unknown zone",
        category: p.CATEGORY || "Water Main",
        condition,
        criticality,
        title: getAlertTitle(risk),
        action: getAlertAction(risk),
      };
    })
    .filter((a) => a.risk !== "LOW")
    .sort((a, b) => {
      const order = { HIGH: 2, MEDIUM: 1, LOW: 0 };
      return order[b.risk] - order[a.risk];
    })
    .slice(0, 30);
}

export default function Alerts() {
  const [pipelines, setPipelines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [incidents, setIncidents] = useState([]);

  const [form, setForm] = useState({
    pipelineId: "",
    type: "LEAK",
    note: "",
  });

  const [search, setSearch] = useState("");
  const [riskFilter, setRiskFilter] = useState("ALL");

  useEffect(() => {
    async function loadData() {
      setLoading(true);

      try {
        let allPipelines = [];
        let from = 0;
        let count = 1000;
        let hasMore = true;

        while (hasMore) {
          const { data, error } = await supabase
            .from("pipelines")
            .select("*")
            .range(from, from + count - 1);

          if (error) {
            console.error("Alerts pipeline fetch error:", error);
            break;
          }
          if (data) {
            allPipelines = [...allPipelines, ...data];
          }
          if (!data || data.length < count) {
            hasMore = false;
          }
          from += count;
        }

        const dbIncidents = await fetchIncidents();
        
        setPipelines(allPipelines);
        setIncidents(dbIncidents);
      } catch (err) {
        console.error("Failed to load alerts data:", err);
        setPipelines([]);
        setIncidents([]);
      }

      setLoading(false);
    }

    loadData();
  }, []);

  const autoAlerts = useMemo(() => buildAlerts(pipelines), [pipelines]);

  const filteredAlerts = useMemo(() => {
    return autoAlerts.filter((a) => {
      const keyword = search.toLowerCase();

      const matchesSearch =
        !keyword ||
        String(a.pipeline_id).toLowerCase().includes(keyword) ||
        String(a.material).toLowerCase().includes(keyword) ||
        String(a.zone).toLowerCase().includes(keyword);

      const matchesRisk = riskFilter === "ALL" || a.risk === riskFilter;

      return matchesSearch && matchesRisk;
    });
  }, [autoAlerts, search, riskFilter]);

  const stats = useMemo(() => {
    const high = autoAlerts.filter((a) => a.risk === "HIGH").length;
    const medium = autoAlerts.filter((a) => a.risk === "MEDIUM").length;

    return {
      total: autoAlerts.length,
      high,
      medium,
      incidents: incidents.length,
    };
  }, [autoAlerts, incidents]);

  async function createIncident(e) {
    e.preventDefault();

    const selected = pipelines.find(
      (p) => String(p.WATMAINID || p.watmainid || p.OBJECTID || p.objectid) === String(form.pipelineId)
    );

    if (!selected) {
      alert("Please select a pipeline first.");
      return;
    }

    const incident = {
      id: `INC-${Date.now()}`,
      pipeline_id: String(selected.WATMAINID || selected.watmainid || selected.OBJECTID || selected.objectid),
      type: form.type,
      risk: getRisk(selected),
      material: selected.MATERIAL || selected.material || "Unknown",
      pipe_size: selected.PIPE_SIZE || selected.pipe_size || selected.MAP_LABEL || selected.map_label || "N/A",
      pressure_zone: selected.PRESSURE_ZONE || selected.pressure_zone || "Unknown zone",
      note: form.note,
      status: "OPEN",
      created_by: localStorage.getItem("waterflow_user") || "Engineer",
    };

    try {
      await insertIncident(incident);

      // Log to audit
      await insertAuditLog({
        id: `LOG-${Date.now()}`,
        user_name: localStorage.getItem("waterflow_user") || "Engineer",
        role: localStorage.getItem("waterflow_role") || "Engineer",
        action: `Created incident ${incident.id} for pipeline ${incident.pipeline_id}`,
        module: "Alerts",
        status: "Success",
      });

      setIncidents((prev) => [incident, ...prev]);
      setForm({ pipelineId: "", type: "LEAK", note: "" });
    } catch (err) {
      console.error("Failed to create incident:", err);
      alert("Failed to save incident. Check console.");
    }
  }

  return (
    <div className="alertsPage">
      <div className="alertsHero">
        <div>
          <div className="eyebrow">Operational Response</div>
          <h1>Alerts Center</h1>
          <p>Simple view for high-risk pipelines, preventive maintenance and manual incident reporting.</p>
        </div>

        <div className="heroBadges">
          <span>{pipelines.length} assets loaded</span>
          <span>{stats.total} active alerts</span>
          <span>{stats.incidents} manual incidents</span>
          <span className="dbBadge">✅ Supabase Connected</span>
        </div>
      </div>

      <div className="kpiGrid">
        <Kpi title="Total Alerts" value={stats.total} />
        <Kpi title="High Risk" value={stats.high} tone="danger" />
        <Kpi title="Medium Risk" value={stats.medium} tone="warn" />
        <Kpi title="Manual Incidents" value={stats.incidents} tone="blue" />
      </div>

      <div className="alertsLayout">
        <section className="panel reportPanel">
          {/* Real-time IoT Status Alert */}
          <IoTRealTimeStatus />

          <div className="panelHead">
            <h2>Report Incident</h2>
            <p>Create a quick field incident — saved directly to Supabase.</p>
          </div>

          <form onSubmit={createIncident} className="incidentForm">
            <label>
              Pipeline
              <select
                value={form.pipelineId}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, pipelineId: e.target.value }))
                }
              >
                <option value="">Select pipeline</option>
                {pipelines.map((p) => (
                  <option key={p.OBJECTID || p.WATMAINID || p.objectid || p.watmainid} value={p.WATMAINID || p.watmainid || p.OBJECTID || p.objectid}>
                    {p.WATMAINID || p.watmainid || p.OBJECTID || p.objectid} • {p.MATERIAL || p.material || "Unknown"} •{" "}
                    {p.PIPE_SIZE || p.pipe_size || p.MAP_LABEL || p.map_label || "N/A"} • {p.PRESSURE_ZONE || p.pressure_zone || "Unknown zone"}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Incident Type
              <select
                value={form.type}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, type: e.target.value }))
                }
              >
                {TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type.replace("_", " ")}
                  </option>
                ))}
              </select>
            </label>

            <label className="fullField">
              Note
              <input
                value={form.note}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, note: e.target.value }))
                }
                placeholder="Optional short note"
              />
            </label>

            <button type="submit">Create Incident</button>
          </form>

          <div className="manualList">
            <h3>Recent Manual Incidents</h3>

            {incidents.length === 0 ? (
              <div className="empty">No manual incidents yet.</div>
            ) : (
              incidents.slice(0, 4).map((incident) => (
                <div key={incident.id} className="manualCard">
                  <div>
                    <strong>{(incident.type || "").replace("_", " ")}</strong>
                    <p>
                      Pipeline #{incident.pipeline_id || incident.pipelineId} • {incident.pressure_zone || incident.zone}
                    </p>
                    <small>{incident.created_at ? new Date(incident.created_at).toLocaleString() : incident.createdAt}</small>
                  </div>

                  <span
                    className="riskBadge"
                    style={{ background: getRiskColor(incident.risk) }}
                  >
                    {incident.risk}
                  </span>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="panel alertPanel">
          <div className="panelHead alertHead">
            <div>
              <h2>Recommended Actions</h2>
              <p>Auto-generated from condition score and criticality.</p>
            </div>

            <div className="filters">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search pipeline, material or zone"
              />

              <select
                value={riskFilter}
                onChange={(e) => setRiskFilter(e.target.value)}
              >
                <option value="ALL">All</option>
                <option value="HIGH">High</option>
                <option value="MEDIUM">Medium</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div className="empty">Loading alerts...</div>
          ) : filteredAlerts.length === 0 ? (
            <div className="empty">No alerts found.</div>
          ) : (
            <div className="cleanAlertList">
              {filteredAlerts.map((alert) => (
                <div key={alert.id} className="cleanAlertCard">
                  <div className="alertLeft">
                    <span
                      className="riskDot"
                      style={{ background: getRiskColor(alert.risk) }}
                    />

                    <div>
                      <div className="alertTitleRow">
                        <h3>{alert.title}</h3>
                        <span
                          className="riskBadge"
                          style={{ background: getRiskColor(alert.risk) }}
                        >
                          {alert.risk}
                        </span>
                      </div>

                      <p className="alertMeta">
                        Pipeline #{alert.watmainid} • {alert.material} • {alert.pipeSize}
                      </p>

                      <div className="alertDetails">
                        <span>Zone: {alert.zone}</span>
                        <span>Condition: {alert.condition ?? "N/A"}</span>
                        <span>Criticality: {alert.criticality ?? "N/A"}</span>
                      </div>

                      <div className="nextAction">
                        <b>Next action:</b> {alert.action}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <style>{`
        .alertsPage {
          width: 100%;
          padding: 28px;
          animation: fadeIn 0.35s ease;
        }

        .alertsHero {
          background: linear-gradient(135deg, #ffffff, #eef8fc, #dff2fa);
          border: 1px solid #c8e3ef;
          border-radius: 22px;
          padding: 28px;
          display: flex;
          justify-content: space-between;
          gap: 20px;
          margin-bottom: 22px;
          box-shadow: 0 12px 30px rgba(20, 65, 90, 0.08);
        }

        .eyebrow {
          display: inline-block;
          background: #e2f4fb;
          color: #0b6fa4;
          border: 1px solid #b9ddeb;
          font-weight: 900;
          font-size: 12px;
          letter-spacing: 1px;
          padding: 7px 12px;
          border-radius: 999px;
          text-transform: uppercase;
          margin-bottom: 10px;
        }

        .alertsHero h1 {
          margin: 0;
          font-size: 30px;
          color: #123047;
        }

        .alertsHero p {
          margin: 8px 0 0;
          color: #5f7688;
          font-weight: 600;
        }

        .heroBadges {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          justify-content: flex-end;
          align-items: flex-start;
        }

        .heroBadges span {
          background: white;
          border: 1px solid #d7e6ef;
          border-radius: 999px;
          padding: 8px 12px;
          font-size: 12px;
          font-weight: 900;
          color: #123047;
        }

        .dbBadge {
          background: #dcfce7 !important;
          border-color: #86efac !important;
          color: #166534 !important;
        }

        .kpiGrid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
          margin-bottom: 22px;
        }

        .kpi {
          background: white;
          border: 1px solid #d7e6ef;
          border-radius: 18px;
          padding: 18px;
          box-shadow: 0 10px 26px rgba(20, 65, 90, 0.08);
        }

        .kpiTitle {
          color: #5f7688;
          font-size: 13px;
          font-weight: 800;
        }

        .kpiValue {
          margin-top: 8px;
          font-size: 32px;
          font-weight: 950;
          color: #123047;
        }

        .kpi.danger {
          background: #fdeaea;
        }

        .kpi.warn {
          background: #fff4dd;
        }

        .kpi.blue {
          background: #e2f4fb;
        }

        .alertsLayout {
          display: grid;
          grid-template-columns: 420px 1fr;
          gap: 22px;
        }

        .panel {
          background: white;
          border: 1px solid #d7e6ef;
          border-radius: 20px;
          padding: 20px;
          box-shadow: 0 10px 26px rgba(20, 65, 90, 0.08);
        }

        .panelHead h2 {
          margin: 0;
          font-size: 22px;
          color: #123047;
        }

        .panelHead p {
          margin: 6px 0 16px;
          color: #5f7688;
          font-size: 14px;
          font-weight: 600;
        }

        .alertHead {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          align-items: flex-start;
          margin-bottom: 16px;
        }

        .filters {
          display: grid;
          grid-template-columns: 260px 120px;
          gap: 10px;
        }

        .incidentForm {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }

        .incidentForm label {
          display: grid;
          gap: 6px;
          color: #31546a;
          font-size: 13px;
          font-weight: 900;
        }

        .fullField {
          grid-column: 1 / -1;
        }

        .incidentForm input,
        .incidentForm select,
        .filters input,
        .filters select {
          height: 44px;
          border: 1px solid #cbdde7;
          border-radius: 12px;
          padding: 0 14px;
          color: #123047;
          background: white;
          font-weight: 700;
        }

        .incidentForm button {
          grid-column: 1 / -1;
          height: 46px;
          border: none;
          border-radius: 12px;
          background: #0b6fa4;
          color: white;
          font-weight: 900;
          cursor: pointer;
          box-shadow: 0 8px 20px rgba(11, 111, 164, 0.18);
        }

        .manualList {
          margin-top: 22px;
          display: grid;
          gap: 12px;
        }

        .manualList h3 {
          margin: 0;
          color: #123047;
          font-size: 18px;
        }

        .manualCard {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: center;
          background: #f6fafc;
          border: 1px solid #d7e6ef;
          border-radius: 16px;
          padding: 14px;
        }

        .manualCard strong {
          color: #123047;
        }

        .manualCard p {
          margin: 4px 0;
          color: #5f7688;
          font-size: 13px;
          font-weight: 700;
        }

        .manualCard small {
          color: #7f99aa;
          font-weight: 700;
        }

        .cleanAlertList {
          display: grid;
          gap: 12px;
          max-height: 640px;
          overflow-y: auto;
          padding-right: 6px;
        }

        .cleanAlertCard {
          background: #f6fafc;
          border: 1px solid #d7e6ef;
          border-radius: 16px;
          padding: 16px;
          transition: 0.2s ease;
        }

        .cleanAlertCard:hover {
          border-color: #8cc9df;
          background: #eef8fc;
        }

        .alertLeft {
          display: grid;
          grid-template-columns: 12px 1fr;
          gap: 14px;
        }

        .riskDot {
          width: 12px;
          height: 12px;
          border-radius: 999px;
          margin-top: 6px;
        }

        .alertTitleRow {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: center;
        }

        .alertTitleRow h3 {
          margin: 0;
          color: #123047;
          font-size: 17px;
        }

        .riskBadge {
          color: white;
          border-radius: 999px;
          padding: 6px 12px;
          font-size: 11px;
          font-weight: 950;
          white-space: nowrap;
        }

        .alertMeta {
          margin: 5px 0 10px;
          color: #5f7688;
          font-size: 13px;
          font-weight: 800;
        }

        .alertDetails {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          margin-bottom: 10px;
        }

        .alertDetails span {
          background: white;
          border: 1px solid #d7e6ef;
          border-radius: 999px;
          padding: 5px 10px;
          color: #31546a;
          font-size: 12px;
          font-weight: 800;
        }

        .nextAction {
          color: #123047;
          font-size: 13px;
          line-height: 1.5;
        }

        .empty {
          background: #f6fafc;
          border: 1px dashed #b9ddeb;
          border-radius: 16px;
          padding: 28px;
          text-align: center;
          color: #5f7688;
          font-weight: 800;
        }

        @media (max-width: 1200px) {
          .alertsLayout {
            grid-template-columns: 1fr;
          }

          .alertHead {
            display: grid;
          }

          .filters {
            grid-template-columns: 1fr 140px;
          }
        }

        @media (max-width: 800px) {
          .alertsPage {
            padding: 18px;
          }

          .alertsHero {
            display: grid;
          }

          .heroBadges {
            justify-content: flex-start;
          }

          .kpiGrid {
            grid-template-columns: 1fr 1fr;
          }

          .incidentForm,
          .filters {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 520px) {
          .kpiGrid {
            grid-template-columns: 1fr;
          }

          .alertTitleRow {
            align-items: flex-start;
            flex-direction: column;
          }
        }
      `}</style>
    </div>
  );
}

function Kpi({ title, value, tone = "" }) {
  return (
    <div className={`kpi ${tone}`}>
      <div className="kpiTitle">{title}</div>
      <div className="kpiValue">{value}</div>
    </div>
  );
}

function IoTRealTimeStatus() {
  const [status, setStatus] = useState({ s1: 0, s2: 0, loading: true, error: null });
  const token = "5IiBCz3InHxX2jlSWvYlsU_uoSPjwpoW";

  useEffect(() => {
    async function checkIoT() {
      try {
        const res = await fetch(`https://blynk.cloud/external/api/get?token=${token}&v0&v1`);
        if (!res.ok) throw new Error();
        const data = await res.json();
        setStatus({ s1: Number(data.v0 || 0), s2: Number(data.v1 || 0), loading: false, error: null });
      } catch (err) {
        setStatus(prev => ({ ...prev, loading: false, error: true }));
      }
    }
    checkIoT();
    const inv = setInterval(checkIoT, 5000);
    return () => clearInterval(inv);
  }, []);

  if (status.loading) return <div className="iotStatusLoading">Checking IoT Sensors...</div>;
  if (status.error) return null;

  const isLeak = status.s2 < status.s1 && status.s2 < 8 && status.s1 > 2;

  return (
    <div className={`iotStatusAlert ${isLeak ? 'leak' : 'ok'}`}>
      <div className="iotStatusIcon">
        {isLeak ? (
          <img src="/logos/leak_warning.png" alt="Leak" style={{ width: "40px", height: "40px" }} />
        ) : (
          <CheckCircle2 size={32} />
        )}
      </div>
      <div className="iotStatusText">
        <strong>{isLeak ? "IoT: Leakage Detected!" : "IoT: Flow Rates Normal"}</strong>
        <p>{isLeak ? `Sensor Discrepancy: ${Math.max(0, status.s1 - status.s2).toFixed(1)} mL/S loss` : "System telemetry reports no active leaks."}</p>
      </div>
      <Link to="/iot-monitoring" className="iotStatusLink">View Live Telemetry</Link>

      <style>{`
        .iotStatusAlert {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 14px;
          border-radius: 16px;
          margin-bottom: 20px;
          border: 1px solid transparent;
          animation: slideIn 0.3s ease;
        }
        .iotStatusAlert.leak {
          background: #fef2f2;
          border-color: #fecaca;
          color: #991b1b;
        }
        .iotStatusAlert.ok {
          background: #f0fdf4;
          border-color: #bbf7d0;
          color: #166534;
        }
        .iotStatusIcon { font-size: 24px; }
        .iotStatusText { flex: 1; }
        .iotStatusText strong { display: block; font-size: 14px; font-weight: 900; }
        .iotStatusText p { margin: 2px 0 0; font-size: 12px; font-weight: 700; opacity: 0.8; }
        .iotStatusLink {
          background: white;
          color: #123047;
          text-decoration: none;
          padding: 6px 12px;
          border-radius: 8px;
          font-size: 11px;
          font-weight: 900;
          box-shadow: 0 2px 5px rgba(0,0,0,0.05);
        }
        .iotStatusLoading {
          padding: 14px;
          text-align: center;
          font-size: 12px;
          font-weight: 800;
          color: #64748b;
          background: #f8fafc;
          border-radius: 16px;
          margin-bottom: 20px;
          border: 1px dashed #e2e8f0;
        }
        @keyframes slideIn {
          from { transform: translateY(-10px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}