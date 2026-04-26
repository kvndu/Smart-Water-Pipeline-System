import { useEffect, useMemo, useState } from "react";
import { MapContainer, GeoJSON, useMap } from "react-leaflet";
import L from "leaflet";
import * as EL from "esri-leaflet";
import "leaflet/dist/leaflet.css";

function EsriGrayBasemap() {
  const map = useMap();

  useEffect(() => {
    const baseLayer = EL.basemapLayer("Gray");
    baseLayer.addTo(map);
    return () => map.removeLayer(baseLayer);
  }, [map]);

  return null;
}

function FitToPipelines({ data }) {
  const map = useMap();

  useEffect(() => {
    if (!data) return;

    const layer = L.geoJSON(data);
    const bounds = layer.getBounds();

    if (bounds.isValid()) map.fitBounds(bounds, { padding: [30, 30] });

    setTimeout(() => map.invalidateSize(), 300);
  }, [data, map]);

  return null;
}

function getRiskLevel(properties = {}) {
  const conditionRaw =
    properties.CONDITION_SCORE ||
    properties["Condition Score"] ||
    properties.CONDITION_SCORE_1;

  const criticalityRaw = properties.CRITICALITY;
  const condition = Number(conditionRaw);
  const criticality = Number(criticalityRaw);

  if (!Number.isNaN(condition)) {
    if (condition <= 4) return "HIGH";
    if (condition <= 7) return "MEDIUM";
    return "LOW";
  }

  if (!Number.isNaN(criticality)) {
    if (criticality >= 8) return "HIGH";
    if (criticality >= 5) return "MEDIUM";
    return "LOW";
  }

  return "LOW";
}

function getRiskColor(risk) {
  if (risk === "HIGH") return "#ef4444";
  if (risk === "MEDIUM") return "#f59e0b";
  return "#0284c7";
}

