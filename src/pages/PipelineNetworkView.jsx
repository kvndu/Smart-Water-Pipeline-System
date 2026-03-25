import { useEffect, useMemo, useState } from "react";
import api from "../utils/api.js";

const AREA_POSITIONS = {
  Panadura: { x: 14, y: 16 },
  Walana: { x: 24, y: 24 },
  Waskaduwa: { x: 25, y: 37 },
  Kalutara: { x: 30, y: 48 },
  Pinwatta: { x: 33, y: 58 },
  Beruwala: { x: 39, y: 72 },
  Aluthgama: { x: 47, y: 82 },
  Payagala: { x: 23, y: 66 },
  Dodangoda: { x: 48, y: 43 },
  Halwatura: { x: 57, y: 56 },
  Mathugama: { x: 66, y: 60 },
  Agalawatta: { x: 79, y: 49 },
  Horana: { x: 71, y: 28 },
  Bulathsinhala: { x: 58, y: 34 },
  Millawa: { x: 73, y: 18 },
  Molkawa: { x: 87, y: 70 },
};

function getRiskColor(level) {
  if (level === "High") return "#ef4444";
  if (level === "Medium") return "#f59e0b";
  return "#10b981";
}

function getAreaName(pipeline) {
  return pipeline.area_name || pipeline.ds_division || "Unknown";
}

function normalizeAreaName(name) {
  const text = String(name || "").toLowerCase();

  if (text.includes("panadura")) return "Panadura";
  if (text.includes("walana")) return "Walana";
  if (text.includes("waskaduwa")) return "Waskaduwa";
  if (text.includes("kalutara")) return "Kalutara";
  if (text.includes("pinwatta")) return "Pinwatta";
  if (text.includes("beruwala")) return "Beruwala";
  if (text.includes("aluthgama")) return "Aluthgama";
  if (text.includes("payagala")) return "Payagala";
  if (text.includes("dodangoda")) return "Dodangoda";
  if (text.includes("halwatura")) return "Halwatura";
  if (text.includes("mathugama") || text.includes("matugama")) return "Mathugama";
  if (text.includes("agalawatta")) return "Agalawatta";
  if (text.includes("horana")) return "Horana";
  if (text.includes("bulathsinhala")) return "Bulathsinhala";
  if (text.includes("millawa")) return "Millawa";
  if (text.includes("molkawa")) return "Molkawa";

  return null;
}

function isKalutaraPipeline(pipeline) {
  return Boolean(normalizeAreaName(`${pipeline.area_name || ""} ${pipeline.ds_division || ""}`));
}

function buildEdges(pipelines) {
  const sorted = [...pipelines].sort(
    (a, b) => Number(b.risk_score || 0) - Number(a.risk_score || 0)
  );

  return sorted
    .map((pipeline, index) => {
      const area = normalizeAreaName(getAreaName(pipeline));
      if (!area || !AREA_POSITIONS[area]) return null;

      const keys = Object.keys(AREA_POSITIONS).filter((k) => k !== area);
      const target =
        keys[index % keys.length] ||
        "Kalutara";

      const from = AREA_POSITIONS[area];
      const to = AREA_POSITIONS[target];

      return {
        id: pipeline.pipeline_id,
        pipeline,
        fromArea: area,
        toArea: target,
        x1: from.x,
        y1: from.y,
        x2: to.x,
        y2: to.y,
        color: getRiskColor(pipeline.risk_level),
      };
    })
    .filter(Boolean)
    .slice(0, 120);
}

