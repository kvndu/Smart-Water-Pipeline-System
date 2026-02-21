import { useMemo } from "react";
import DatasetCharts from "../components/DatasetCharts.jsx";


const PIPELINES = [
  { pipeline_id: "PL-1001", pipe_name: "Main Line A", area: "Kalutara", zone: "Z1", material: "PVC", diameter_mm: 120, length_m: 1800, install_year: 2014, corrosion_risk: "Low", leak_count: 0, last_maintenance_date: "2025-10-12" },
  { pipeline_id: "PL-1002", pipe_name: "Feeder B", area: "Bulathsinhala", zone: "Z2", material: "GI", diameter_mm: 200, length_m: 2450, install_year: 2008, corrosion_risk: "High", leak_count: 3, last_maintenance_date: "2024-12-20" },
  { pipeline_id: "PL-1003", pipe_name: "Distribution C", area: "Panadura", zone: "Z1", material: "HDPE", diameter_mm: 160, length_m: 1300, install_year: 2018, corrosion_risk: "Medium", leak_count: 1, last_maintenance_date: "2025-03-04" },
];

export default function Analytics() {
  const pipelines = useMemo(() => PIPELINES, []);

  return (
    <div className="container" style={{ animation: "fadeIn 0.5s ease-out" }}>
      <div className="header" style={{ marginBottom: "28px" }}>
        <div>
          <div className="title" style={{ fontSize: "28px", color: "var(--text)", fontWeight: 900, marginBottom: "4px" }}>
            Data Analytics
          </div>
          <div className="subtitle" style={{ fontSize: "15px", color: "var(--muted)" }}>
            Real-time pipeline charts generated directly from existing datasets.
          </div>
        </div>
        <div className="hstack">
          <span className="badge ok" style={{ fontSize: "12px", padding: "6px 12px", background: "#ecfdf5", color: "#065f46", border: "1px solid #a7f3d0" }}>
            ✓ Dataset-based Rendering
          </span>
        </div>
      </div>

      <div style={{ background: "#fff", borderRadius: "16px", padding: "20px", boxShadow: "0 10px 40px -10px rgba(15,23,42,0.08)", border: "1px solid #e2e8f0" }}>
        <DatasetCharts pipelines={pipelines} />
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
