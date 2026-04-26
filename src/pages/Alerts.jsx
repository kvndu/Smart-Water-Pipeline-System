import { useEffect, useMemo, useState } from "react";
import { supabase } from "../utils/supabaseClient";

const LS_KEY = "pipeguard_incidents";
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
        watmainid: p.WATMAINID || p.OBJECTID || "N/A",
        material: p.MATERIAL || "Unknown",
        pipeSize: p.PIPE_SIZE || p.MAP_LABEL || "N/A",
        zone: p.PRESSURE_ZONE || "Unknown zone",
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
  const [incidents, setIncidents] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(LS_KEY)) || [];
    } catch {
      return [];
    }
  });

  const [form, setForm] = useState({
    pipelineId: "",
    type: "LEAK",
    note: "",
  });

  const [search, setSearch] = useState("");
  const [riskFilter, setRiskFilter] = useState("ALL");

  useEffect(() => {
    async function loadPipelines() {
      setLoading(true);

      const { data, error } = await supabase
        .from("pipelines")
        .select("*")
        .limit(1000);

      if (error) {
        console.error("Alerts fetch error:", error);
        setPipelines([]);
      } else {
        setPipelines(data || []);
      }

      setLoading(false);
    }

    loadPipelines();
  }, []);

  useEffect(() => {
    localStorage.setItem(LS_KEY, JSON.stringify(incidents));
  }, [incidents]);

  const autoAlerts = useMemo(() => buildAlerts(pipelines), [pipelines]);

  const filteredAlerts = useMemo(() => {
    return autoAlerts.filter((a) => {
      const keyword = search.toLowerCase();

      const matchesSearch =
        !keyword ||
        String(a.watmainid).toLowerCase().includes(keyword) ||
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

  function createIncident(e) {
    e.preventDefault();

    const selected = pipelines.find(
      (p) => String(p.WATMAINID) === String(form.pipelineId)
    );

    if (!selected) {
      alert("Please select a pipeline first.");
      return;
    }

    const incident = {
      id: `INC-${Date.now()}`,
      pipelineId: selected.WATMAINID || selected.OBJECTID,
      type: form.type,
      risk: getRisk(selected),
      material: selected.MATERIAL || "Unknown",
      pipeSize: selected.PIPE_SIZE || selected.MAP_LABEL || "N/A",
      zone: selected.PRESSURE_ZONE || "Unknown zone",
      note: form.note,
      createdAt: new Date().toLocaleString(),
    };

    setIncidents((prev) => [incident, ...prev]);
    setForm({ pipelineId: "", type: "LEAK", note: "" });
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
          <div className="panelHead">
            <h2>Report Incident</h2>
            <p>Create a quick field incident for a selected pipeline.</p>
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
                  <option key={p.OBJECTID || p.WATMAINID} value={p.WATMAINID}>
                    {p.WATMAINID || p.OBJECTID} • {p.MATERIAL || "Unknown"} •{" "}
                    {p.PIPE_SIZE || p.MAP_LABEL || "N/A"}
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
                    <strong>{incident.type.replace("_", " ")}</strong>
                    <p>
                      Pipeline #{incident.pipelineId} • {incident.zone}
                    </p>
                    <small>{incident.createdAt}</small>
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