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
    <div className="card card-pad">
      <div className="hstack" style={{ justifyContent: "space-between" }}>
        <div>
          <div className="title" style={{ fontSize: 14 }}>{title}</div>
          {subtitle ? <div className="small">{subtitle}</div> : null}
        </div>
      </div>
      <div style={{ marginTop: 12 }}>{children}</div>
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
    <div className="chartsGrid">
      {/* 1) Pipelines by Zone (bar) */}
      <Card title="Pipelines by Zone" subtitle="Counts from dataset (zone)">
        <div style={{ width: "100%", height: 280 }}>
          <ResponsiveContainer>
            <BarChart data={byZone}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="value" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* 2) Pipelines by Material (pie) */}
      <Card title="Pipelines by Material" subtitle="Counts from dataset (material)">
        <div style={{ width: "100%", height: 280 }}>
          <ResponsiveContainer>
            <PieChart>
              <Tooltip />
              <Legend />
              <Pie data={byMaterial} dataKey="value" nameKey="name" outerRadius={90} label>
                {byMaterial.map((_, idx) => (
                  <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* 3) Leak count distribution (0/1/2+) */}
      <Card title="Leak Count Distribution" subtitle="Buckets from dataset (leak_count)">
        <div style={{ width: "100%", height: 280 }}>
          <ResponsiveContainer>
            <BarChart data={leakDist}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="value" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* 4) Risk Level breakdown (donut) */}
      <Card title="Risk Level Breakdown" subtitle="Counts from dataset (corrosion_risk)">
        <div style={{ width: "100%", height: 280 }}>
          <ResponsiveContainer>
            <PieChart>
              <Tooltip />
              <Legend />
              <Pie
                data={risk}
                dataKey="value"
                nameKey="name"
                innerRadius={55}
                outerRadius={90}
                label
              >
                {risk.map((_, idx) => (
                  <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* 5) Install Year vs Count (line) */}
      <Card title="Install Year vs Pipeline Count" subtitle="Counts from dataset (install_year)">
        <div style={{ width: "100%", height: 280 }}>
          <ResponsiveContainer>
            <LineChart data={byInstallYear}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="year" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Line type="monotone" dataKey="count" strokeWidth={3} dot />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}