function SummaryChip({ label, value, tone = "" }) {
  return (
    <div className={`networkSummaryChip ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export default function PipelineNetworkView() {
  const [pipelines, setPipelines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedEdge, setSelectedEdge] = useState(null);
  const [riskFilter, setRiskFilter] = useState("All");
  const [search, setSearch] = useState("");

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        setError("");

        const res = await api.get("/pipelines-with-risk?limit=2000");
        const data = Array.isArray(res.data) ? res.data : [];
        setPipelines(data.filter(isKalutaraPipeline));
      } catch (err) {
        console.error(err);
        setError("Failed to load pipeline network data.");
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  const filteredPipelines = useMemo(() => {
    return pipelines.filter((p) => {
      const text =
        `${p.pipeline_id || ""} ${p.area_name || ""} ${p.ds_division || ""} ${p.material_type || ""}`.toLowerCase();

      const matchesSearch =
        search.trim() === "" || text.includes(search.trim().toLowerCase());

      const matchesRisk =
        riskFilter === "All" || (p.risk_level || "Low") === riskFilter;

      return matchesSearch && matchesRisk;
    });
  }, [pipelines, search, riskFilter]);

  const edges = useMemo(() => buildEdges(filteredPipelines), [filteredPipelines]);

  const stats = useMemo(() => {
    const total = filteredPipelines.length;
    const high = filteredPipelines.filter((p) => p.risk_level === "High").length;
    const medium = filteredPipelines.filter((p) => p.risk_level === "Medium").length;
    const low = filteredPipelines.filter((p) => p.risk_level === "Low").length;
    return { total, high, medium, low };
  }, [filteredPipelines]);

  const nodes = useMemo(() => {
    return Object.entries(AREA_POSITIONS).map(([name, pos]) => ({
      name,
      ...pos,
      count: filteredPipelines.filter(
        (p) => normalizeAreaName(getAreaName(p)) === name
      ).length,
    }));
  }, [filteredPipelines]);

  return (
    <div className="container" style={{ animation: "fadeIn 0.35s ease" }}>
      <div className="pageHero pageHeroCompact">
        <div>
          <div className="heroEyebrow">Network Blueprint View</div>
          <div className="pageTitle">Kalutara pipeline network</div>
          <div className="pageSubtitle">
            Visualize the Kalutara pipeline system as a schematic network with risk-colored pipeline links.
          </div>
        </div>

        <div className="pageActions">
          <span className="badge ok">District: Kalutara</span>
          <span className="badge">Blueprint network mode</span>
        </div>
      </div>

      {loading ? (
        <div className="card card-pad">Loading pipeline network...</div>
      ) : error ? (
        <div className="card card-pad" style={{ color: "var(--danger)" }}>
          {error}
        </div>
      ) : (
        <>
          <div className="networkSummaryGrid" style={{ marginBottom: 18 }}>
            <SummaryChip label="Visible pipelines" value={stats.total} />
            <SummaryChip label="High risk" value={stats.high} tone="toneHigh" />
            <SummaryChip label="Medium risk" value={stats.medium} tone="toneMedium" />
            <SummaryChip label="Low risk" value={stats.low} tone="toneLow" />
          </div>

          <div className="card card-pad" style={{ marginBottom: 18 }}>
            <div className="sectionHeader">
              <div>
                <div className="sectionTitle">Network filters</div>
                <div className="sectionSubtitle">
                  Search by pipeline ID or filter the network by risk level.
                </div>
              </div>
            </div>

            <div className="filterGrid">
              <input
                className="input"
                placeholder="Search by pipeline ID, area, division, or material"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />

              <select
                className="select"
                value={riskFilter}
                onChange={(e) => setRiskFilter(e.target.value)}
              >
                {["All", "Low", "Medium", "High"].map((r) => (
                  <option key={r} value={r}>
                    Risk: {r}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="networkLayoutGrid">
            <div className="card card-pad">
              <div className="sectionHeader">
                <div>
                  <div className="sectionTitle">Pipeline blueprint network</div>
                  <div className="sectionSubtitle">
                    Click any pipeline link to inspect the selected record.
                  </div>
                </div>
              </div>

              <div className="networkBlueprintWrap">
                <svg
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                  className="networkSvg"
                >
                  <defs>
                    <pattern
                      id="gridPattern"
                      width="4"
                      height="4"
                      patternUnits="userSpaceOnUse"
                    >
                      <path d="M 4 0 L 0 0 0 4" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="0.1" />
                    </pattern>
                  </defs>

                  <rect x="0" y="0" width="100" height="100" fill="url(#gridPattern)" />

                  {edges.map((edge) => (
                    <g key={edge.id}>
                      <line
                        x1={edge.x1}
                        y1={edge.y1}
                        x2={edge.x2}
                        y2={edge.y2}
                        stroke={edge.color}
                        strokeWidth={selectedEdge?.id === edge.id ? 0.9 : 0.45}
                        strokeOpacity={selectedEdge?.id === edge.id ? 1 : 0.78}
                        className="networkEdge"
                        onClick={() => setSelectedEdge(edge)}
                      />
                    </g>
                  ))}

                  {nodes.map((node) => (
                    <g key={node.name}>
                      <circle
                        cx={node.x}
                        cy={node.y}
                        r={node.count > 0 ? 1.1 : 0.6}
                        className="networkNode"
                      />
                      <text
                        x={node.x + 1.2}
                        y={node.y - 1}
                        className="networkNodeLabel"
                      >
                        {node.name}
                      </text>
                    </g>
                  ))}
                </svg>
              </div>
            </div>

            <div className="vstack">
              <div className="card card-pad">
                <div className="sectionHeader">
                  <div>
                    <div className="sectionTitle">Network legend</div>
                    <div className="sectionSubtitle">
                      Understand the line colors and the node symbols.
                    </div>
                  </div>
                </div>

                <div className="networkLegendList">
                  <div className="networkLegendItem">
                    <span className="networkLegendLine low"></span>
                    <span>Low risk pipeline</span>
                  </div>
                  <div className="networkLegendItem">
                    <span className="networkLegendLine medium"></span>
                    <span>Medium risk pipeline</span>
                  </div>
                  <div className="networkLegendItem">
                    <span className="networkLegendLine high"></span>
                    <span>High risk pipeline</span>
                  </div>
                  <div className="networkLegendItem">
                    <span className="networkLegendNode"></span>
                    <span>Area / junction node</span>
                  </div>
                </div>
              </div>

              <div className="card card-pad">
                <div className="sectionHeader">
                  <div>
                    <div className="sectionTitle">Selected pipeline</div>
                    <div className="sectionSubtitle">
                      Click a network line to inspect its details.
                    </div>
                  </div>
                </div>

                {!selectedEdge ? (
                  <div className="emptyState">
                    Select a pipeline line from the blueprint network to see details here.
                  </div>
                ) : (
                  <div className="detailGrid">
                    <div className="detailItem">
                      <div className="detailLabel">Pipeline ID</div>
                      <div className="detailValue">{selectedEdge.pipeline.pipeline_id}</div>
                    </div>
                    <div className="detailItem">
                      <div className="detailLabel">From area</div>
                      <div className="detailValue">{selectedEdge.fromArea}</div>
                    </div>
                    <div className="detailItem">
                      <div className="detailLabel">To area</div>
                      <div className="detailValue">{selectedEdge.toArea}</div>
                    </div>
                    <div className="detailItem">
                      <div className="detailLabel">Actual area</div>
                      <div className="detailValue">{selectedEdge.pipeline.area_name || "-"}</div>
                    </div>
                    <div className="detailItem">
                      <div className="detailLabel">Division</div>
                      <div className="detailValue">{selectedEdge.pipeline.ds_division || "-"}</div>
                    </div>
                    <div className="detailItem">
                      <div className="detailLabel">Material</div>
                      <div className="detailValue">{selectedEdge.pipeline.material_type || "-"}</div>
                    </div>
                    <div className="detailItem">
                      <div className="detailLabel">Risk level</div>
                      <div className="detailValue">{selectedEdge.pipeline.risk_level || "-"}</div>
                    </div>
                    <div className="detailItem">
                      <div className="detailLabel">Risk score</div>
                      <div className="detailValue">
                        {Number(selectedEdge.pipeline.risk_score || 0).toFixed(3)}
                      </div>
                    </div>
                    <div className="detailItem">
                      <div className="detailLabel">Leak count</div>
                      <div className="detailValue">{selectedEdge.pipeline.previous_leak_count || 0}</div>
                    </div>
                    <div className="detailItem">
                      <div className="detailLabel">Install year</div>
                      <div className="detailValue">{selectedEdge.pipeline.install_year || "-"}</div>
                    </div>
                  </div>
                )}
              </div>

              <div className="card card-pad">
                <div className="sectionHeader">
                  <div>
                    <div className="sectionTitle">Why this view matters</div>
                    <div className="sectionSubtitle">
                      Strong explanation for presentation and viva.
                    </div>
                  </div>
                </div>

                <div className="vstack">
                  <div className="detailItem">
                    <div className="detailLabel">Purpose</div>
                    <div className="detailValue">
                      This page shows the Kalutara water pipeline system as a network blueprint.
                    </div>
                  </div>
                  <div className="detailItem">
                    <div className="detailLabel">Benefit</div>
                    <div className="detailValue">
                      Engineers can quickly identify risky pipeline links and network zones.
                    </div>
                  </div>
                  <div className="detailItem">
                    <div className="detailLabel">Visualization style</div>
                    <div className="detailValue">
                      Schematic network view based on district areas and pipeline records.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}