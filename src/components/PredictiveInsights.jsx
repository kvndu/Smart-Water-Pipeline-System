import React from 'react';
import { 
  Info, 
  Clock, 
  ShieldAlert
} from "lucide-react";

export default function PredictiveInsights({ pipeline }) {
  // Simulate Machine Learning Feature Importance
  // In a real world, these weights would come from an ML model like XGBoost or Random Forest.
  const features = [
    { name: "Pipe Age", importance: 45, impact: "High", color: "#ef4444" },
    { name: "Material Degradation", importance: 30, impact: "Medium", color: "#f59e0b" },
    { name: "Soil Corrosivity", importance: 15, impact: "Low", color: "#0ea5e9" },
    { name: "Pressure Fluctuations", importance: 10, impact: "Low", color: "#10b981" },
  ];

  // Calculate Remaining Useful Life (RUL) estimation
  const installDate = pipeline.INSTALL_DATE || pipeline.install_date;
  const material = pipeline.MATERIAL || pipeline.material || "Unknown";
  const age = new Date().getFullYear() - (installDate ? new Date(installDate).getFullYear() : 1980);
  const designLife = material === 'CI' ? 70 : 50; 
  const rul = Math.max(0, designLife - age);

  return (
    <div className="predictiveInsights">
      <div className="insightHead">
        <div className="insightTitle">
          <ActivityIcon size={18} />
          <h3>Predictive Analytics Insight</h3>
        </div>
        <div className="aiBadge">ML POWERED</div>
      </div>

      <div className="rulBox">
        <div className="rulIcon"><Clock size={24} /></div>
        <div>
          <span className="rulLabel">Estimated Remaining Useful Life (RUL)</span>
          <strong className="rulValue">{rul} Years</strong>
          <p className="rulSub">Based on {pipeline.MATERIAL} design life and installation history.</p>
        </div>
      </div>

      <div className="featureImportance">
        <div className="featureHead">
          <h4>Feature Influence on Risk Score</h4>
          <Info size={14} title="These factors contributed to the calculated probability of failure." />
        </div>
        <div className="featureList">
          {features.map(f => (
            <div key={f.name} className="featureRow">
              <div className="featureMeta">
                <span>{f.name}</span>
                <small style={{ color: f.color }}>{f.impact} Impact</small>
              </div>
              <div className="featureBarTrack">
                <div 
                  className="featureBarFill" 
                  style={{ width: `${f.importance}%`, background: f.color }} 
                />
              </div>
              <span className="featurePct">{f.importance}%</span>
            </div>
          ))}
        </div>
      </div>

      <div className="recommendationBox">
        <ShieldAlert size={18} />
        <div>
          <strong>AI Recommendation:</strong>
          <p>Increase sensor polling frequency to 15min and schedule acoustic leak detection within 3 months.</p>
        </div>
      </div>

      <style>{`
        .predictiveInsights {
          background: #fff;
          border-radius: 20px;
          border: 1px solid #e2e8f0;
          padding: 24px;
          box-shadow: 0 10px 30px rgba(0,0,0,0.05);
          margin-top: 24px;
        }

        .insightHead {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }

        .insightTitle {
          display: flex;
          align-items: center;
          gap: 10px;
          color: #0f172a;
        }

        .insightTitle h3 {
          margin: 0;
          font-size: 16px;
          font-weight: 900;
        }

        .aiBadge {
          background: linear-gradient(135deg, #6366f1, #a855f7);
          color: white;
          font-size: 10px;
          font-weight: 950;
          padding: 4px 8px;
          border-radius: 6px;
          letter-spacing: 0.5px;
        }

        .rulBox {
          display: flex;
          gap: 16px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          padding: 16px;
          border-radius: 16px;
          margin-bottom: 24px;
          align-items: center;
        }

        .rulIcon {
          width: 48px;
          height: 48px;
          background: #e0f2fe;
          color: #0ea5e9;
          border-radius: 12px;
          display: grid;
          place-items: center;
        }

        .rulLabel {
          display: block;
          font-size: 11px;
          color: #64748b;
          text-transform: uppercase;
          font-weight: 800;
        }

        .rulValue {
          display: block;
          font-size: 24px;
          font-weight: 950;
          color: #0f172a;
        }

        .rulSub {
          margin: 4px 0 0;
          font-size: 12px;
          color: #94a3b8;
          font-weight: 600;
        }

        .featureImportance {
          margin-bottom: 24px;
        }

        .featureHead {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }

        .featureHead h4 {
          margin: 0;
          font-size: 14px;
          color: #334155;
          font-weight: 800;
        }

        .featureList {
          display: grid;
          gap: 12px;
        }

        .featureRow {
          display: grid;
          grid-template-columns: 1fr 120px 40px;
          align-items: center;
          gap: 12px;
        }

        .featureMeta {
          display: flex;
          flex-direction: column;
        }

        .featureMeta span {
          font-size: 13px;
          font-weight: 700;
          color: #1e293b;
        }

        .featureMeta small {
          font-size: 10px;
          font-weight: 800;
          text-transform: uppercase;
        }

        .featureBarTrack {
          height: 6px;
          background: #f1f5f9;
          border-radius: 999px;
          overflow: hidden;
        }

        .featureBarFill {
          height: 100%;
          border-radius: 999px;
        }

        .featurePct {
          font-size: 12px;
          font-weight: 900;
          color: #64748b;
          text-align: right;
        }

        .recommendationBox {
          display: flex;
          gap: 12px;
          background: #fffbeb;
          border: 1px solid #fde68a;
          padding: 14px;
          border-radius: 12px;
          color: #92400e;
          font-size: 13px;
        }

        .recommendationBox strong {
          display: block;
          font-weight: 900;
          margin-bottom: 2px;
        }

        .recommendationBox p {
          margin: 0;
          font-weight: 600;
        }
      `}</style>
    </div>
  );
}

function ActivityIcon({ size }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="3" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    >
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
    </svg>
  );
}
