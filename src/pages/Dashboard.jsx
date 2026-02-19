import { useMemo, useState } from "react";
import KPIGrid from "../components/KPIGrid.jsx";
import PipelineTable from "../components/PipelineTable.jsx";
import AlertPanel from "../components/AlertPanel.jsx";
import PipelineMapPlaceholder from "../components/PipelineMapPlaceholder.jsx";

const PIPELINES = [
  {
    pipeline_id: "PL-1001",
    pipe_name: "Main Line A",
    area: "Kalutara",
    zone: "Z1",
    material: "PVC",
    diameter_mm: 120,
    length_m: 1800,
    install_year: 2014,
    corrosion_risk: "Low",
    leak_count: 0,
    last_maintenance_date: "2025-10-12",
    gps_latitude: 6.5853,
    gps_longitude: 79.9607,
  },
  {
    pipeline_id: "PL-1002",
    pipe_name: "Feeder B",
    area: "Bulathsinhala",
    zone: "Z2",
    material: "GI",
    diameter_mm: 200,
    length_m: 2450,
    install_year: 2008,
    corrosion_risk: "High",
    leak_count: 3,
    last_maintenance_date: "2024-12-20",
    gps_latitude: 6.6662,
    gps_longitude: 80.1646,
  },
  {
    pipeline_id: "PL-1003",
    pipe_name: "Distribution C",
    area: "Panadura",
    zone: "Z1",
    material: "HDPE",
    diameter_mm: 160,
    length_m: 1300,
    install_year: 2018,
    corrosion_risk: "Medium",
    leak_count: 1,
    last_maintenance_date: "2025-03-04",
    gps_latitude: 6.7133,
    gps_longitude: 79.902,
  },
];

function buildAlerts(pipelines) {
  const alerts = [];
  pipelines.forEach((p) => {
    const leaks = Number(p.leak_count || 0);

    if (leaks >= 2) {
      alerts.push({
        id: `AL-${p.pipeline_id}-L`,
        title: "Leak Detected (Multiple reports)",
        severity: "High",
        pipeline_id: p.pipeline_id,
        area: p.area,
        time: "This week",
      });
    } else if (leaks === 1) {
      alerts.push({
        id: `AL-${p.pipeline_id}-L`,
        title: "Leak Detected",
        severity: "Medium",
        pipeline_id: p.pipeline_id,
        area: p.area,
        time: "Today",
      });
    }

    if ((p.corrosion_risk || "").toLowerCase() === "high") {
      alerts.push({
        id: `AL-${p.pipeline_id}-C`,
        title: "High Corrosion Risk (Maintenance Needed)",
        severity: leaks > 0 ? "High" : "Medium",
        pipeline_id: p.pipeline_id,
        area: p.area,
        time: "This month",
      });
    }
  });
  return alerts;
}

export default function Dashboard() {
  const [q, setQ] = useState("");
  const [zone, setZone] = useState("All");
  const [risk, setRisk] = useState("All");
  const [selected, setSelected] = useState(null);

  const zones = useMemo(
    () => ["All", ...Array.from(new Set(PIPELINES.map((p) => p.zone)))],
    []
  );
  const risks = ["All", "Low", "Medium", "High"];

  const filtered = useMemo(() => {
    return PIPELINES.filter((p) => {
      const matchesQ =
        q.trim() === "" ||
        `${p.pipeline_id} ${p.pipe_name} ${p.area} ${p.material}`
          .toLowerCase()
          .includes(q.toLowerCase());

      const matchesZone = zone === "All" || p.zone === zone;
      const matchesRisk = risk === "All" || p.corrosion_risk === risk;

      return matchesQ && matchesZone && matchesRisk;
    });
  }, [q, zone, risk]);

  const alerts = useMemo(() => buildAlerts(filtered), [filtered]);

  const kpis = useMemo(() => {
    const total = filtered.length;
    const highRisk = filtered.filter((p) => p.corrosion_risk === "High").length;
    const leakTotal = filtered.reduce(
      (sum, p) => sum + (Number(p.leak_count) || 0),
      0
    );

    return [
      { label: "Total Pipelines", value: total, hint: "From dataset" },
      { label: "High Corrosion Risk", value: highRisk, hint: "corrosion_risk = High" },
      { label: "Total Leak Reports", value: leakTotal, hint: "sum(leak_count)" },
      { label: "Active Alerts", value: alerts.length, hint: "rule-based" },
    ];
  }, [filtered, alerts]);

  return (
    <div className="container">
      <div className="header">
        <div>
          <div className="title">Smart Water Pipeline Dashboard</div>
          <div className="subtitle">Dataset-based analytics (No AI / No ML)</div>
        </div>
        <span className="badge ok">Status: Running</span>
      </div>

      <KPIGrid kpis={kpis} />

      <div className="grid" style={{ marginTop: 12 }}>
        <div className="vstack">
          <div className="card card-pad">
            <div className="toolbar">
              <input
                className="input"
                placeholder="Search pipeline / area / material..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />

              <div className="hstack">
                <select
                  className="select"
                  value={zone}
                  onChange={(e) => setZone(e.target.value)}
                >
                  {zones.map((z) => (
                    <option key={z} value={z}>
                      {z}
                    </option>
                  ))}
                </select>

                <select
                  className="select"
                  value={risk}
                  onChange={(e) => setRisk(e.target.value)}
                >
                  {risks.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="small">
              All charts + KPIs are calculated directly from dataset fields (no prediction).
            </div>
          </div>

          <PipelineMapPlaceholder selected={selected} />

          <PipelineTable
            rows={filtered}
            selectedId={selected?.pipeline_id}
            onSelect={(p) => setSelected(p)}
          />
        </div>

        <div className="vstack">
          <AlertPanel alerts={alerts} />

          <div className="card card-pad">
            <div className="title" style={{ fontSize: 14 }}>
              Selected Pipeline
            </div>

            {selected ? (
              <div style={{ marginTop: 10 }} className="vstack">
                <div>
                  <b>{selected.pipeline_id}</b> — {selected.pipe_name}
                </div>

                <div className="small">
                  {selected.area} / {selected.zone}
                </div>

                <div className="hstack" style={{ flexWrap: "wrap" }}>
                  <span className="badge">{selected.material}</span>
                  <span className="badge">{selected.diameter_mm} mm</span>
                  <span className="badge">{selected.length_m} m</span>

                  <span
                    className={`badge ${
                      selected.corrosion_risk === "High"
                        ? "danger"
                        : selected.corrosion_risk === "Medium"
                        ? "warn"
                        : "ok"
                    }`}
                  >
                    Risk: {selected.corrosion_risk}
                  </span>
                </div>

                <div className="small">
                  Last maintenance: <b>{selected.last_maintenance_date}</b>
                  <br />
                  GPS: {selected.gps_latitude}, {selected.gps_longitude}
                  <br />
                  Leak reports: <b>{selected.leak_count}</b>
                </div>
              </div>
            ) : (
              <div className="small" style={{ marginTop: 10 }}>
                Click “View” on a pipeline row to see details here.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
