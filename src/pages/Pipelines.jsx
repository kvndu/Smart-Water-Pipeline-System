import { useEffect, useMemo, useState } from "react";

const API_BASE = "http://127.0.0.1:8000";

function getRiskBadgeClass(level) {
  if (level === "High") return "risk-chip high";
  if (level === "Medium") return "risk-chip medium";
  return "risk-chip low";
}

function getTrendBadgeClass(trend) {
  if (trend === "Increasing") return "trend-chip increasing";
  if (trend === "Decreasing") return "trend-chip decreasing";
  return "trend-chip stable";
}

function getFailureClass(value) {
  if (value >= 80) return "failure-chip danger";
  if (value >= 50) return "failure-chip warning";
  return "failure-chip safe";
}

function formatNumber(value, fallback = "-") {
  if (value === null || value === undefined || value === "") return fallback;
  return value;
}

function SegmentBar({ pipeline }) {
  const length = Number(pipeline?.pipe_length_m || 0);
  const start = Number(pipeline?.weakest_segment_start_m || 0);
  const end = Number(pipeline?.weakest_segment_end_m || 0);

  if (!length || end <= start) {
    return <div className="segment-empty">No segment data</div>;
  }

  const leftPercent = (start / length) * 100;
  const widthPercent = ((end - start) / length) * 100;

  return (
    <div className="segment-wrap">
      <div className="segment-track">
        <div
          className="segment-danger"
          style={{
            left: `${leftPercent}%`,
            width: `${Math.max(widthPercent, 8)}%`,
          }}
        />
      </div>
      <div className="segment-labels">
        <span>0m</span>
        <span>{length}m</span>
      </div>
    </div>
  );
}

