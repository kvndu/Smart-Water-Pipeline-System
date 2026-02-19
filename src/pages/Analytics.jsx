import { useMemo } from "react";
import DatasetCharts from "../components/DatasetCharts.jsx";


const PIPELINES = [
  { pipeline_id:"PL-1001", pipe_name:"Main Line A", area:"Kalutara", zone:"Z1", material:"PVC", diameter_mm:120, length_m:1800, install_year:2014, corrosion_risk:"Low", leak_count:0, last_maintenance_date:"2025-10-12" },
  { pipeline_id:"PL-1002", pipe_name:"Feeder B", area:"Bulathsinhala", zone:"Z2", material:"GI",  diameter_mm:200, length_m:2450, install_year:2008, corrosion_risk:"High", leak_count:3, last_maintenance_date:"2024-12-20" },
  { pipeline_id:"PL-1003", pipe_name:"Distribution C", area:"Panadura", zone:"Z1", material:"HDPE", diameter_mm:160, length_m:1300, install_year:2018, corrosion_risk:"Medium", leak_count:1, last_maintenance_date:"2025-03-04" },
];

export default function Analytics() {
  const pipelines = useMemo(() => PIPELINES, []);

  return (
    <div className="container">
      <div className="header">
        <div>
          <div className="title">Analytics</div>
          <div className="subtitle">Charts are calculated directly from dataset fields (No AI)</div>
        </div>
        <span className="badge ok">Dataset-based</span>
      </div>

      <DatasetCharts pipelines={pipelines} />
    </div>
  );
}
