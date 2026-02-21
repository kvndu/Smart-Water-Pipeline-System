import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
} from "recharts";

function countBy(arr, key) {
  const map = new Map();
  for (const item of arr) {
    const k = (item?.[key] ?? "Unknown").toString().trim() || "Unknown";
    map.set(k, (map.get(k) || 0) + 1);
  }
  return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
}

function leakBuckets(pipelines) {
  // 0, 1, 2+ buckets
  let b0 = 0, b1 = 0, b2 = 0;
  for (const p of pipelines) {
    const n = Number(p.leak_count || 0);
    if (n <= 0) b0++;
    else if (n === 1) b1++;
    else b2++;
  }
  return [
    { name: "0", value: b0 },
    { name: "1", value: b1 },
    { name: "2+", value: b2 },
  ];
}

function installYearCounts(pipelines) {
  const map = new Map();
  for (const p of pipelines) {
    const y = Number(p.install_year);
    if (!Number.isFinite(y)) continue;
    map.set(y, (map.get(y) || 0) + 1);
  }
  return Array.from(map.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([year, count]) => ({ year, count }));
}

// Recharts Pie requires colors; keep them minimal + consistent
const PIE_COLORS = ["#2F6BFF", "#22C55E", "#F59E0B", "#EF4444", "#8B5CF6", "#06B6D4"];

function Card({ title, subtitle, children }) {
  return (
    <div className="card card-pad" style={{
      background: "linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)",
      border: "1px solid #e2e8f0",
      boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -2px rgba(0,0,0,0.05)",
      transition: "transform 0.2s, box-shadow 0.2s"
    }}
      onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.1)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -2px rgba(0,0,0,0.05)'; }}
    >
      <div className="hstack" style={{ justifyContent: "space-between", marginBottom: "16px", borderBottom: "1px dashed #e2e8f0", paddingBottom: "12px" }}>
        <div>
          <div className="title" style={{ fontSize: "16px", color: "var(--text)" }}>{title}</div>
          {subtitle ? <div className="small" style={{ color: "var(--muted)" }}>{subtitle}</div> : null}
        </div>
      </div>
      <div>{children}</div>
    </div>
  );
}

export default function DatasetCharts({ pipelines = [] }) {
  const byZone = countBy(pipelines, "zone");
  const byMaterial = countBy(pipelines, "material");
  const leakDist = leakBuckets(pipelines);
  const risk = countBy(pipelines, "corrosion_risk");
  const byInstallYear = installYearCounts(pipelines);

  return (
    <>
      <div className="chartsGrid" style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))",
        gap: "24px"
      }}>
        {/* 1) Pipelines by Zone (bar) */}
        <Card title="📍 Pipelines by Zone" subtitle="Distribution of pipelines across geographic zones">
          <div style={{ width: "100%", height: 300 }}>
            <ResponsiveContainer>
              <BarChart data={byZone} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fill: "#64748b", fontSize: 13 }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fill: "#64748b", fontSize: 13 }} axisLine={false} tickLine={false} />
                <Tooltip
                  cursor={{ fill: "#f8fafc" }}
                  contentStyle={{ borderRadius: "12px", border: "1px solid #e2e8f0", boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)", fontWeight: 800 }}
                />
                <Bar dataKey="value" fill="#2F6BFF" radius={[6, 6, 0, 0]} maxBarSize={50} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* 2) Pipelines by Material (pie) */}
        <Card title="🧱 Pipelines by Material" subtitle="Construction materials composition">
          <div style={{ width: "100%", height: 300 }}>
            <ResponsiveContainer>
              <PieChart>
                <Tooltip
                  contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)", fontWeight: 800 }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: "13px", fontWeight: 700 }} />
                <Pie data={byMaterial} dataKey="value" nameKey="name" outerRadius={100} innerRadius={50} label={{ fill: "#333", fontSize: "12px", fontWeight: 800 }} paddingAngle={4}>
                  {byMaterial.map((_, idx) => (
                    <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} stroke="white" strokeWidth={3} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* 3) Leak count distribution (0/1/2+) */}
        <Card title="💧 Leak Count Distribution" subtitle="Pipelines categorized by historical leak occurrence freq.">
          <div style={{ width: "100%", height: 300 }}>
            <ResponsiveContainer>
              <BarChart data={leakDist} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fill: "#64748b", fontSize: 13 }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fill: "#64748b", fontSize: 13 }} axisLine={false} tickLine={false} />
                <Tooltip
                  cursor={{ fill: "#f8fafc" }}
                  contentStyle={{ borderRadius: "12px", border: "1px solid #e2e8f0", boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)", fontWeight: 800 }}
                />
                <Bar dataKey="value" fill="#06B6D4" radius={[6, 6, 0, 0]} maxBarSize={50} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* 4) Risk Level breakdown (donut) */}
        <Card title="⚠️ Corrosion Risk Breakdown" subtitle="System computed risk levels globally">
          <div style={{ width: "100%", height: 300 }}>
            <ResponsiveContainer>
              <PieChart>
                <Tooltip
                  contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)", fontWeight: 800 }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: "13px", fontWeight: 700 }} />
                <Pie
                  data={risk}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={65}
                  outerRadius={100}
                  paddingAngle={6}
                  label={{ fill: "#475569", fontSize: "12px", fontWeight: 800 }}
                >
                  {risk.map((_, idx) => (
                    <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} stroke="transparent" />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* 5) Install Year vs Count (line) */}
        <Card title="📜 Install Year Timeline" subtitle="Timeline of underlying civil pipeline installations">
          <div style={{ width: "100%", height: 300 }}>
            <ResponsiveContainer>
              <LineChart data={byInstallYear} margin={{ top: 20, right: 20, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="lineColor" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#2F6BFF" />
                    <stop offset="100%" stopColor="#8B5CF6" />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="year" tick={{ fill: "#64748b", fontSize: 13 }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fill: "#64748b", fontSize: 13 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ borderRadius: "12px", border: "1px solid #e2e8f0", boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)", fontWeight: 800 }}
                />
                <Line type="monotone" dataKey="count" stroke="url(#lineColor)" strokeWidth={4} activeDot={{ r: 8, fill: "#8B5CF6", stroke: "#fff", strokeWidth: 3 }} dot={{ r: 4, fill: "#2F6BFF", strokeWidth: 0 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <style>{`
      @media (max-width: 900px) {
        .chartsGrid { grid-template-columns: 1fr !important; }
      }
    `}</style>
    </>
  );
}
