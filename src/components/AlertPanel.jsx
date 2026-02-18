function severityBadge(sev) {
  if (sev === "High") return "badge danger";
  if (sev === "Medium") return "badge warn";
  return "badge ok";
}

export default function AlertPanel({ alerts = [] }) {
  return (
    <div className="card card-pad">
      <div className="hstack" style={{ justifyContent: "space-between" }}>
        <div>
          <div className="title" style={{ fontSize: 14 }}>Alerts</div>
          <div className="small">Rule-based alerts (DB data only)</div>
        </div>
        <span className="badge">{alerts.length} Total</span>
      </div>

      <div className="vstack" style={{ marginTop: 12 }}>
        {alerts.length === 0 ? (
          <div className="small">No alerts right now.</div>
        ) : (
          alerts.map((a) => (
            <div key={a.id} className="alertItem">
              <div className="alertTop">
                <div className="alertTitle">{a.title}</div>
                <span className={severityBadge(a.severity)}>{a.severity}</span>
              </div>
              <div className="alertMeta">
                Pipeline: <b>{a.pipeline_id}</b> • Area: {a.area} • {a.time}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
