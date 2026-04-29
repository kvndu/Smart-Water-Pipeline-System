import { useEffect, useMemo, useState } from "react";
import { MapContainer, GeoJSON, useMap } from "react-leaflet";
import { useLocation } from "react-router-dom";
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

function FitToPipelines({ data, disabled }) {
  const map = useMap();

  useEffect(() => {
    if (!data || disabled) return;

    const layer = L.geoJSON(data);
    const bounds = layer.getBounds();

    if (bounds.isValid()) map.fitBounds(bounds, { padding: [30, 30] });

    setTimeout(() => map.invalidateSize(), 300);
  }, [data, disabled, map]);

  return null;
}

function ZoomToSelected({ feature }) {
  const map = useMap();

  useEffect(() => {
    if (!feature) return;

    const layer = L.geoJSON(feature);
    const bounds = layer.getBounds();

    if (bounds.isValid()) {
      map.fitBounds(bounds, {
        padding: [120, 120],
        maxZoom: 20,
      });
    }

    setTimeout(() => map.invalidateSize(), 300);
  }, [feature, map]);

  return null;
}

function getId(properties = {}) {
  return String(
    properties.WATMAINID ||
      properties.watmainid ||
      properties.OBJECTID ||
      properties.objectid ||
      ""
  );
}

function getRiskLevel(properties = {}) {
  const conditionRaw =
    properties.CONDITION_SCORE ||
    properties["Condition Score"] ||
    properties.CONDITION_SCORE_1 ||
    properties.condition_score;

  const criticalityRaw = properties.CRITICALITY || properties.criticality;

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
  }

  return "LOW";
}

function getRiskColor(risk) {
  if (risk === "HIGH") return "#ef4444";
  if (risk === "MEDIUM") return "#f59e0b";
  return "#0284c7";
}

function makePipe(feature) {
  const p = feature?.properties || {};
  const risk = getRiskLevel(p);

  return {
    id: p.WATMAINID || p.watmainid || p.OBJECTID || p.objectid || "N/A",
    objectId: p.OBJECTID || p.objectid || "N/A",
    status: p.STATUS || p.status || "N/A",
    pressureZone: p.PRESSURE_ZONE || p.pressure_zone || "N/A",
    material: p.MATERIAL || p.material || "N/A",
    size: p.PIPE_SIZE || p.pipe_size || p.MAP_LABEL || p.map_label || "N/A",
    category: p.CATEGORY || p.category || "N/A",
    condition:
      p.CONDITION_SCORE ||
      p["Condition Score"] ||
      p.CONDITION_SCORE_1 ||
      p.condition_score ||
      "N/A",
    criticality: p.CRITICALITY || p.criticality || "N/A",
    risk,
  };
}