export default function MapView() {
  const [geoData, setGeoData] = useState(null);
  const [selectedPipe, setSelectedPipe] = useState(null);
  const [showStats, setShowStats] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/water_mains.geojson")
      .then((res) => {
        if (!res.ok) throw new Error("GeoJSON file not found");
        return res.json();
      })
      .then((data) => {
        setGeoData(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("GeoJSON load error:", err);
        setLoading(false);
      });
  }, []);

  const stats = useMemo(() => {
    const features = geoData?.features || [];
    let high = 0;
    let medium = 0;
    let low = 0;

    features.forEach((feature) => {
      const risk = getRiskLevel(feature.properties);
      if (risk === "HIGH") high += 1;
      else if (risk === "MEDIUM") medium += 1;
      else low += 1;
    });

    return { total: features.length, high, medium, low };
  }, [geoData]);

  const pipelineStyle = (feature) => {
    const risk = getRiskLevel(feature.properties);

    return {
      color: getRiskColor(risk),
      weight: risk === "HIGH" ? 4 : 3,
      opacity: 0.95,
    };
  };

  const onEachPipeline = (feature, layer) => {
    const p = feature.properties || {};
    const risk = getRiskLevel(p);

    layer.on({
      mouseover: (e) => {
        e.target.setStyle({
          color: "#111827",
          weight: 6,
          opacity: 1,
        });
        e.target.bringToFront();
      },
      mouseout: (e) => {
        e.target.setStyle(pipelineStyle(feature));
      },
      click: () => {
        setSelectedPipe({
          id: p.WATMAINID || p.OBJECTID || "N/A",
          objectId: p.OBJECTID || "N/A",
          status: p.STATUS || "N/A",
          pressureZone: p.PRESSURE_ZONE || "N/A",
          material: p.MATERIAL || "N/A",
          size: p.PIPE_SIZE || p.MAP_LABEL || "N/A",
          category: p.CATEGORY || "N/A",
          condition:
            p.CONDITION_SCORE ||
            p["Condition Score"] ||
            p.CONDITION_SCORE_1 ||
            "N/A",
          criticality: p.CRITICALITY || "N/A",
          risk,
        });
      },
    });

    layer.bindTooltip(`WATMAINID: ${p.WATMAINID || "N/A"} | ${risk} risk`, {
      sticky: true,
    });
  };

  return (
    <div style={{ width: "100%", height: "100vh", position: "relative" }}>
      <MapContainer
        center={[43.446981, -80.415975]}
        zoom={16}
        style={{ width: "100%", height: "100%" }}
        scrollWheelZoom={true}
        zoomControl={true}
        preferCanvas={true}
      >
        <EsriGrayBasemap />

        {geoData && (
          <>
            <FitToPipelines data={geoData} />
            <GeoJSON
              data={geoData}
              renderer={L.canvas()}
              style={pipelineStyle}
              onEachFeature={onEachPipeline}
            />
          </>
        )}
      </MapContainer>

      <button
        onClick={() => setShowStats((prev) => !prev)}
        style={{
          position: "absolute",
          top: 20,
          left: 20,
          zIndex: 1000,
          background: "#2563eb",
          color: "#fff",
          border: "none",
          borderRadius: 999,
          padding: "11px 18px",
          fontWeight: 900,
          boxShadow: "0 10px 25px rgba(37,99,235,0.35)",
          cursor: "pointer",
        }}
      >
        {showStats ? "Hide Stats" : "Map Stats"}
      </button>

      {showStats && (
        <div
          style={{
            position: "absolute",
            top: 74,
            left: 20,
            zIndex: 1000,
            width: 280,
            background: "rgba(255,255,255,0.92)",
            backdropFilter: "blur(12px)",
            borderRadius: 18,
            padding: 16,
            boxShadow: "0 18px 45px rgba(15,23,42,0.2)",
            border: "1px solid rgba(148,163,184,0.25)",
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 900, color: "#2563eb" }}>
            GIS PIPELINE MAP
          </div>

          <h2 style={{ margin: "6px 0 4px", fontSize: 20 }}>
            Waterloo Water Mains
          </h2>

          <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>
            Real-world water pipeline network with risk-based visualization.
          </p>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 10,
              marginTop: 14,
            }}
          >
            <Stat label="Total" value={loading ? "..." : stats.total} />
            <Stat
              label="High"
              value={loading ? "..." : stats.high}
              color="#ef4444"
            />
            <Stat
              label="Medium"
              value={loading ? "..." : stats.medium}
              color="#f59e0b"
            />
            <Stat
              label="Low"
              value={loading ? "..." : stats.low}
              color="#0284c7"
            />
          </div>

          <div style={{ marginTop: 14, display: "grid", gap: 8 }}>
            <Legend color="#ef4444" label="High risk pipeline" />
            <Legend color="#f59e0b" label="Medium risk pipeline" />
            <Legend color="#0284c7" label="Low / normal pipeline" />
          </div>
        </div>
      )}

      {selectedPipe && (
        <div
          style={{
            position: "absolute",
            left: "50%",
            bottom: 24,
            transform: "translateX(-50%)",
            zIndex: 1000,
            width: "min(980px, 90%)",
            background: "rgba(255,255,255,0.95)",
            backdropFilter: "blur(14px)",
            borderRadius: 20,
            padding: "18px 22px",
            boxShadow: "0 22px 55px rgba(15,23,42,0.28)",
            border: "1px solid rgba(148,163,184,0.3)",
          }}
        >
          <button
            onClick={() => setSelectedPipe(null)}
            style={{
              position: "absolute",
              right: 14,
              top: 12,
              border: "none",
              background: "#e5e7eb",
              borderRadius: 10,
              padding: "5px 10px",
              cursor: "pointer",
              fontWeight: 900,
            }}
          >
            ×
          </button>

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span
              style={{
                background: getRiskColor(selectedPipe.risk),
                color: "#fff",
                padding: "6px 12px",
                borderRadius: 999,
                fontSize: 12,
                fontWeight: 900,
              }}
            >
              {selectedPipe.risk} RISK
            </span>

            <h3 style={{ margin: 0, fontSize: 22 }}>
              Pipeline #{selectedPipe.id}
            </h3>
          </div>

          <div
            style={{
              marginTop: 14,
              display: "grid",
              gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
              gap: 12,
            }}
          >
            <Info label="Object ID" value={selectedPipe.objectId} />
            <Info label="Status" value={selectedPipe.status} />
            <Info label="Pressure Zone" value={selectedPipe.pressureZone} />
            <Info label="Material" value={selectedPipe.material} />
            <Info label="Pipe Size" value={selectedPipe.size} />
            <Info label="Category" value={selectedPipe.category} />
            <Info label="Condition" value={selectedPipe.condition} />
            <Info label="Criticality" value={selectedPipe.criticality} />
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, color = "#0f172a" }) {
  return (
    <div
      style={{
        padding: 11,
        background: "#f8fafc",
        borderRadius: 14,
        border: "1px solid #e2e8f0",
      }}
    >
      <div style={{ fontSize: 12, color: "#64748b", fontWeight: 800 }}>
        {label}
      </div>
      <div style={{ fontSize: 21, color, fontWeight: 950 }}>{value}</div>
    </div>
  );
}

function Legend({ color, label }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <span
        style={{
          width: 24,
          height: 5,
          borderRadius: 999,
          background: color,
          display: "inline-block",
        }}
      />
      <span style={{ fontSize: 13, color: "#334155", fontWeight: 800 }}>
        {label}
      </span>
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div
      style={{
        background: "#f8fafc",
        border: "1px solid #e2e8f0",
        borderRadius: 14,
        padding: "10px 12px",
      }}
    >
      <div style={{ fontSize: 12, color: "#64748b", fontWeight: 800 }}>
        {label}
      </div>
      <div style={{ fontSize: 14, color: "#0f172a", fontWeight: 900 }}>
        {value}
      </div>
    </div>
  );
}