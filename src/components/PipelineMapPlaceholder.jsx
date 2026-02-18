export default function PipelineMapPlaceholder({ selected }) {
  return (
    <div className="card card-pad" style={{ minHeight: 420 }}>
      <div className="hstack" style={{ justifyContent: "space-between" }}>
        <div>
          <div className="title" style={{ fontSize: 14 }}>Pipeline Map</div>
          <div className="small">Map placeholder (no AI). Later you can add Leaflet.</div>
        </div>

        {selected ? (
          <span className="badge ok">Selected: {selected.pipeline_id}</span>
        ) : (
          <span className="badge">No selection</span>
        )}
      </div>

      <div
        style={{
          marginTop: 12,
          border: "1px dashed var(--border)",
          borderRadius: 12,
          height: 330,
          display: "grid",
          placeItems: "center",
          color: "var(--muted)",
        }}
      >
        GPS points will be shown here
      </div>
    </div>
  );
}
