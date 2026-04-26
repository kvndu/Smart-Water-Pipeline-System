import { useMemo, useState } from "react";

const initialLogs = [
  {
    id: "LOG-001",
    user: "System Admin",
    role: "Administrator",
    action: "Logged into system",
    module: "Authentication",
    date: "2026-04-25",
    time: "09:10 AM",
    status: "Success",
  },
  {
    id: "LOG-002",
    user: "System Admin",
    role: "Administrator",
    action: "Created engineer account",
    module: "Engineer Management",
    date: "2026-04-25",
    time: "09:25 AM",
    status: "Success",
  },
  {
    id: "LOG-003",
    user: "Field Engineer",
    role: "Engineer",
    action: "Updated pipeline data",
    module: "Pipelines",
    date: "2026-04-25",
    time: "10:05 AM",
    status: "Success",
  },
  {
    id: "LOG-004",
    user: "System Admin",
    role: "Administrator",
    action: "Resolved system issue",
    module: "System Issues",
    date: "2026-04-25",
    time: "10:30 AM",
    status: "Success",
  },
  {
    id: "LOG-005",
    user: "Unknown User",
    role: "Unknown",
    action: "Failed login attempt",
    module: "Authentication",
    date: "2026-04-25",
    time: "11:02 AM",
    status: "Failed",
  },
];

export default function AuditLogs() {
  const [logs, setLogs] = useState(initialLogs);
  const [search, setSearch] = useState("");

  const filteredLogs = useMemo(() => {
    const keyword = search.toLowerCase();

    return logs.filter(
      (log) =>
        log.user.toLowerCase().includes(keyword) ||
        log.action.toLowerCase().includes(keyword) ||
        log.module.toLowerCase().includes(keyword) ||
        log.status.toLowerCase().includes(keyword)
    );
  }, [logs, search]);

  const stats = useMemo(() => {
    return {
      total: logs.length,
      success: logs.filter((l) => l.status === "Success").length,
      failed: logs.filter((l) => l.status === "Failed").length,
    };
  }, [logs]);

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <p style={styles.badge}>ADMIN MODULE</p>
          <h1 style={styles.title}>Audit Logs</h1>
          <p style={styles.subtitle}>
            Track all user activities, system actions, and security events.
          </p>
        </div>

        <div style={styles.headerBox}>
          <div style={styles.headerIcon}>📊</div>
          <div>
            <strong>System Tracking</strong>
            <p style={styles.headerText}>Activity monitoring</p>
          </div>
        </div>
      </div>

      <div style={styles.statsGrid}>
        <StatCard label="Total Logs" value={stats.total} color="#0284c7" />
        <StatCard label="Success Actions" value={stats.success} color="#16a34a" />
        <StatCard label="Failed Attempts" value={stats.failed} color="#dc2626" />
      </div>

      <section style={styles.card}>
        <div style={styles.tableTop}>
          <div>
            <h2 style={styles.cardTitle}>System Activity Logs</h2>
            <p style={styles.tableSub}>
              Monitor login activity, user actions, and system operations.
            </p>
          </div>

          <input
            placeholder="Search logs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={styles.search}
          />
        </div>

        <div style={styles.table}>
          <div style={styles.tableHead}>
            <span>ID</span>
            <span>User</span>
            <span>Action</span>
            <span>Module</span>
            <span>Date & Time</span>
            <span>Status</span>
          </div>

          {filteredLogs.map((log) => (
            <div style={styles.tableRow} key={log.id}>
              <span style={styles.id}>{log.id}</span>

              <div>
                <strong>{log.user}</strong>
                <p style={styles.small}>{log.role}</p>
              </div>

              <span>{log.action}</span>
              <span>{log.module}</span>

              <div>
                <strong>{log.date}</strong>
                <p style={styles.smallLight}>{log.time}</p>
              </div>

              <span
                style={{
                  ...styles.status,
                  ...(log.status === "Success"
                    ? styles.success
                    : styles.failed),
                }}
              >
                {log.status}
              </span>
            </div>
          ))}

          {filteredLogs.length === 0 && (
            <div style={styles.empty}>No logs found.</div>
          )}
        </div>
      </section>
    </div>
  );
}

function StatCard({ label, value, color }) {
  return (
    <div style={styles.statCard}>
      <p style={styles.statLabel}>{label}</p>
      <h2 style={{ ...styles.statValue, color }}>{value}</h2>
    </div>
  );
}

const styles = {
  page: {
    padding: "34px",
    minHeight: "100vh",
    background: "linear-gradient(180deg, #f8fafc 0%, #eef6fb 100%)",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: "24px",
  },
  badge: {
    color: "#0284c7",
    fontWeight: 900,
    fontSize: "13px",
  },
  title: {
    fontSize: "38px",
    fontWeight: 900,
  },
  subtitle: {
    color: "#64748b",
  },
  headerBox: {
    background: "#fff",
    padding: "16px",
    borderRadius: "20px",
  },
  headerIcon: {
    fontSize: "24px",
  },
  headerText: {
    fontSize: "12px",
    color: "#64748b",
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: "18px",
    marginBottom: "20px",
  },
  statCard: {
    background: "#fff",
    padding: "20px",
    borderRadius: "20px",
  },
  statLabel: {
    color: "#64748b",
  },
  statValue: {
    fontSize: "28px",
    fontWeight: 900,
  },
  card: {
    background: "#fff",
    padding: "20px",
    borderRadius: "20px",
  },
  tableTop: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: "16px",
  },
  tableHead: {
    display: "grid",
    gridTemplateColumns: "1fr 2fr 2fr 1.5fr 1.5fr 1fr",
    fontWeight: 900,
    color: "#64748b",
  },
  tableRow: {
    display: "grid",
    gridTemplateColumns: "1fr 2fr 2fr 1.5fr 1.5fr 1fr",
    padding: "12px 0",
    borderBottom: "1px solid #eee",
  },
  id: {
    color: "#0284c7",
    fontWeight: 900,
  },
  small: {
    fontSize: "12px",
    color: "#64748b",
  },
  smallLight: {
    fontSize: "11px",
    color: "#94a3b8",
  },
  status: {
    padding: "6px 10px",
    borderRadius: "10px",
    textAlign: "center",
    fontWeight: 900,
  },
  success: {
    background: "#dcfce7",
    color: "#166534",
  },
  failed: {
    background: "#fee2e2",
    color: "#991b1b",
  },
  search: {
    padding: "10px",
    borderRadius: "10px",
    border: "1px solid #ccc",
  },
  empty: {
    textAlign: "center",
    padding: "20px",
    color: "#64748b",
  },
};