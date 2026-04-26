import { useEffect, useMemo, useState } from "react";
import api from "../utils/api.js";

export default function AdminDashboard() {
  const [pipelines, setPipelines] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const res = await api.get("/pipelines-with-risk?limit=100");
        setPipelines(Array.isArray(res.data) ? res.data : []);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  const stats = useMemo(() => {
    const total = pipelines.length;
    const highRisk = pipelines.filter((p) => p.risk_level === "High").length;
    const mediumRisk = pipelines.filter((p) => p.risk_level === "Medium").length;
    const lowRisk = pipelines.filter((p) => p.risk_level === "Low").length;
    const leaks = pipelines.reduce(
      (sum, p) => sum + Number(p.previous_leak_count || 0),
      0
    );

    return { total, highRisk, mediumRisk, lowRisk, leaks };
  }, [pipelines]);

  const adminName = localStorage.getItem("waterflow_user") || "Administrator";

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <p style={styles.badge}>ADMIN CONTROL CENTER</p>
          <h1 style={styles.title}>PipeGuard Admin Dashboard</h1>
          <p style={styles.subtitle}>
            Welcome back, {adminName}. Manage system overview, pipeline risk,
            users, reports and maintenance performance.
          </p>
        </div>

        <div style={styles.profileCard}>
          <div style={styles.avatar}>A</div>
          <div>
            <strong>{adminName}</strong>
            <p style={{ margin: 0, color: "#64748b" }}>System Administrator</p>
          </div>
        </div>
      </div>

      <div style={styles.grid}>
        <Card label="Total Pipelines" value={loading ? "..." : stats.total} color="#0284c7" />
        <Card label="High Risk" value={loading ? "..." : stats.highRisk} color="#dc2626" />
        <Card label="Medium Risk" value={loading ? "..." : stats.mediumRisk} color="#d97706" />
        <Card label="Total Leak Records" value={loading ? "..." : stats.leaks} color="#0f766e" />
      </div>

      <div style={styles.contentGrid}>
        <section style={styles.panel}>
          <div style={styles.panelHeader}>
            <h2>Risk Summary</h2>
            <span style={styles.smallBadge}>Live Data</span>
          </div>

          <div style={styles.riskList}>
            <RiskRow label="High Risk Pipelines" value={stats.highRisk} color="#dc2626" />
            <RiskRow label="Medium Risk Pipelines" value={stats.mediumRisk} color="#d97706" />
            <RiskRow label="Low Risk Pipelines" value={stats.lowRisk} color="#16a34a" />
          </div>
        </section>

        <section style={styles.panel}>
          <div style={styles.panelHeader}>
            <h2>Admin Actions</h2>
            <span style={styles.smallBadge}>Management</span>
          </div>

          <div style={styles.actionGrid}>
            <Action title="Manage Engineers" text="Add, remove or monitor engineer accounts." />
            <Action title="Review Alerts" text="Check high risk and repeated leak warnings." />
            <Action title="Approve Maintenance" text="Review scheduled repair and inspection work." />
            <Action title="Generate Reports" text="Prepare pipeline risk and maintenance reports." />
          </div>
        </section>
      </div>

      <section style={styles.panel}>
        <div style={styles.panelHeader}>
          <h2>Recent High Risk Pipelines</h2>
          <span style={styles.smallBadge}>Priority List</span>
        </div>

        <div style={styles.table}>
          <div style={styles.tableHead}>
            <span>Pipeline ID</span>
            <span>Area</span>
            <span>Risk</span>
            <span>Leaks</span>
          </div>

          {pipelines
            .filter((p) => p.risk_level === "High")
            .slice(0, 6)
            .map((p) => (
              <div style={styles.tableRow} key={p.pipeline_id}>
                <span>{p.pipeline_id}</span>
                <span>{p.area_name || "Unknown"}</span>
                <span style={styles.dangerText}>{p.risk_level}</span>
                <span>{p.previous_leak_count || 0}</span>
              </div>
            ))}

          {!loading && pipelines.filter((p) => p.risk_level === "High").length === 0 && (
            <p style={{ color: "#64748b" }}>No high risk pipelines found.</p>
          )}
        </div>
      </section>
    </div>
  );
}

