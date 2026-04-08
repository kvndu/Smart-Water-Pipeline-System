import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../utils/api.js";
import {
  MapContainer,
  TileLayer,
  Polyline,
  Popup,
  Tooltip,
  CircleMarker,
  useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";

const KALUTARA_CENTER = [6.5854, 79.9607];

const AREA_ANCHORS = {
  "Panadura Town": [6.7132, 79.9070],
  "Payagala Link": [6.5480, 79.9730],
  "Bulathsinhala Town": [6.7260, 80.0160],
  "Agalawatta Link": [6.5410, 80.1570],
  "Kalutara South": [6.5680, 79.9600],
  "Diyagama": [6.5140, 80.1160],
  "Kalutara North": [6.6000, 79.9680],
  Aluthgama: [6.4340, 79.9950],
  Walana: [6.6590, 79.9300],
  Halwatura: [6.7450, 80.0620],
  Molkawa: [6.6190, 80.1290],
  Waskaduwa: [6.6310, 79.9550],
  Pinwatta: [6.6530, 79.9480],
  Millewa: [6.6610, 80.0730],
  Yatadolawatta: [6.6890, 80.1040],
  Moragahahena: [6.7170, 80.1000],
  "Millaniya Link": [6.6700, 80.0300],
  Thebuwana: [6.5980, 80.1150],
  Wewita: [6.7230, 79.9900],
  Moragalla: [6.4780, 79.9840],
  Bombuwala: [6.5880, 79.9940],
  Galpatha: [6.5940, 80.0410],
  Pokunuwita: [6.7890, 80.0930],
  "Horana Town": [6.7159, 80.0626],
  "Bandaragama Town": [6.7150, 79.9870],
  Nagoda: [6.5520, 79.9800],
  Rajgama: [6.7040, 80.0100],
  "Agalawatta Town": [6.5400, 80.1550],
  "Aluthgama Inland": [6.4500, 80.0100],
};

const DIVISION_ANCHORS = {
  Panadura: [6.7100, 79.9100],
  Dodangoda: [6.5640, 80.0100],
  Bulathsinhala: [6.7220, 80.0180],
  Matugama: [6.5210, 80.1140],
  Kalutara: [6.5854, 79.9607],
  Agalawatta: [6.5400, 80.1550],
  Beruwala: [6.4788, 79.9828],
  Horana: [6.7159, 80.0626],
  Bandaragama: [6.7150, 79.9870],
};

function getRiskColor(level) {
  if (level === "High") return "#ef4444";
  if (level === "Medium") return "#f59e0b";
  return "#10b981";
}

function getRiskWeight(level, selected = false, main = false) {
  let base = main ? 6 : 4;
  if (level === "High") base += 1;
  if (level === "Low") base -= 1;
  return selected ? base + 2 : base;
}

function getRiskTone(level) {
  if (level === "High") return "toneHigh";
  if (level === "Medium") return "toneMedium";
  return "toneLow";
}

function SummaryChip({ label, value, tone = "" }) {
  return (
    <div className={`mapSummaryChip ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function safeNum(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function deterministicUnit(seed) {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (seed.charCodeAt(i) + ((hash << 5) - hash)) | 0;
  }
  return ((hash % 1000) + 1000) % 1000 / 1000;
}

function getAnchor(pipeline) {
  const area = pipeline.area_name || "";
  const division = pipeline.ds_division || "";
  if (AREA_ANCHORS[area]) return AREA_ANCHORS[area];
  if (DIVISION_ANCHORS[division]) return DIVISION_ANCHORS[division];
  return [safeNum(pipeline.start_lat, KALUTARA_CENTER[0]), safeNum(pipeline.start_lng, KALUTARA_CENTER[1])];
}

function buildCurvedPipelinePath(pipeline) {
  const startLat = safeNum(pipeline.start_lat);
  const startLng = safeNum(pipeline.start_lng);
  const endLat = safeNum(pipeline.end_lat);
  const endLng = safeNum(pipeline.end_lng);

  if (!startLat || !startLng || !endLat || !endLng) return null;

  const anchor = getAnchor(pipeline);
  const centerLat = (startLat + endLat) / 2;
  const centerLng = (startLng + endLng) / 2;

  const seed = `${pipeline.pipeline_id}-${pipeline.material_type}-${pipeline.ds_division}`;
  const bendFactor = deterministicUnit(seed + "-bend");
  const sideFactor = deterministicUnit(seed + "-side");

  const latDiff = endLat - startLat;
  const lngDiff = endLng - startLng;

  const perpLat = -lngDiff;
  const perpLng = latDiff;

  const norm = Math.sqrt(perpLat * perpLat + perpLng * perpLng) || 1;
  const unitPerpLat = perpLat / norm;
  const unitPerpLng = perpLng / norm;

  const curvature = 0.004 + bendFactor * 0.01;
  const direction = sideFactor > 0.5 ? 1 : -1;

  const midLat =
    centerLat * 0.55 +
    anchor[0] * 0.45 +
    unitPerpLat * curvature * direction;

  const midLng =
    centerLng * 0.55 +
    anchor[1] * 0.45 +
    unitPerpLng * curvature * direction;

  return [
    [startLat, startLng],
    [midLat, midLng],
    [endLat, endLng],
  ];
}

function interpolateQuadratic(points, t) {
  const [p0, p1, p2] = points;
  const lat =
    (1 - t) * (1 - t) * p0[0] +
    2 * (1 - t) * t * p1[0] +
    t * t * p2[0];
  const lng =
    (1 - t) * (1 - t) * p0[1] +
    2 * (1 - t) * t * p1[1] +
    t * t * p2[1];
  return [lat, lng];
}

function buildWeakSegmentCurve(pipeline, pathPoints) {
  const totalLength = safeNum(pipeline.pipe_length_m, 0);
  const weakStart = safeNum(pipeline.weakest_segment_start_m, 0);
  const weakEnd = safeNum(pipeline.weakest_segment_end_m, 0);

  if (!totalLength || weakEnd <= weakStart || !pathPoints || pathPoints.length !== 3) {
    return null;
  }

  const startT = Math.max(0, Math.min(1, weakStart / totalLength));
  const endT = Math.max(0, Math.min(1, weakEnd / totalLength));

  const segment = [];
  const steps = 10;
  for (let i = 0; i <= steps; i += 1) {
    const t = startT + ((endT - startT) * i) / steps;
    segment.push(interpolateQuadratic(pathPoints, t));
  }
  return segment;
}

function classifyMainPipeline(pipeline) {
  const length = safeNum(pipeline.pipe_length_m, 0);
  const diameter = safeNum(pipeline.diameter_mm, 0);
  return length >= 1800 || diameter >= 250;
}

function MapAutoFit({ pipelines, selectedPipeline }) {
  const map = useMap();

  useEffect(() => {
    if (selectedPipeline) {
      const path = buildCurvedPipelinePath(selectedPipeline);
      if (path) {
        map.fitBounds(path, { padding: [80, 80], maxZoom: 14 });
      }
      return;
    }

    if (!pipelines.length) return;

    const bounds = pipelines.flatMap((p) => {
      const path = buildCurvedPipelinePath(p);
      return path || [];
    });

    if (bounds.length) {
      map.fitBounds(bounds, { padding: [40, 40] });
    }
  }, [map, pipelines, selectedPipeline]);

  return null;
}

function MapPopupContent({ pipeline }) {
  return (
    <div className="mapPopup">
      <div className="mapPopupTitle">Pipeline Details</div>
      <div><strong>ID:</strong> {pipeline.pipeline_id}</div>
      <div><strong>Area:</strong> {pipeline.area_name || "-"}</div>
      <div><strong>Division:</strong> {pipeline.ds_division || "-"}</div>
      <div><strong>Material:</strong> {pipeline.material_type || "-"}</div>
      <div><strong>Risk Level:</strong> {pipeline.risk_level || "-"}</div>
      <div><strong>Risk Score:</strong> {safeNum(pipeline.risk_score).toFixed(3)}</div>
      <div><strong>Failure Probability:</strong> {pipeline.failure_probability || 0}%</div>
      <div><strong>Trend:</strong> {pipeline.risk_trend || "-"}</div>
      <div><strong>Estimated Life:</strong> {pipeline.estimated_life_months || 0} months</div>
      <div>
        <strong>Weakest Zone:</strong>{" "}
        {pipeline.weakest_segment_start_m || 0}m - {pipeline.weakest_segment_end_m || 0}m
      </div>
      <div style={{ marginTop: 10 }}>
        <Link to={`/pipelines/${pipeline.pipeline_id}`} className="mapPopupButton">
          Open Detail Page
        </Link>
      </div>
    </div>
  );
}

function SelectedPipelinePanel({ pipeline, onClear }) {
  if (!pipeline) {
    return (
      <div className="card card-pad">
        <div className="sectionHeader">
          <div>
            <div className="sectionTitle">Selected pipeline</div>
            <div className="sectionSubtitle">
              Click a line on the map to inspect that asset.
            </div>
          </div>
        </div>

        <div className="vstack">
          <div className="detailItem">
            <div className="detailLabel">Status</div>
            <div className="detailValue">
              No pipeline selected. Use the map or filters to focus on one asset.
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card card-pad">
      <div className="sectionHeader">
        <div>
          <div className="sectionTitle">Selected pipeline</div>
          <div className="sectionSubtitle">
            Focused operational view of the highlighted asset.
          </div>
        </div>

        <button className="mapClearBtn" onClick={onClear}>
          Clear
        </button>
      </div>

      <div className="vstack">
        <div className="detailItem">
          <div className="detailLabel">Pipeline ID</div>
          <div className="detailValue">{pipeline.pipeline_id}</div>
        </div>
        <div className="detailItem">
          <div className="detailLabel">Area</div>
          <div className="detailValue">{pipeline.area_name || "-"}</div>
        </div>
        <div className="detailItem">
          <div className="detailLabel">Division</div>
          <div className="detailValue">{pipeline.ds_division || "-"}</div>
        </div>
        <div className="detailItem">
          <div className="detailLabel">Risk level</div>
          <div className={`mapRiskBadge ${getRiskTone(pipeline.risk_level)}`}>
            {pipeline.risk_level || "Low"}
          </div>
        </div>
        <div className="detailItem">
          <div className="detailLabel">Failure probability</div>
          <div className="detailValue">{pipeline.failure_probability || 0}%</div>
        </div>
        <div className="detailItem">
          <div className="detailLabel">Risk trend</div>
          <div className="detailValue">{pipeline.risk_trend || "-"}</div>
        </div>
        <div className="detailItem">
          <div className="detailLabel">Estimated safe life</div>
          <div className="detailValue">{pipeline.estimated_life_months || 0} months</div>
        </div>
        <div className="detailItem">
          <div className="detailLabel">Weakest zone</div>
          <div className="detailValue">
            {pipeline.weakest_segment_start_m || 0}m - {pipeline.weakest_segment_end_m || 0}m
          </div>
        </div>
        <div className="detailItem">
          <div className="detailLabel">Type</div>
          <div className="detailValue">
            {classifyMainPipeline(pipeline) ? "Main trunk / primary line" : "Branch / local line"}
          </div>
        </div>
        <div className="detailItem">
          <div className="detailLabel">Action</div>
          <div className="detailValue">
            <Link to={`/pipelines/${pipeline.pipeline_id}`} className="mapPopupButton">
              Open full detail page
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function NodeOverlay({ pipelines, selectedPipelineId, onSelectNode }) {
  const nodes = useMemo(() => {
    const grouped = new Map();

    pipelines.forEach((p) => {
      const key = `${p.area_name || p.ds_division || "Unknown"}`;
      const anchor = getAnchor(p);
      if (!grouped.has(key)) {
        grouped.set(key, {
          key,
          name: key,
          lat: anchor[0],
          lng: anchor[1],
          count: 0,
          high: 0,
        });
      }
      const entry = grouped.get(key);
      entry.count += 1;
      if (p.risk_level === "High") entry.high += 1;
    });

    return Array.from(grouped.values());
  }, [pipelines]);

  return nodes.map((node) => (
    <CircleMarker
      key={node.key}
      center={[node.lat, node.lng]}
      radius={node.high > 0 ? 6 : 4}
      pathOptions={{
        color: "#1d4ed8",
        fillColor: "#ffffff",
        fillOpacity: 0.95,
        weight: 2,
        opacity: selectedPipelineId ? 0.45 : 0.85,
      }}
      eventHandlers={{
        click: () => onSelectNode(node.name),
      }}
    >
      <Tooltip direction="top" offset={[0, -4]} opacity={1}>
        {node.name} node
      </Tooltip>
      <Popup>
        <div className="mapPopup">
          <div className="mapPopupTitle">Area / Junction Node</div>
          <div><strong>Name:</strong> {node.name}</div>
          <div><strong>Visible pipelines:</strong> {node.count}</div>
          <div><strong>High-risk visible:</strong> {node.high}</div>
        </div>
      </Popup>
    </CircleMarker>
  ));
}

export default function MapView() {
  const [pipelines, setPipelines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [riskFilter, setRiskFilter] = useState("High");
  const [areaFilter, setAreaFilter] = useState("All");
  const [showOnlyHigh, setShowOnlyHigh] = useState(true);
  const [selectedPipelineId, setSelectedPipelineId] = useState(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        setError("");
        const res = await api.get("/pipelines-with-risk?limit=2000");
        const data = Array.isArray(res.data) ? res.data : [];

        const onlyMapped = data.filter(
          (p) =>
            p.start_lat != null &&
            p.start_lng != null &&
            p.end_lat != null &&
            p.end_lng != null
        );

        setPipelines(onlyMapped);
      } catch (err) {
        console.error(err);
        setError("Failed to load map data.");
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  const areaOptions = useMemo(() => {
    return [
      "All",
      ...Array.from(
        new Set(
          pipelines.map((p) => p.area_name || p.ds_division).filter(Boolean)
        )
      ).sort(),
    ];
  }, [pipelines]);

  const filteredPipelines = useMemo(() => {
    return pipelines.filter((p) => {
      const text =
        `${p.pipeline_id || ""} ${p.area_name || ""} ${p.ds_division || ""} ${p.material_type || ""}`.toLowerCase();

      const matchesSearch =
        search.trim() === "" || text.includes(search.trim().toLowerCase());

      const effectiveRiskFilter = showOnlyHigh ? "High" : riskFilter;
      const matchesRisk =
        effectiveRiskFilter === "All" || (p.risk_level || "Low") === effectiveRiskFilter;

      const matchesArea =
        areaFilter === "All" ||
        p.area_name === areaFilter ||
        p.ds_division === areaFilter;

      return matchesSearch && matchesRisk && matchesArea;
    });
  }, [pipelines, search, riskFilter, areaFilter, showOnlyHigh]);

  const selectedPipeline = useMemo(() => {
    return filteredPipelines.find((p) => p.pipeline_id === selectedPipelineId) || null;
  }, [filteredPipelines, selectedPipelineId]);

  const stats = useMemo(() => {
    const total = filteredPipelines.length;
    const high = filteredPipelines.filter((p) => p.risk_level === "High").length;
    const medium = filteredPipelines.filter((p) => p.risk_level === "Medium").length;
    const low = filteredPipelines.filter((p) => p.risk_level === "Low").length;
    return { total, high, medium, low };
  }, [filteredPipelines]);

  return (
    <div className="container" style={{ animation: "fadeIn 0.35s ease" }}>
      <div className="pageHero pageHeroCompact">
        <div>
          <div className="heroEyebrow">Operational GIS View</div>
          <div className="pageTitle">Kalutara pipeline risk map</div>
          <div className="pageSubtitle">
            Structured operational map with primary routes, branch lines, and predicted vulnerable segments.
          </div>
        </div>

        <div className="pageActions">
          <span className="badge ok">District: Kalutara</span>
          <span className="badge">Pro map mode</span>
        </div>
      </div>

      {loading ? (
        <div className="card card-pad">Loading map data...</div>
      ) : error ? (
        <div className="card card-pad" style={{ color: "var(--danger)" }}>
          {error}
        </div>
      ) : (
        <>
          <div className="mapSummaryGrid" style={{ marginBottom: 18 }}>
            <SummaryChip label="Visible pipelines" value={stats.total} />
            <SummaryChip label="High risk visible" value={stats.high} tone="toneHigh" />
            <SummaryChip label="Medium risk visible" value={stats.medium} tone="toneMedium" />
            <SummaryChip label="Low risk visible" value={stats.low} tone="toneLow" />
          </div>

          <div className="card card-pad" style={{ marginBottom: 18 }}>
            <div className="sectionHeader">
              <div>
                <div className="sectionTitle">Map filters</div>
                <div className="sectionSubtitle">
                  Search, filter, and inspect one asset at a time.
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
                value={showOnlyHigh ? "High" : riskFilter}
                onChange={(e) => {
                  const value = e.target.value;
                  if (showOnlyHigh && value !== "High") setShowOnlyHigh(false);
                  setRiskFilter(value);
                }}
              >
                {["All", "Low", "Medium", "High"].map((r) => (
                  <option key={r} value={r}>
                    Risk: {r}
                  </option>
                ))}
              </select>

              <select
                className="select"
                value={areaFilter}
                onChange={(e) => setAreaFilter(e.target.value)}
              >
                {areaOptions.map((a) => (
                  <option key={a} value={a}>
                    Area: {a}
                  </option>
                ))}
              </select>
            </div>

            <div className="mapTogglesRow">
              <label className="small mapToggleItem">
                <input
                  type="checkbox"
                  checked={showOnlyHigh}
                  onChange={(e) => setShowOnlyHigh(e.target.checked)}
                />
                Show only high-risk pipelines by default
              </label>
            </div>
          </div>

          <div className="mapLayoutGrid">
            <div className="card card-pad">
              <div className="sectionHeader">
                <div>
                  <div className="sectionTitle">Pipeline risk map</div>
                  <div className="sectionSubtitle">
                    Curved primary and branch routes reduce clutter and create a more realistic operational network view.
                  </div>
                </div>
              </div>

              <div className="mapViewWrap">
                <MapContainer
                  center={KALUTARA_CENTER}
                  zoom={12}
                  scrollWheelZoom={true}
                  className="leafletMap"
                >
                  <TileLayer
                    attribution="&copy; OpenStreetMap contributors"
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />

                  <MapAutoFit
                    pipelines={filteredPipelines}
                    selectedPipeline={selectedPipeline}
                  />

                  <NodeOverlay
                    pipelines={filteredPipelines}
                    selectedPipelineId={selectedPipelineId}
                    onSelectNode={(nodeName) => setAreaFilter(nodeName)}
                  />

                  {filteredPipelines.map((pipeline) => {
                    const isSelected = selectedPipelineId === pipeline.pipeline_id;
                    const isMain = classifyMainPipeline(pipeline);

                    const fullCurve = buildCurvedPipelinePath(pipeline);
                    const weakCurve = buildWeakSegmentCurve(pipeline, fullCurve);

                    if (!fullCurve) return null;

                    const opacity =
                      selectedPipelineId && !isSelected ? 0.15 : isSelected ? 1 : 0.82;

                    return (
                      <div key={pipeline.pipeline_id}>
                        <Polyline
                          positions={fullCurve}
                          pathOptions={{
                            color: getRiskColor(pipeline.risk_level),
                            weight: getRiskWeight(pipeline.risk_level, isSelected, isMain),
                            opacity,
                            lineCap: "round",
                            lineJoin: "round",
                          }}
                          eventHandlers={{
                            click: () => setSelectedPipelineId(pipeline.pipeline_id),
                          }}
                        >
                          <Tooltip sticky>
                            {pipeline.pipeline_id} ({pipeline.risk_level}) {isMain ? "• Main line" : "• Branch"}
                          </Tooltip>
                          <Popup>
                            <MapPopupContent pipeline={pipeline} />
                          </Popup>
                        </Polyline>

                        {weakCurve && (
                          <Polyline
                            positions={weakCurve}
                            pathOptions={{
                              color: "#dc2626",
                              weight: isSelected ? 10 : 7,
                              opacity: selectedPipelineId && !isSelected ? 0.12 : 0.95,
                              dashArray: "10, 8",
                              lineCap: "round",
                              lineJoin: "round",
                            }}
                            eventHandlers={{
                              click: () => setSelectedPipelineId(pipeline.pipeline_id),
                            }}
                          >
                            <Tooltip sticky>
                              Probable failure zone: {pipeline.weakest_segment_start_m}m - {pipeline.weakest_segment_end_m}m
                            </Tooltip>
                          </Polyline>
                        )}
                      </div>
                    );
                  })}
                </MapContainer>
              </div>
            </div>

            <div className="vstack">
              <div className="card card-pad">
                <div className="sectionHeader">
                  <div>
                    <div className="sectionTitle">Map legend</div>
                    <div className="sectionSubtitle">
                      Understand line types clearly.
                    </div>
                  </div>
                </div>

                <div className="mapLegendList">
                  <div className="mapLegendItem">
                    <span className="mapLegendLine low"></span>
                    <span>Low risk pipeline</span>
                  </div>
                  <div className="mapLegendItem">
                    <span className="mapLegendLine medium"></span>
                    <span>Medium risk pipeline</span>
                  </div>
                  <div className="mapLegendItem">
                    <span className="mapLegendLine high"></span>
                    <span>High risk pipeline</span>
                  </div>
                  <div className="mapLegendItem">
                    <span className="mapLegendLine weakest"></span>
                    <span>Probable failure zone</span>
                  </div>
                  <div className="mapLegendItem">
                    <span className="mapLegendLine main"></span>
                    <span>Main trunk / primary line</span>
                  </div>
                  <div className="mapLegendItem">
                    <span className="mapLegendNode"></span>
                    <span>Area / junction node</span>
                  </div>
                </div>
              </div>

              <SelectedPipelinePanel
                pipeline={selectedPipeline}
                onClear={() => setSelectedPipelineId(null)}
              />

              <div className="card card-pad">
                <div className="sectionHeader">
                  <div>
                    <div className="sectionTitle">Why this version is better</div>
                    <div className="sectionSubtitle">
                      Cleaner and more realistic than straight random line rendering.
                    </div>
                  </div>
                </div>

                <div className="vstack">
                  <div className="detailItem">
                    <div className="detailLabel">Structured routes</div>
                    <div className="detailValue">
                      Curved paths create a more natural network pattern instead of short artificial straight strokes.
                    </div>
                  </div>
                  <div className="detailItem">
                    <div className="detailLabel">Main vs branch lines</div>
                    <div className="detailValue">
                      Larger-diameter or longer assets appear as primary routes, improving hierarchy and readability.
                    </div>
                  </div>
                  <div className="detailItem">
                    <div className="detailLabel">Operational focus</div>
                    <div className="detailValue">
                      Selecting one asset highlights it and fades others, similar to a real inspection workflow.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <style>{`
            .mapLegendLine {
              display: inline-block;
              width: 34px;
              height: 0;
              border-top: 4px solid;
              border-radius: 999px;
              margin-right: 10px;
            }

            .mapLegendLine.low { border-color: #10b981; }
            .mapLegendLine.medium { border-color: #f59e0b; }
            .mapLegendLine.high { border-color: #ef4444; }
            .mapLegendLine.weakest {
              border-color: #dc2626;
              border-top-width: 7px;
            }
            .mapLegendLine.main {
              border-color: #1d4ed8;
              border-top-width: 7px;
            }

            .mapLegendNode {
              display: inline-block;
              width: 12px;
              height: 12px;
              border-radius: 999px;
              border: 2px solid #1d4ed8;
              background: #ffffff;
              margin-right: 10px;
            }

            .mapRiskBadge {
              display: inline-flex;
              align-items: center;
              justify-content: center;
              border-radius: 999px;
              padding: 8px 14px;
              font-weight: 700;
              font-size: 13px;
            }

            .mapRiskBadge.toneHigh {
              background: #fee2e2;
              color: #b91c1c;
            }
            .mapRiskBadge.toneMedium {
              background: #fef3c7;
              color: #b45309;
            }
            .mapRiskBadge.toneLow {
              background: #d1fae5;
              color: #047857;
            }

            .mapClearBtn {
              border: 1px solid #dbe4f0;
              background: #fff;
              color: #1f3b64;
              border-radius: 12px;
              padding: 8px 14px;
              cursor: pointer;
              font-weight: 600;
            }

            .mapClearBtn:hover {
              background: #f6f9fc;
            }
          `}</style>
        </>
      )}
    </div>
  );
}