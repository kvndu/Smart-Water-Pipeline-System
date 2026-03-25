import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../utils/api.js";
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Popup,
  Tooltip,
  useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";

const KALUTARA_CENTER = [6.5854, 79.9607];

const KALUTARA_AREA_COORDS = {
  kalutara: [6.5854, 79.9607],
  panadura: [6.7132, 79.9026],
  beruwala: [6.4788, 79.9828],
  agalawatta: [6.5413, 80.1553],
  bulathsinhala: [6.7253, 80.1777],
  horana: [6.7159, 80.0626],
  mathugama: [6.5222, 80.1140],
  matugama: [6.5222, 80.1140],
  aluthgama: [6.4340, 79.9975],
  walana: [6.7050, 79.9300],
  payagala: [6.5169, 79.9748],
  molkawa: [6.6075, 80.1800],
  waskaduwa: [6.6930, 79.9070],
  halwatura: [6.6130, 80.0210],
  millawa: [6.7340, 80.0900],
  pinwatta: [6.5770, 79.9950],
  dodangoda: [6.5628, 80.0172],
};

function getRiskColor(level) {
  if (level === "High") return "#ef4444";
  if (level === "Medium") return "#f59e0b";
  return "#10b981";
}

function getRiskRadius(level, score = 0) {
  const base = level === "High" ? 11 : level === "Medium" ? 8 : 6;
  return base + Math.round(Number(score || 0) * 2);
}

function isKalutaraPipeline(pipeline) {
  const text = `${pipeline.area_name || ""} ${pipeline.ds_division || ""}`.toLowerCase();
  return Object.keys(KALUTARA_AREA_COORDS).some((key) => text.includes(key));
}

function findCoordinates(pipeline) {
  const text = `${pipeline.area_name || ""} ${pipeline.ds_division || ""}`.toLowerCase();

  for (const key of Object.keys(KALUTARA_AREA_COORDS)) {
    if (text.includes(key)) {
      const [lat, lng] = KALUTARA_AREA_COORDS[key];

      const hashSource = String(pipeline.pipeline_id || key);
      let hash = 0;
      for (let i = 0; i < hashSource.length; i += 1) {
        hash = (hashSource.charCodeAt(i) + ((hash << 5) - hash)) | 0;
      }

      const latOffset = ((hash % 100) - 50) * 0.00025;
      const lngOffset = ((((hash / 100) | 0) % 100) - 50) * 0.00025;

      return [lat + latOffset, lng + lngOffset];
    }
  }

  return KALUTARA_CENTER;
}

