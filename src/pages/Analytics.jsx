import { useEffect, useMemo, useState } from "react";
import { supabase } from "../utils/supabaseClient";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from "recharts";

const PAGE_SIZE = 1000;

const COLORS = {
  HIGH: "#ef4444",
  MEDIUM: "#f59e0b",
  LOW: "#0284c7",
  BLUE: "#2563eb",
  GREEN: "#16a34a",
  PURPLE: "#8b5cf6",
};

async function fetchAllPipelines() {
  let allRows = [];
  let from = 0;

  while (true) {
    const to = from + PAGE_SIZE - 1;

    const { data, error } = await supabase
      .from("pipelines")
      .select("*")
      .range(from, to);

    if (error) throw error;

    const rows = data || [];
    allRows = [...allRows, ...rows];

    if (rows.length < PAGE_SIZE) break;

    from += PAGE_SIZE;
  }

  return allRows;
}

function toNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(String(value).replace(/,/g, ""));
  return Number.isNaN(n) ? null : n;
}

function getConditionScore(p) {
  return toNumber(p["Condition Score"] ?? p.CONDITION_SCORE ?? p.condition_score);
}

function getCriticality(p) {
  return toNumber(p.CRITICALITY ?? p.criticality);
}

function getRiskLevel(p) {
  const condition = getConditionScore(p);
  const criticality = getCriticality(p);

  if (condition !== null) {
    if (condition <= 4) return "HIGH";
    if (condition <= 7) return "MEDIUM";
    return "LOW";
  }

  if (criticality !== null) {
    if (criticality >= 8) return "HIGH";
    if (criticality >= 5) return "MEDIUM";
  }

  return "LOW";
}

function getInstallYear(p) {
  const raw = p.INSTALLATION_DATE ?? p.installation_date;
  if (!raw) return null;

  const match = String(raw).match(/\d{4}/);
  return match ? Number(match[0]) : null;
}

function StatCard({ label, value, hint, color = "#0f172a" }) {
  return (
    <div className="statCard">
      <div className="statLabel">{label}</div>
      <div className="statValue" style={{ color }}>
        {value}
      </div>
      <div className="statHint">{hint}</div>
    </div>
  );
}

