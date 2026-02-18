export default function KPIGrid({ kpis }) {
  return (
    <div className="kpiGrid">
      {kpis.map((k) => (
        <div key={k.label} className="card card-pad">
          <div className="kpiLabel">{k.label}</div>
          <div className="kpiValue">{k.value}</div>
          {k.hint ? <div className="small">{k.hint}</div> : null}
        </div>
      ))}
    </div>
  );
}