function SummaryChip({ label, value, tone = "" }) {
  return (
    <div className={`mapSummaryChip ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function MapAutoFit({ points }) {
  const map = useMap();

  useEffect(() => {
    if (!points.length) return;
    const bounds = points.map((p) => p.coords);
    map.fitBounds(bounds, { padding: [40, 40] });
  }, [map, points]);

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
      <div><strong>Risk Score:</strong> {Number(pipeline.risk_score || 0).toFixed(3)}</div>
      <div><strong>Leaks:</strong> {pipeline.previous_leak_count || 0}</div>
      <div><strong>Repairs:</strong> {pipeline.previous_repair_count || 0}</div>
      <div><strong>Install Year:</strong> {pipeline.install_year || "-"}</div>

      <div style={{ marginTop: 10 }}>
        <Link to={`/pipelines/${pipeline.pipeline_id}`} className="mapPopupButton">
          Open Detail Page
        </Link>
      </div>
    </div>
  );
}

export default function MapView() {
  const [pipelines, setPipelines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [riskFilter, setRiskFilter] = useState("All");
  const [areaFilter, setAreaFilter] = useState("All");
  const [highOnly, setHighOnly] = useState(false);

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
        setError("Failed to load map data.");
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  const mappedPipelines = useMemo(() => {
    return pipelines.map((pipeline) => ({
      ...pipeline,
      coords: findCoordinates(pipeline),
    }));
  }, [pipelines]);

  const areaOptions = useMemo(() => {
    return [
      "All",
      ...Array.from(
        new Set(mappedPipelines.map((p) => p.area_name || p.ds_division).filter(Boolean))
      ).sort(),
    ];
  }, [mappedPipelines]);

  const filteredPipelines = useMemo(() => {
    return mappedPipelines.filter((p) => {
      const text =
        `${p.pipeline_id || ""} ${p.area_name || ""} ${p.ds_division || ""} ${p.material_type || ""}`.toLowerCase();

      const matchesSearch =
        search.trim() === "" || text.includes(search.trim().toLowerCase());

      const matchesRisk =
        riskFilter === "All" || (p.risk_level || "Low") === riskFilter;

      const matchesArea =
        areaFilter === "All" ||
        p.area_name === areaFilter ||
        p.ds_division === areaFilter;

      const matchesHighOnly = !highOnly || p.risk_level === "High";

      return matchesSearch && matchesRisk && matchesArea && matchesHighOnly;
    });
  }, [mappedPipelines, search, riskFilter, areaFilter, highOnly]);

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
          <div className="heroEyebrow">Geographic View</div>
          <div className="pageTitle">Kalutara risk distribution map</div>
          <div className="pageSubtitle">
            Zone-based geographic visualization of pipeline risk records in Kalutara district.
          </div>
        </div>

        <div className="pageActions">
          <span className="badge ok">District: Kalutara</span>
          <span className="badge">Clean marker view</span>
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
            <SummaryChip label="High risk" value={stats.high} tone="toneHigh" />
            <SummaryChip label="Medium risk" value={stats.medium} tone="toneMedium" />
            <SummaryChip label="Low risk" value={stats.low} tone="toneLow" />
          </div>

          <div className="card card-pad" style={{ marginBottom: 18 }}>
            <div className="sectionHeader">
              <div>
                <div className="sectionTitle">Map filters</div>
                <div className="sectionSubtitle">
                  Search pipelines and filter by area or risk level.
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
                  checked={highOnly}
                  onChange={(e) => setHighOnly(e.target.checked)}
                />
                Show only high-risk pipelines
              </label>
            </div>
          </div>

          <div className="mapLayoutGrid">
            <div className="card card-pad">
              <div className="sectionHeader">
                <div>
                  <div className="sectionTitle">Pipeline risk map</div>
                  <div className="sectionSubtitle">
                    Hover for quick labels, click markers for detailed information.
                  </div>
                </div>
              </div>

              <div className="mapViewWrap">
                <MapContainer
                  center={KALUTARA_CENTER}
                  zoom={11}
                  scrollWheelZoom={true}
                  className="leafletMap"
                >
                  <TileLayer
                    attribution="&copy; OpenStreetMap contributors"
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />

                  <MapAutoFit points={filteredPipelines} />

                  {filteredPipelines.map((pipeline) => (
                    <CircleMarker
                      key={pipeline.pipeline_id}
                      center={pipeline.coords}
                      radius={getRiskRadius(pipeline.risk_level, pipeline.risk_score)}
                      pathOptions={{
                        color: getRiskColor(pipeline.risk_level),
                        fillColor: getRiskColor(pipeline.risk_level),
                        fillOpacity: 0.8,
                        weight: 2,
                      }}
                    >
                      <Tooltip direction="top" offset={[0, -6]} opacity={1}>
                        {pipeline.pipeline_id} ({pipeline.risk_level})
                      </Tooltip>

                      <Popup>
                        <MapPopupContent pipeline={pipeline} />
                      </Popup>
                    </CircleMarker>
                  ))}
                </MapContainer>
              </div>
            </div>

            <div className="vstack">
              <div className="card card-pad">
                <div className="sectionHeader">
                  <div>
                    <div className="sectionTitle">Map legend</div>
                    <div className="sectionSubtitle">
                      Understand marker colors clearly.
                    </div>
                  </div>
                </div>

                <div className="mapLegendList">
                  <div className="mapLegendItem">
                    <span className="mapLegendDot low"></span>
                    <span>Low risk pipeline</span>
                  </div>
                  <div className="mapLegendItem">
                    <span className="mapLegendDot medium"></span>
                    <span>Medium risk pipeline</span>
                  </div>
                  <div className="mapLegendItem">
                    <span className="mapLegendDot high"></span>
                    <span>High risk pipeline</span>
                  </div>
                </div>
              </div>

              <div className="card card-pad">
                <div className="sectionHeader">
                  <div>
                    <div className="sectionTitle">How to use this page</div>
                    <div className="sectionSubtitle">
                      Simple explanation for viva and real users.
                    </div>
                  </div>
                </div>

                <div className="vstack">
                  <div className="detailItem">
                    <div className="detailLabel">Step 1</div>
                    <div className="detailValue">Filter by area, risk level, or pipeline ID.</div>
                  </div>
                  <div className="detailItem">
                    <div className="detailLabel">Step 2</div>
                    <div className="detailValue">Use red markers to identify the highest-priority pipelines.</div>
                  </div>
                  <div className="detailItem">
                    <div className="detailLabel">Step 3</div>
                    <div className="detailValue">Click a marker and open the full detail page.</div>
                  </div>
                  <div className="detailItem">
                    <div className="detailLabel">Map type</div>
                    <div className="detailValue">
                      This is a zone-based approximate map, not an exact GIS route map.
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