function severityBadge(sev) {
  if (sev === "High") return "badge danger";
  if (sev === "Medium") return "badge warn";
  return "badge ok";
}

export default function AlertPanel({ alerts = [] }) {
  return (
    <div className="card card-pad">
      <div className="sectionHeader">
        <div>
          <div className="sectionTitle">Active alerts</div>
          <div className="sectionSubtitle">Generated from high-risk pipelines and leak history.</div>
        </div>
        <span className="badge">{alerts.length} alerts</span>
      </div>

      <div className="vstack">
        {alerts.length === 0 ? (
          <div className="emptyState">No active alerts right now.</div>
        ) : (
          alerts.map((a) => (
            <div key={a.id} className="alertItem">
              <div className="alertTop">
                <div className="alertTitle">{a.title}</div>
                <span className={severityBadge(a.severity)}>{a.severity}</span>
              </div>
              <div className="alertMeta">
                Pipeline <b>{a.pipeline_id}</b> • {a.area} • {a.time}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
