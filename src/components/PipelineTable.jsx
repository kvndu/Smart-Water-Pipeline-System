function riskBadge(risk) {
  if (risk === "High") return "badge danger";
  if (risk === "Medium") return "badge warn";
  return "badge ok";
}

export default function PipelineTable({ rows = [], onSelect, selectedId }) {
  return (
    <div className="card card-pad">
      <div className="hstack" style={{ justifyContent: "space-between" }}>
        <div>
          <div className="title" style={{ fontSize: 14 }}>Pipelines</div>
          <div className="small">Data table (DB/CSV fields only)</div>
        </div>
        <span className="badge">{rows.length} rows</span>
      </div>

      <div style={{ overflowX: "auto", marginTop: 10 }}>
        <table className="table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Pipe</th>
              <th>Area / Zone</th>
              <th>Material</th>
              <th>Diameter</th>
              <th>Length</th>
              <th>Risk</th>
              <th>Leaks</th>
              <th>Last Maintenance</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr
                key={p.pipeline_id}
                style={p.pipeline_id === selectedId ? { background: "#F1F5FF" } : undefined}
              >
                <td><b>{p.pipeline_id}</b></td>
                <td>{p.pipe_name}</td>
                <td>{p.area} / {p.zone}</td>
                <td>{p.material}</td>
                <td>{p.diameter_mm} mm</td>
                <td>{p.length_m} m</td>
                <td><span className={riskBadge(p.corrosion_risk)}>{p.corrosion_risk}</span></td>
                <td>{p.leak_count}</td>
                <td>{p.last_maintenance_date}</td>
                <td>
                  <button
                    style={{
                      border: "1px solid var(--border)",
                      background: "#fff",
                      borderRadius: 10,
                      padding: "8px 10px",
                      cursor: "pointer",
                      fontWeight: 800,
                    }}
                    onClick={() => onSelect?.(p)}
                  >
                    View
                  </button>
                </td>
              </tr>
            ))}

            {rows.length === 0 ? (
              <tr>
                <td colSpan="10" className="small" style={{ padding: 12 }}>
                  No pipelines match your filters.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