export default function MapView() {
  const location = useLocation();
  const urlPipeId = new URLSearchParams(location.search).get("pipe");

  const [geoData, setGeoData] = useState(null);
  const [selectedPipe, setSelectedPipe] = useState(null);
  const [clickedPipeId, setClickedPipeId] = useState("");
  const [showStats, setShowStats] = useState(false);
  const [loading, setLoading] = useState(true);

  const activePipeId = urlPipeId || clickedPipeId;

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

  const selectedFeature = useMemo(() => {
    if (!geoData || !activePipeId) return null;

    return (
      geoData.features?.find(
        (feature) => String(getId(feature.properties)) === String(activePipeId)
      ) || null
    );
  }, [geoData, activePipeId]);

  useEffect(() => {
    if (selectedFeature) {
      setSelectedPipe(makePipe(selectedFeature));
    } else {
      setSelectedPipe(null);
    }
  }, [selectedFeature]);

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

  const normalStyle = (feature) => {
    if (activePipeId) {
      return {
        color: "transparent",
        weight: 0,
        opacity: 0,
        fillOpacity: 0,
      };
    }

    const risk = getRiskLevel(feature.properties);

    return {
      color: getRiskColor(risk),
      weight: risk === "HIGH" ? 4 : 3,
      opacity: 0.95,
    };
  };

  const selectedOuterStyle = () => ({
    color: "#fde047",
    weight: 18,
    opacity: 1,
    lineCap: "round",
    lineJoin: "round",
  });

  const selectedLineStyle = () => ({
    color: "#dc2626",
    weight: 8,
    opacity: 1,
    lineCap: "round",
    lineJoin: "round",
  });

  const onEachPipeline = (feature, layer) => {
    const p = feature.properties || {};
    const id = getId(p);
    const risk = getRiskLevel(p);

    layer.on({
      mouseover: (e) => {
        if (activePipeId) return;

        e.target.setStyle({
          color: "#111827",
          weight: 6,
          opacity: 1,
        });
        e.target.bringToFront();
      },
      mouseout: (e) => {
        e.target.setStyle(normalStyle(feature));
      },
      click: () => {
        if (!urlPipeId) {
          setClickedPipeId(id);
        }
      },
    });

    layer.bindTooltip(`WATMAINID: ${p.WATMAINID || "N/A"} | ${risk} risk`, {
      sticky: true,
    });
  };

  const onEachSelected = (feature, layer) => {
    const p = feature.properties || {};
    const risk = getRiskLevel(p);

    layer.bindTooltip(
      `Pipeline #${p.WATMAINID || p.OBJECTID || "N/A"} | ${risk}`,
      {
        sticky: true,
        permanent: true,
        direction: "top",
        className: "selectedLineTooltip",
      }
    );
  };

  return (
    <div style={{ width: "100%", height: "100vh", position: "relative" }}>
      <style>{`
        .selectedLineTooltip {
          background: #111827 !important;
          color: #ffffff !important;
          border: 2px solid #fde047 !important;
          border-radius: 10px !important;
          font-weight: 900 !important;
          padding: 6px 10px !important;
        }
        .selectedLineTooltip::before {
          border-top-color: #111827 !important;
        }
      `}</style>

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
            <FitToPipelines data={geoData} disabled={!!selectedFeature} />

            <GeoJSON
              key={`all-${activePipeId || "none"}`}
              data={geoData}
              renderer={L.canvas()}
              style={normalStyle}
              onEachFeature={onEachPipeline}
            />

            {selectedFeature && (
              <>
                <ZoomToSelected feature={selectedFeature} />

                <GeoJSON
                  key={`selected-outer-${activePipeId}`}
                  data={selectedFeature}
                  style={selectedOuterStyle}
                />

                <GeoJSON
                  key={`selected-line-${activePipeId}`}
                  data={selectedFeature}
                  style={selectedLineStyle}
                  onEachFeature={onEachSelected}
                />
              </>
            )}
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

      {activePipeId && (
        <div
          style={{
            position: "absolute",
            top: 20,
            right: 20,
            zIndex: 1000,
            background: selectedFeature ? "#111827" : "#fff7ed",
            color: selectedFeature ? "#ffffff" : "#9a3412",
            border: selectedFeature ? "3px solid #fde047" : "1px solid #fed7aa",
            borderRadius: 16,
            padding: "12px 16px",
            fontWeight: 950,
            boxShadow: "0 12px 30px rgba(15,23,42,0.25)",
          }}
        >
          {selectedFeature
            ? `Selected Pipeline Line: #${activePipeId}`
            : `Pipeline #${activePipeId} not found`}
        </div>
      )}

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
          <h2 style={{ margin: "6px 0 4px", fontSize: 20 }}>
            Waterloo Water Mains
          </h2>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 14 }}>
            <Stat label="Total" value={loading ? "..." : stats.total} />
            <Stat label="High" value={loading ? "..." : stats.high} color="#ef4444" />
            <Stat label="Medium" value={loading ? "..." : stats.medium} color="#f59e0b" />
            <Stat label="Low" value={loading ? "..." : stats.low} color="#0284c7" />
          </div>

          <div style={{ marginTop: 14, display: "grid", gap: 8 }}>
            <Legend color="#fde047" label="Selected pipeline outer line" />
            <Legend color="#dc2626" label="Selected pipeline exact line" />
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
            width: "min(900px, 90%)",
            background: "rgba(255,255,255,0.95)",
            borderRadius: 20,
            padding: "18px 22px",
            boxShadow: "0 22px 55px rgba(15,23,42,0.28)",
            border: "3px solid #fde047",
          }}
        >
          <button
            onClick={() => {
              setSelectedPipe(null);
              if (!urlPipeId) setClickedPipeId("");
            }}
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

          <h3 style={{ margin: 0, fontSize: 22 }}>
            Selected Pipeline #{selectedPipe.id}
          </h3>

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
    <div style={{ padding: 11, background: "#f8fafc", borderRadius: 14, border: "1px solid #e2e8f0" }}>
      <div style={{ fontSize: 12, color: "#64748b", fontWeight: 800 }}>{label}</div>
      <div style={{ fontSize: 21, color, fontWeight: 950 }}>{value}</div>
    </div>
  );
}

function Legend({ color, label }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <span style={{ width: 24, height: 5, borderRadius: 999, background: color, display: "inline-block" }} />
      <span style={{ fontSize: 13, color: "#334155", fontWeight: 800 }}>{label}</span>
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 14, padding: "10px 12px" }}>
      <div style={{ fontSize: 12, color: "#64748b", fontWeight: 800 }}>{label}</div>
      <div style={{ fontSize: 14, color: "#0f172a", fontWeight: 900 }}>{value}</div>
    </div>
  );
}