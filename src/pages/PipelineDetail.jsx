import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "../utils/supabaseClient";
import PredictiveInsights from "../components/PredictiveInsights";
import { 
  History, 
  Calendar, 
  ShieldCheck, 
  Activity,
  ArrowRight
} from "lucide-react";

export default function PipelineDetail() {
  const { id } = useParams();
  const [pipeline, setPipeline] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDetail() {
      setLoading(true);
      
      // We check if id matches WATMAINID or OBJECTID (or lowercase versions)
      const { data, error } = await supabase
        .from("pipelines")
        .select("*")
        .or(`WATMAINID.eq.${id},OBJECTID.eq.${id},watmainid.eq.${id},objectid.eq.${id}`)
        .limit(1)
        .single();

      if (error) {
        console.error("Error fetching pipeline details:", error);
      } else {
        setPipeline(data);
      }
      setLoading(false);
    }
    fetchDetail();
  }, [id]);

  if (loading) return <div className="pipelinePage">Loading pipeline details...</div>;

  if (!pipeline) {
    return (
      <div className="pipelinePage">
        <div className="emptyState">
          <h2>Pipeline Not Found</h2>
          <p>Could not find a pipeline with ID {id}.</p>
          <Link to="/pipelines" className="btn btnPrimary" style={{ marginTop: "14px", display: "inline-block" }}>
            Return to Pipeline List
          </Link>
        </div>
      </div>
    );
  }

  // Fallback for mixed-case properties
  const p = pipeline;
  const watmainid = p.WATMAINID || p.watmainid || "N/A";
  const objectid = p.OBJECTID || p.objectid || "N/A";
  const material = p.MATERIAL || p.material || "N/A";
  const size = p.PIPE_SIZE || p.pipe_size || p.MAP_LABEL || p.map_label || "N/A";
  const status = p.STATUS || p.status || "N/A";
  const pressureZone = p.PRESSURE_ZONE || p.pressure_zone || "N/A";
  const category = p.CATEGORY || p.category || "N/A";
  const length = p.Shape__Length || p.shape__length || "N/A";
  const condition = p.CONDITION_SCORE || p["Condition Score"] || p.condition_score || "N/A";
  const criticality = p.CRITICALITY || p.criticality || "N/A";
  
  const riskRaw = Number(condition);
  let risk = "LOW";
  if (!Number.isNaN(riskRaw)) {
    if (riskRaw <= 4) risk = "HIGH";
    else if (riskRaw <= 7) risk = "MEDIUM";
  }

  return (
    <div className="pipelinePage">
      <div className="hero">
        <div>
          <div className="eyebrow">Asset Details</div>
          <h1>Pipeline #{watmainid !== "N/A" ? watmainid : objectid}</h1>
          <p>Complete asset profile, specification data, and condition assessment.</p>
        </div>
        <div className="heroBadges">
          <span>Status: {status}</span>
          <span style={{ 
            background: risk === "HIGH" ? "#fef2f2" : risk === "MEDIUM" ? "#fffbeb" : "#f0f9ff",
            color: risk === "HIGH" ? "#dc2626" : risk === "MEDIUM" ? "#d97706" : "#0284c7",
            borderColor: risk === "HIGH" ? "#fecaca" : risk === "MEDIUM" ? "#fde68a" : "#bae6fd"
          }}>
            Risk: {risk}
          </span>
          <Link to={`/map-view?pipe=${watmainid !== "N/A" ? watmainid : objectid}`} className="viewBtn">
            View on Map
          </Link>
        </div>
      </div>

      <div className="twoColGrid">
        <div className="panel">
          <div className="panelHead">
            <h2>Technical Specifications</h2>
            <p>Physical attributes and spatial data</p>
          </div>
          <div className="noteGrid" style={{ gridTemplateColumns: "1fr 1fr" }}>
            <div className="noteCard">
              <h3 style={{ fontSize: "12px", color: "#64748b" }}>Material</h3>
              <p style={{ fontSize: "16px", color: "#0f172a", fontWeight: "900" }}>{material}</p>
            </div>
            <div className="noteCard">
              <h3 style={{ fontSize: "12px", color: "#64748b" }}>Pipe Size</h3>
              <p style={{ fontSize: "16px", color: "#0f172a", fontWeight: "900" }}>{size}</p>
            </div>
            <div className="noteCard">
              <h3 style={{ fontSize: "12px", color: "#64748b" }}>Pressure Zone</h3>
              <p style={{ fontSize: "16px", color: "#0f172a", fontWeight: "900" }}>{pressureZone}</p>
            </div>
            <div className="noteCard">
              <h3 style={{ fontSize: "12px", color: "#64748b" }}>Category</h3>
              <p style={{ fontSize: "16px", color: "#0f172a", fontWeight: "900" }}>{category}</p>
            </div>
            <div className="noteCard">
              <h3 style={{ fontSize: "12px", color: "#64748b" }}>Length</h3>
              <p style={{ fontSize: "16px", color: "#0f172a", fontWeight: "900" }}>{length}</p>
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panelHead">
            <h2>Condition & Assessment</h2>
            <p>Asset health metrics and criticality parameters</p>
          </div>
          <div className="noteGrid" style={{ gridTemplateColumns: "1fr 1fr" }}>
            <div className="noteCard" style={{ background: risk === "HIGH" ? "#fef2f2" : "var(--card-muted)" }}>
              <h3 style={{ fontSize: "12px", color: "#64748b" }}>Condition Score</h3>
              <p style={{ fontSize: "20px", color: "#0f172a", fontWeight: "900" }}>{condition} / 10</p>
            </div>
            <div className="noteCard">
              <h3 style={{ fontSize: "12px", color: "#64748b" }}>Criticality Level</h3>
              <p style={{ fontSize: "20px", color: "#0f172a", fontWeight: "900" }}>{criticality} / 10</p>
            </div>
          </div>

          <h3 style={{ marginTop: "24px", fontSize: "14px", color: "#0f172a", marginBottom: "12px" }}>Raw Database Fields</h3>
          <div style={{ maxHeight: "150px", overflow: "auto", background: "#f8fafc", padding: "12px", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
            <pre style={{ fontSize: "11px", color: "#334155", margin: 0 }}>
              {JSON.stringify(p, null, 2)}
            </pre>
          </div>
        </div>

        {/* PREDICTIVE INSIGHTS PANEL */}
        <div className="panel predictivePanel" style={{ gridColumn: "span 2" }}>
           <PredictiveInsights pipeline={p} />
        </div>

        {/* ASSET HEALTH TIMELINE (DIGITAL TWIN CONCEPT) */}
        <div className="panel timelinePanel" style={{ gridColumn: "span 2" }}>
           <div className="panelHead">
             <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
               <History size={18} />
               <h2>Asset Health Timeline</h2>
             </div>
             <p>Historical condition trajectory and digital twin representation.</p>
           </div>
           
           <div className="timelineWrap">
             <div className="timelineItem">
               <div className="timelineMarker active"></div>
               <div className="timelineContent">
                 <div className="timelineDate">2026 - CURRENT</div>
                 <h4>Predictive Monitoring Active</h4>
                 <p>System reports {risk} risk profile based on current telemetry.</p>
               </div>
             </div>
             <div className="timelineItem">
               <div className="timelineMarker"></div>
               <div className="timelineContent">
                 <div className="timelineDate">2024 - AUG</div>
                 <h4>Acoustic Leak Inspection</h4>
                 <p>Field inspection confirmed 0.2% minor seepage. No excavation required.</p>
               </div>
             </div>
             <div className="timelineItem">
               <div className="timelineMarker"></div>
               <div className="timelineContent">
                 <div className="timelineDate">2022 - JAN</div>
                 <h4>Pressure Zone Re-calibration</h4>
                 <p>Inlet pressure adjusted to 4.2 bar to reduce joint stress.</p>
               </div>
             </div>
             <div className="timelineItem">
               <div className="timelineMarker"></div>
               <div className="timelineContent">
                 <div className="timelineDate">1985 - MAY</div>
                 <h4>Original Installation</h4>
                 <p>Initial deployment as part of the regional water main expansion.</p>
               </div>
             </div>
           </div>
        </div>
      </div>
      
      <style>{`
        .panelHead { margin-bottom: 20px; }
        .panelHead h2 { margin: 0; font-size: 18px; color: #0f172a; }
        .panelHead p { margin: 4px 0 0; font-size: 13px; color: #64748b; }

        .timelineWrap {
          margin-top: 24px;
          display: grid;
          gap: 24px;
          position: relative;
          padding-left: 30px;
        }

        .timelineWrap::before {
          content: "";
          position: absolute;
          left: 6px;
          top: 0;
          bottom: 0;
          width: 2px;
          background: #e2e8f0;
        }

        .timelineItem {
          position: relative;
        }

        .timelineMarker {
          position: absolute;
          left: -30px;
          top: 4px;
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: #cbd5e1;
          border: 3px solid #fff;
          z-index: 2;
        }

        .timelineMarker.active {
          background: #3b82f6;
          box-shadow: 0 0 10px rgba(59, 130, 246, 0.5);
        }

        .timelineDate {
          font-size: 11px;
          font-weight: 950;
          color: #94a3b8;
          letter-spacing: 0.5px;
          margin-bottom: 4px;
        }

        .timelineContent h4 {
          margin: 0;
          font-size: 15px;
          color: #1e293b;
          font-weight: 800;
        }

        .timelineContent p {
          margin: 4px 0 0;
          font-size: 13px;
          color: #64748b;
          line-height: 1.5;
        }
      `}</style>
    </div>
  );
}