function PipelineDetailsDrawer({ pipeline, onClose }) {
  if (!pipeline) return null;

  return (
    <div className="details-overlay" onClick={onClose}>
      <div className="details-drawer" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-header">
          <div>
            <p className="drawer-kicker">Pipeline intelligence</p>
            <h2>{pipeline.pipeline_id}</h2>
            <p className="drawer-subtitle">
              {pipeline.area_name} • {pipeline.ds_division}
            </p>
          </div>
          <button className="drawer-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="details-grid">
          <div className="info-card">
            <p className="card-label">Risk level</p>
            <div className={getRiskBadgeClass(pipeline.risk_level)}>
              {pipeline.risk_level || "Low"}
            </div>
          </div>

          <div className="info-card">
            <p className="card-label">Failure probability</p>
            <div className={getFailureClass(pipeline.failure_probability)}>
              {formatNumber(pipeline.failure_probability, 0)}%
            </div>
          </div>

          <div className="info-card">
            <p className="card-label">Risk trend</p>
            <div className={getTrendBadgeClass(pipeline.risk_trend)}>
              {pipeline.risk_trend || "Stable"}
            </div>
          </div>

          <div className="info-card">
            <p className="card-label">Estimated safe life</p>
            <h3>{formatNumber(pipeline.estimated_life_months, 0)} months</h3>
          </div>
        </div>

        <div className="drawer-section">
          <h3>Forecast insight</h3>
          <div className="details-grid">
            <div className="info-card">
              <p className="card-label">Current risk score</p>
              <h3>{formatNumber(pipeline.risk_score)}</h3>
            </div>
            <div className="info-card">
              <p className="card-label">Next 30 days</p>
              <h3>{formatNumber(pipeline.risk_30_day)}</h3>
            </div>
            <div className="info-card">
              <p className="card-label">Next 90 days</p>
              <h3>{formatNumber(pipeline.risk_90_day)}</h3>
            </div>
            <div className="info-card">
              <p className="card-label">Weakest segment risk</p>
              <h3>{formatNumber(pipeline.weakest_segment_risk)}</h3>
            </div>
          </div>
        </div>

        <div className="drawer-section">
          <h3>Probable failure zone</h3>
          <div className="zone-card">
            <p className="zone-text">
              {formatNumber(pipeline.weakest_segment_start_m, 0)}m →{" "}
              {formatNumber(pipeline.weakest_segment_end_m, 0)}m
            </p>
            <p className="zone-subtext">
              This is the most vulnerable segment predicted by the backend risk engine.
            </p>
            <SegmentBar pipeline={pipeline} />
          </div>
        </div>

        <div className="drawer-section">
          <h3>Technical details</h3>
          <div className="details-grid">
            <div className="info-card">
              <p className="card-label">Material</p>
              <h3>{pipeline.material_type}</h3>
            </div>
            <div className="info-card">
              <p className="card-label">Diameter</p>
              <h3>{pipeline.diameter_mm} mm</h3>
            </div>
            <div className="info-card">
              <p className="card-label">Length</p>
              <h3>{pipeline.pipe_length_m} m</h3>
            </div>
            <div className="info-card">
              <p className="card-label">Install year</p>
              <h3>{pipeline.install_year}</h3>
            </div>
            <div className="info-card">
              <p className="card-label">Previous leaks</p>
              <h3>{pipeline.previous_leak_count}</h3>
            </div>
            <div className="info-card">
              <p className="card-label">Previous repairs</p>
              <h3>{pipeline.previous_repair_count}</h3>
            </div>
            <div className="info-card">
              <p className="card-label">Last maintenance</p>
              <h3>{pipeline.last_maintenance_year}</h3>
            </div>
            <div className="info-card">
              <p className="card-label">Annual rainfall</p>
              <h3>{pipeline.annual_rainfall_mm} mm</h3>
            </div>
          </div>
        </div>

        <div className="drawer-section">
          <h3>Recommendation</h3>
          <div className="recommend-card">
            <p>
              <strong>Action:</strong>{" "}
              {pipeline.recommendation?.action || "Routine monitoring"}
            </p>
            <p>
              <strong>Priority:</strong>{" "}
              {pipeline.recommendation?.priority || "Low"}
            </p>
            <p>
              <strong>Message:</strong>{" "}
              {pipeline.recommendation?.message || "No recommendation"}
            </p>
            <div className="reasons-list">
              {(pipeline.recommendation?.reasons || []).map((reason, idx) => (
                <span key={idx} className="reason-pill">
                  {reason}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Pipelines() {
  const [pipelines, setPipelines] = useState([]);
  const [search, setSearch] = useState("");
  const [riskFilter, setRiskFilter] = useState("All");
  const [sortBy, setSortBy] = useState("default");
  const [selectedPipeline, setSelectedPipeline] = useState(null);
  const [loading, setLoading] = useState(true);

  async function loadPipelines() {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/pipelines-with-risk?limit=1000`);
      const data = await res.json();
      setPipelines(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to fetch pipelines:", error);
      setPipelines([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPipelines();
  }, []);

  const filteredPipelines = useMemo(() => {
    let list = [...pipelines];

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((p) =>
        [
          p.pipeline_id,
          p.area_name,
          p.ds_division,
          p.material_type,
          p.risk_level,
        ]
          .join(" ")
          .toLowerCase()
          .includes(q)
      );
    }

    if (riskFilter !== "All") {
      list = list.filter((p) => p.risk_level === riskFilter);
    }

    if (sortBy === "failure_desc") {
      list.sort((a, b) => (b.failure_probability || 0) - (a.failure_probability || 0));
    } else if (sortBy === "risk_desc") {
      list.sort((a, b) => (b.risk_score || 0) - (a.risk_score || 0));
    } else if (sortBy === "life_asc") {
      list.sort((a, b) => (a.estimated_life_months || 0) - (b.estimated_life_months || 0));
    } else if (sortBy === "leaks_desc") {
      list.sort((a, b) => (b.previous_leak_count || 0) - (a.previous_leak_count || 0));
    }

    return list;
  }, [pipelines, search, riskFilter, sortBy]);

  const topStats = useMemo(() => {
    const high = filteredPipelines.filter((p) => p.risk_level === "High").length;
    const medium = filteredPipelines.filter((p) => p.risk_level === "Medium").length;
    const avgFailure = filteredPipelines.length
      ? Math.round(
          filteredPipelines.reduce((sum, p) => sum + (p.failure_probability || 0), 0) /
            filteredPipelines.length
        )
      : 0;

    return {
      total: filteredPipelines.length,
      high,
      medium,
      avgFailure,
    };
  }, [filteredPipelines]);

  return (
    <div className="page-shell">
      <style>{`
        .page-shell {
          padding: 24px;
          background: #eef5fb;
          min-height: 100vh;
        }

        .page-top-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 16px;
          margin-bottom: 18px;
        }

        .top-card, .panel, .info-card, .zone-card, .recommend-card {
          background: #ffffff;
          border: 1px solid #dce7f3;
          border-radius: 18px;
          box-shadow: 0 8px 24px rgba(21, 63, 117, 0.06);
        }

        .top-card {
          padding: 18px 18px;
        }

        .top-card p {
          margin: 0 0 8px;
          color: #6b7b93;
          font-size: 14px;
        }

        .top-card h2 {
          margin: 0;
          font-size: 36px;
          color: #10233f;
        }

        .panel {
          padding: 20px;
          margin-bottom: 18px;
        }

        .panel-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          margin-bottom: 16px;
        }

        .panel-header h2 {
          margin: 0;
          font-size: 28px;
          color: #10233f;
        }

        .panel-subtitle {
          margin: 6px 0 0;
          color: #70809b;
          font-size: 14px;
        }

        .filters {
          display: grid;
          grid-template-columns: 2fr 1fr 1fr;
          gap: 12px;
          margin-top: 14px;
        }

        .input, .select {
          height: 48px;
          border-radius: 14px;
          border: 1px solid #cdd9e8;
          padding: 0 14px;
          font-size: 15px;
          outline: none;
          background: #fff;
        }

        .table-wrap {
          overflow: auto;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          min-width: 1200px;
        }

        thead th {
          text-align: left;
          font-size: 13px;
          color: #5a6b85;
          padding: 16px 14px;
          border-bottom: 1px solid #e3edf7;
          white-space: nowrap;
        }

        tbody td {
          padding: 16px 14px;
          border-bottom: 1px solid #edf3f9;
          color: #10233f;
          font-size: 14px;
          vertical-align: middle;
        }

        tbody tr:hover {
          background: #f8fbff;
        }

        .pipeline-id {
          font-weight: 700;
        }

        .risk-chip, .trend-chip, .failure-chip, .reason-pill {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 999px;
          font-weight: 700;
        }

        .risk-chip, .trend-chip, .failure-chip {
          padding: 8px 14px;
          font-size: 13px;
        }

        .risk-chip.low {
          background: #daf5e7;
          color: #167a4a;
        }

        .risk-chip.medium {
          background: #fff2cf;
          color: #a96a00;
        }

        .risk-chip.high {
          background: #ffe0e0;
          color: #b42318;
        }

        .trend-chip.increasing {
          background: #ffe0e0;
          color: #b42318;
        }

        .trend-chip.decreasing {
          background: #daf5e7;
          color: #167a4a;
        }

        .trend-chip.stable {
          background: #edf2f7;
          color: #526075;
        }

        .failure-chip.safe {
          background: #daf5e7;
          color: #167a4a;
        }

        .failure-chip.warning {
          background: #fff2cf;
          color: #a96a00;
        }

        .failure-chip.danger {
          background: #ffe0e0;
          color: #b42318;
        }

        .view-btn {
          height: 40px;
          border: none;
          border-radius: 12px;
          background: #2f67f6;
          color: white;
          padding: 0 16px;
          font-weight: 700;
          cursor: pointer;
        }

        .view-btn:hover {
          opacity: 0.92;
        }

        .details-overlay {
          position: fixed;
          inset: 0;
          background: rgba(6, 22, 44, 0.42);
          display: flex;
          justify-content: flex-end;
          z-index: 999;
        }

        .details-drawer {
          width: min(760px, 100%);
          height: 100%;
          background: #f5f9ff;
          overflow-y: auto;
          padding: 24px;
          box-shadow: -10px 0 40px rgba(0,0,0,0.12);
        }

        .drawer-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 12px;
          margin-bottom: 20px;
        }

        .drawer-kicker {
          margin: 0 0 6px;
          color: #5573a5;
          font-size: 13px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }

        .drawer-header h2 {
          margin: 0;
          font-size: 30px;
          color: #10233f;
        }

        .drawer-subtitle {
          margin: 6px 0 0;
          color: #6e7f98;
        }

        .drawer-close {
          width: 42px;
          height: 42px;
          border-radius: 12px;
          border: none;
          background: #e9f0fb;
          cursor: pointer;
          font-size: 18px;
        }

        .drawer-section {
          margin-bottom: 20px;
        }

        .drawer-section h3 {
          margin: 0 0 12px;
          color: #10233f;
          font-size: 20px;
        }

        .details-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
        }

        .info-card {
          padding: 16px;
        }

        .card-label {
          margin: 0 0 10px;
          color: #6e7f98;
          font-size: 13px;
        }

        .info-card h3 {
          margin: 0;
          font-size: 24px;
          color: #10233f;
        }

        .zone-card, .recommend-card {
          padding: 18px;
        }

        .zone-text {
          font-size: 24px;
          font-weight: 800;
          color: #10233f;
          margin: 0 0 8px;
        }

        .zone-subtext {
          margin: 0 0 14px;
          color: #6e7f98;
          font-size: 14px;
        }

        .segment-wrap {
          margin-top: 12px;
        }

        .segment-track {
          position: relative;
          height: 16px;
          background: #dce6f2;
          border-radius: 999px;
          overflow: hidden;
        }

        .segment-danger {
          position: absolute;
          top: 0;
          bottom: 0;
          background: linear-gradient(90deg, #f59e0b, #ef4444);
          border-radius: 999px;
        }

        .segment-labels {
          display: flex;
          justify-content: space-between;
          margin-top: 8px;
          color: #60718a;
          font-size: 12px;
        }

        .segment-empty {
          font-size: 14px;
          color: #6e7f98;
        }

        .reasons-list {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 14px;
        }

        .reason-pill {
          padding: 8px 12px;
          background: #eaf2ff;
          color: #234e9b;
          font-size: 12px;
        }

        .loading-box, .empty-box {
          padding: 30px;
          text-align: center;
          color: #667890;
        }

        @media (max-width: 1100px) {
          .page-top-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .filters {
            grid-template-columns: 1fr;
          }

          .details-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 700px) {
          .page-top-grid {
            grid-template-columns: 1fr;
          }

          .panel-header {
            flex-direction: column;
            align-items: flex-start;
          }
        }
      `}</style>

      <div className="page-top-grid">
        <div className="top-card">
          <p>Visible pipelines</p>
          <h2>{topStats.total}</h2>
        </div>
        <div className="top-card">
          <p>High risk</p>
          <h2>{topStats.high}</h2>
        </div>
        <div className="top-card">
          <p>Medium risk</p>
          <h2>{topStats.medium}</h2>
        </div>
        <div className="top-card">
          <p>Average failure probability</p>
          <h2>{topStats.avgFailure}%</h2>
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <div>
            <h2>Pipeline intelligence list</h2>
            <p className="panel-subtitle">
              View risk prediction, future trend, and the most vulnerable segment for each pipeline.
            </p>
          </div>
        </div>

        <div className="filters">
          <input
            className="input"
            type="text"
            placeholder="Search by pipeline ID, area, division, material..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <select
            className="select"
            value={riskFilter}
            onChange={(e) => setRiskFilter(e.target.value)}
          >
            <option value="All">Risk: All</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>

          <select
            className="select"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            <option value="default">Sort by</option>
            <option value="failure_desc">Highest failure probability</option>
            <option value="risk_desc">Highest risk score</option>
            <option value="life_asc">Lowest estimated life</option>
            <option value="leaks_desc">Most leaks</option>
          </select>
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <div>
            <h2>Pipeline list</h2>
            <p className="panel-subtitle">
              Smart pipeline monitoring with prediction-ready data from the backend.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="loading-box">Loading pipelines...</div>
        ) : filteredPipelines.length === 0 ? (
          <div className="empty-box">No pipelines found for the current filters.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>PIPELINE ID</th>
                  <th>AREA</th>
                  <th>DIVISION</th>
                  <th>MATERIAL</th>
                  <th>RISK</th>
                  <th>FAILURE %</th>
                  <th>30-DAY</th>
                  <th>90-DAY</th>
                  <th>TREND</th>
                  <th>SAFE LIFE</th>
                  <th>WEAKEST ZONE</th>
                  <th>DETAILS</th>
                </tr>
              </thead>
              <tbody>
                {filteredPipelines.map((pipeline) => (
                  <tr key={pipeline.pipeline_id}>
                    <td className="pipeline-id">{pipeline.pipeline_id}</td>
                    <td>{pipeline.area_name}</td>
                    <td>{pipeline.ds_division}</td>
                    <td>{pipeline.material_type}</td>
                    <td>
                      <span className={getRiskBadgeClass(pipeline.risk_level)}>
                        {pipeline.risk_level}
                      </span>
                    </td>
                    <td>
                      <span className={getFailureClass(pipeline.failure_probability)}>
                        {formatNumber(pipeline.failure_probability, 0)}%
                      </span>
                    </td>
                    <td>{formatNumber(pipeline.risk_30_day)}</td>
                    <td>{formatNumber(pipeline.risk_90_day)}</td>
                    <td>
                      <span className={getTrendBadgeClass(pipeline.risk_trend)}>
                        {pipeline.risk_trend || "Stable"}
                      </span>
                    </td>
                    <td>{formatNumber(pipeline.estimated_life_months, 0)} mo</td>
                    <td>
                      {formatNumber(pipeline.weakest_segment_start_m, 0)}m -{" "}
                      {formatNumber(pipeline.weakest_segment_end_m, 0)}m
                    </td>
                    <td>
                      <button
                        className="view-btn"
                        onClick={() => setSelectedPipeline(pipeline)}
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <PipelineDetailsDrawer
        pipeline={selectedPipeline}
        onClose={() => setSelectedPipeline(null)}
      />
    </div>
  );
}