export default function Analytics() {
  const [pipelines, setPipelines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    async function fetchAnalyticsData() {
      try {
        setLoading(true);
        setErrorMsg("");

        const rows = await fetchAllPipelines();
        setPipelines(rows);
      } catch (error) {
        console.error("Analytics fetch error:", error);
        setPipelines([]);
        setErrorMsg("Failed to load analytics data from Supabase.");
      } finally {
        setLoading(false);
      }
    }

    fetchAnalyticsData();
  }, []);

  const enriched = useMemo(() => {
    return pipelines.map((p) => ({
      ...p,
      risk: getRiskLevel(p),
      condition: getConditionScore(p),
      criticality: getCriticality(p),
      installYear: getInstallYear(p),
      length: toNumber(p.Shape__Length ?? p.shape__length),
    }));
  }, [pipelines]);

  const stats = useMemo(() => {
    const conditions = enriched.map((p) => p.condition).filter((v) => v !== null);
    const criticalities = enriched.map((p) => p.criticality).filter((v) => v !== null);
    const lengths = enriched.map((p) => p.length).filter((v) => v !== null);
    const years = enriched.map((p) => p.installYear).filter((v) => v !== null);

    return {
      total: enriched.length,
      high: enriched.filter((p) => p.risk === "HIGH").length,
      medium: enriched.filter((p) => p.risk === "MEDIUM").length,
      low: enriched.filter((p) => p.risk === "LOW").length,
      avgCondition:
        conditions.length > 0
          ? (conditions.reduce((a, b) => a + b, 0) / conditions.length).toFixed(2)
          : "N/A",
      avgCriticality:
        criticalities.length > 0
          ? (criticalities.reduce((a, b) => a + b, 0) / criticalities.length).toFixed(2)
          : "N/A",
      totalLength:
        lengths.length > 0 ? lengths.reduce((a, b) => a + b, 0).toFixed(2) : "N/A",
      oldestYear: years.length > 0 ? Math.min(...years) : "N/A",
    };
  }, [enriched]);

  const riskDistribution = useMemo(
    () => [
      { name: "High", value: stats.high, fill: COLORS.HIGH },
      { name: "Medium", value: stats.medium, fill: COLORS.MEDIUM },
      { name: "Low", value: stats.low, fill: COLORS.LOW },
    ],
    [stats]
  );

  const materialDistribution = useMemo(() => {
    const counts = {};
    enriched.forEach((p) => {
      const material = p.MATERIAL || p.material || "Unknown";
      counts[material] = (counts[material] || 0) + 1;
    });

    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [enriched]);

  const pressureZoneDistribution = useMemo(() => {
    const counts = {};
    enriched.forEach((p) => {
      const zone = p.PRESSURE_ZONE || p.pressure_zone || "Unknown";
      counts[zone] = (counts[zone] || 0) + 1;
    });

    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [enriched]);

  const conditionGroups = useMemo(() => {
    const groups = {
      "Poor (0-4)": 0,
      "Fair (5-7)": 0,
      "Good (8-10)": 0,
      Unknown: 0,
    };

    enriched.forEach((p) => {
      const c = p.condition;
      if (c === null) groups.Unknown += 1;
      else if (c <= 4) groups["Poor (0-4)"] += 1;
      else if (c <= 7) groups["Fair (5-7)"] += 1;
      else groups["Good (8-10)"] += 1;
    });

    return Object.entries(groups).map(([name, value]) => ({ name, value }));
  }, [enriched]);

  const installYearGroups = useMemo(() => {
    const groups = {
      "Before 1980": 0,
      "1980-1999": 0,
      "2000-2009": 0,
      "2010-2019": 0,
      "2020+": 0,
      Unknown: 0,
    };

    enriched.forEach((p) => {
      const y = p.installYear;
      if (!y) groups.Unknown += 1;
      else if (y < 1980) groups["Before 1980"] += 1;
      else if (y <= 1999) groups["1980-1999"] += 1;
      else if (y <= 2009) groups["2000-2009"] += 1;
      else if (y <= 2019) groups["2010-2019"] += 1;
      else groups["2020+"] += 1;
    });

    return Object.entries(groups).map(([name, value]) => ({ name, value }));
  }, [enriched]);

  const criticalityTop = useMemo(() => {
    return [...enriched]
      .filter((p) => p.criticality !== null)
      .sort((a, b) => b.criticality - a.criticality)
      .slice(0, 10)
      .map((p) => ({
        name: String(p.WATMAINID || p.OBJECTID),
        value: p.criticality,
      }));
  }, [enriched]);

  const highRiskAssets = useMemo(() => {
    return [...enriched]
      .sort((a, b) => {
        const order = { HIGH: 3, MEDIUM: 2, LOW: 1 };
        const riskDiff = order[b.risk] - order[a.risk];
        if (riskDiff !== 0) return riskDiff;
        return Number(b.criticality || 0) - Number(a.criticality || 0);
      })
      .slice(0, 10);
  }, [enriched]);

  return (
    <div className="analyticsPage">
      <div className="hero">
        <div>
          <div className="eyebrow">Data Intelligence</div>
          <h1>Pipeline Analytics</h1>
        </div>

        <div className="heroBadges">
          <span>Real dataset</span>
          <span>{stats.total.toLocaleString()} records loaded</span>
          <span>Rule-based risk analysis</span>
        </div>
      </div>

      {loading ? (
        <div className="panel">Loading analytics...</div>
      ) : errorMsg ? (
        <div className="panel errorBox">{errorMsg}</div>
      ) : (
        <>
          <div className="statGrid">
            <StatCard
              label="Total Pipelines"
              value={stats.total.toLocaleString()}
              hint="Loaded from Supabase"
            />
            <StatCard
              label="High Risk Assets"
              value={stats.high.toLocaleString()}
              hint="Condition ≤ 4 / high criticality"
              color="#ef4444"
            />
            <StatCard
              label="Average Condition"
              value={stats.avgCondition}
              hint="Higher score means better condition"
              color="#2563eb"
            />
            <StatCard
              label="Average Criticality"
              value={stats.avgCriticality}
              hint="Operational importance score"
              color="#f59e0b"
            />
            <StatCard
              label="Total Length"
              value={`${Number(stats.totalLength).toLocaleString()} m`}
              hint="Based on Shape__Length field"
              color="#16a34a"
            />
            <StatCard
              label="Oldest Install Year"
              value={stats.oldestYear}
              hint="Extracted from installation date"
              color="#8b5cf6"
            />
          </div>

          <div className="gridTwo">
            <ChartPanel
              title="Risk Distribution"
              subtitle="Risk split calculated from condition score and criticality."
            >
              <ResponsiveContainer width="100%" height={310}>
                <PieChart>
                  <Pie
                    data={riskDistribution}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={70}
                    outerRadius={110}
                    paddingAngle={4}
                    label
                  >
                    {riskDistribution.map((entry) => (
                      <Cell key={entry.name} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </ChartPanel>

            <ChartPanel
              title="Material Distribution"
              subtitle="Most common materials in the water main asset inventory."
            >
              <ResponsiveContainer width="100%" height={310}>
                <BarChart data={materialDistribution}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="value" fill="#2563eb" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartPanel>
          </div>

          <div className="gridTwo">
            <ChartPanel title="Pressure Zone Distribution" subtitle="Asset count by pressure zone.">
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={pressureZoneDistribution}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" angle={-18} textAnchor="end" height={70} />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="value" fill="#14b8a6" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartPanel>

            <ChartPanel
              title="Condition Score Groups"
              subtitle="Poor, fair and good condition grouping."
            >
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={conditionGroups}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="value" fill="#f59e0b" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartPanel>
          </div>

          <div className="gridTwo">
            <ChartPanel
              title="Installation Year Groups"
              subtitle="Pipeline age profile from installation dates."
            >
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={installYearGroups}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="value" fill="#8b5cf6" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartPanel>

            <ChartPanel
              title="Top Critical Assets"
              subtitle="Highest criticality water mains in the dataset."
            >
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={criticalityTop}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" angle={-20} textAnchor="end" height={75} />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="value" fill="#ef4444" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartPanel>
          </div>

          <div className="panel">
            <div className="panelHead">
              <div>
                <h2>High Attention Pipeline Assets</h2>
                <p>Top assets sorted by risk and criticality.</p>
              </div>
            </div>

            <div className="tableWrap">
              <table>
                <thead>
                  <tr>
                    <th>WATMAINID</th>
                    <th>Material</th>
                    <th>Pipe Size</th>
                    <th>Pressure Zone</th>
                    <th>Category</th>
                    <th>Condition</th>
                    <th>Criticality</th>
                    <th>Risk</th>
                  </tr>
                </thead>
                <tbody>
                  {highRiskAssets.map((p, index) => (
                    <tr key={p.OBJECTID || p.WATMAINID || index}>
                      <td className="strong">{p.WATMAINID || "N/A"}</td>
                      <td>{p.MATERIAL || "N/A"}</td>
                      <td>{p.PIPE_SIZE || p.MAP_LABEL || "N/A"}</td>
                      <td>{p.PRESSURE_ZONE || "N/A"}</td>
                      <td>{p.CATEGORY || "N/A"}</td>
                      <td>{p.condition ?? "N/A"}</td>
                      <td>{p.criticality ?? "N/A"}</td>
                      <td>
                        <span
                          className="riskBadge"
                          style={{
                            background:
                              p.risk === "HIGH"
                                ? "#ef4444"
                                : p.risk === "MEDIUM"
                                ? "#f59e0b"
                                : "#0284c7",
                          }}
                        >
                          {p.risk}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <style>{`
        .analyticsPage {
          padding: 28px;
          animation: fadeIn 0.35s ease;
        }

        .hero {
          background: linear-gradient(135deg, #ffffff, #eff6ff);
          border: 1px solid #e2e8f0;
          border-radius: 24px;
          padding: 28px;
          display: flex;
          justify-content: space-between;
          gap: 20px;
          align-items: flex-start;
          margin-bottom: 22px;
          box-shadow: 0 18px 45px rgba(15,23,42,0.08);
        }

        .eyebrow {
          display: inline-block;
          background: #dbeafe;
          color: #2563eb;
          font-weight: 900;
          font-size: 12px;
          letter-spacing: 1px;
          padding: 7px 12px;
          border-radius: 999px;
          text-transform: uppercase;
          margin-bottom: 10px;
        }

        .hero h1 {
          margin: 0;
          font-size: 30px;
          color: #0f172a;
        }

        .heroBadges {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        .heroBadges span {
          background: #fff;
          border: 1px solid #e2e8f0;
          border-radius: 999px;
          padding: 8px 12px;
          font-size: 12px;
          font-weight: 900;
          color: #0f172a;
        }

        .statGrid {
          display: grid;
          grid-template-columns: repeat(6, 1fr);
          gap: 16px;
          margin-bottom: 22px;
        }

        .statCard,
        .panel {
          background: #fff;
          border: 1px solid #e2e8f0;
          border-radius: 20px;
          padding: 20px;
          box-shadow: 0 14px 35px rgba(15,23,42,0.06);
        }

        .statLabel {
          color: #64748b;
          font-size: 13px;
          font-weight: 800;
        }

        .statValue {
          margin-top: 8px;
          font-size: 28px;
          font-weight: 950;
        }

        .statHint {
          margin-top: 8px;
          color: #94a3b8;
          font-size: 12px;
          font-weight: 700;
        }

        .gridTwo {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 22px;
          margin-bottom: 22px;
        }

        .panelHead h2 {
          margin: 0;
          font-size: 21px;
          color: #0f172a;
        }

        .panelHead p {
          margin: 6px 0 16px;
          color: #64748b;
          font-size: 14px;
        }

        .tableWrap {
          overflow-x: auto;
          max-height: 520px;
          overflow-y: auto;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          min-width: 1000px;
        }

        th {
          text-align: left;
          color: #475569;
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: .4px;
          padding: 12px;
          border-bottom: 1px solid #e2e8f0;
          background: #f8fafc;
          position: sticky;
          top: 0;
          z-index: 2;
        }

        td {
          padding: 12px;
          border-bottom: 1px solid #e2e8f0;
          font-size: 13px;
          color: #0f172a;
        }

        tr:hover td {
          background: #f8fafc;
        }

        .strong {
          color: #2563eb;
          font-weight: 950;
        }

        .riskBadge {
          color: #fff;
          padding: 6px 10px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 950;
        }

        .errorBox {
          color: #dc2626;
          font-weight: 800;
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(5px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @media (max-width: 1200px) {
          .statGrid {
            grid-template-columns: repeat(3, 1fr);
          }

          .gridTwo {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 700px) {
          .hero,
          .statGrid {
            grid-template-columns: 1fr;
            display: grid;
          }
        }
      `}</style>
    </div>
  );
}

function ChartPanel({ title, subtitle, children }) {
  return (
    <div className="panel">
      <div className="panelHead">
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </div>
      {children}
    </div>
  );
}