function Card({ label, value, color }) {
  return (
    <div style={styles.card}>
      <p style={styles.cardLabel}>{label}</p>
      <h2 style={{ ...styles.cardValue, color }}>{value}</h2>
    </div>
  );
}

function RiskRow({ label, value, color }) {
  return (
    <div style={styles.riskRow}>
      <span>{label}</span>
      <strong style={{ color }}>{value}</strong>
    </div>
  );
}

function Action({ title, text }) {
  return (
    <div style={styles.actionCard}>
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}

const styles = {
  page: {
    padding: "34px",
    background: "#f8fafc",
    minHeight: "100vh",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    gap: "24px",
    alignItems: "center",
    marginBottom: "28px",
  },
  badge: {
    color: "#0284c7",
    fontWeight: 900,
    letterSpacing: "1.5px",
    margin: "0 0 8px",
    fontSize: "13px",
  },
  title: {
    margin: 0,
    color: "#0f172a",
    fontSize: "38px",
    fontWeight: 900,
  },
  subtitle: {
    marginTop: "10px",
    color: "#64748b",
    maxWidth: "720px",
    lineHeight: 1.6,
  },
  profileCard: {
    background: "#fff",
    padding: "16px 20px",
    borderRadius: "20px",
    display: "flex",
    alignItems: "center",
    gap: "14px",
    boxShadow: "0 12px 30px rgba(15,23,42,0.08)",
  },
  avatar: {
    width: "48px",
    height: "48px",
    borderRadius: "16px",
    background: "linear-gradient(135deg,#0284c7,#0f766e)",
    color: "#fff",
    display: "grid",
    placeItems: "center",
    fontWeight: 900,
    fontSize: "20px",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(160px, 1fr))",
    gap: "18px",
    marginBottom: "22px",
  },
  card: {
    background: "#fff",
    borderRadius: "22px",
    padding: "22px",
    boxShadow: "0 12px 30px rgba(15,23,42,0.08)",
    border: "1px solid #e2e8f0",
  },
  cardLabel: {
    margin: 0,
    color: "#64748b",
    fontWeight: 800,
    fontSize: "13px",
  },
  cardValue: {
    margin: "12px 0 0",
    fontSize: "34px",
    fontWeight: 950,
  },
  contentGrid: {
    display: "grid",
    gridTemplateColumns: "0.8fr 1.2fr",
    gap: "22px",
    marginBottom: "22px",
  },
  panel: {
    background: "#fff",
    borderRadius: "24px",
    padding: "24px",
    boxShadow: "0 12px 30px rgba(15,23,42,0.08)",
    border: "1px solid #e2e8f0",
  },
  panelHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "18px",
  },
  smallBadge: {
    background: "#e0f2fe",
    color: "#0369a1",
    padding: "7px 12px",
    borderRadius: "999px",
    fontSize: "12px",
    fontWeight: 900,
  },
  riskList: {
    display: "grid",
    gap: "14px",
  },
  riskRow: {
    display: "flex",
    justifyContent: "space-between",
    padding: "16px",
    background: "#f8fafc",
    borderRadius: "16px",
    fontWeight: 800,
    color: "#334155",
  },
  actionGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "14px",
  },
  actionCard: {
    padding: "16px",
    background: "#f8fafc",
    borderRadius: "18px",
    border: "1px solid #e2e8f0",
  },
  table: {
    display: "grid",
    gap: "10px",
  },
  tableHead: {
    display: "grid",
    gridTemplateColumns: "1fr 1.5fr 1fr 1fr",
    padding: "12px 16px",
    color: "#64748b",
    fontWeight: 900,
    fontSize: "13px",
  },
  tableRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1.5fr 1fr 1fr",
    padding: "15px 16px",
    background: "#f8fafc",
    borderRadius: "14px",
    fontWeight: 800,
    color: "#334155",
  },
  dangerText: {
    color: "#dc2626",
    fontWeight: 900,
  },
};