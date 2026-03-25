function riskBadge(risk) {
  if (risk === "High") return "badge danger";
  if (risk === "Medium") return "badge warn";
  return "badge ok";
}

export default function PipelineTable({ rows = [], onSelect, selectedId }) {
  return (
    <div className="card card-pad">
      <div className="sectionHeader">
        <div>
          <div className="sectionTitle">Pipeline list</div>
          <div className="sectionSubtitle">Each row shows the current calculated risk and maintenance status.</div>
        </div>
        <span className="badge">{rows.length} visible</span>
      </div>

      <div className="tableWrap">
        <table className="table">
          <thead>
            <tr>
              <th>Pipeline ID</th>
              <th>Area</th>
              <th>Division</th>
              <th>Material</th>
              <th>Diameter</th>
              <th>Length</th>
              <th>Risk</th>
              <th>Leaks</th>
              <th>Last Maintenance</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.pipeline_id} style={p.pipeline_id === selectedId ? { background: "#eff6ff" } : undefined}>
                <td><b>{p.pipeline_id}</b></td>
                <td>{p.area}</td>
                <td>{p.zone || "-"}</td>
                <td>{p.material || "-"}</td>
                <td>{p.diameter_mm ? `${p.diameter_mm} mm` : "-"}</td>
                <td>{p.length_m ? `${p.length_m} m` : "-"}</td>
                <td><span className={riskBadge(p.corrosion_risk)}>{p.corrosion_risk || "Low"}</span></td>
                <td>{p.leak_count ?? 0}</td>
                <td>{p.last_maintenance_date || "Not recorded"}</td>
                <td>
                  <button className="btn btnSecondary" style={{ padding: "8px 12px" }} onClick={() => onSelect?.(p)}>
                    View
                  </button>
                </td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan="10">
                  <div className="emptyState">No pipelines match the current filters.</div>
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
