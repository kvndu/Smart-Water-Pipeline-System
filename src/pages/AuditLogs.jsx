import { useEffect, useMemo, useState } from "react";
import { fetchAuditLogs } from "../utils/databaseService";

export default function AuditLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Load audit logs from Supabase on mount
  useEffect(() => {
    async function loadLogs() {
      try {
        setLoading(true);
        const data = await fetchAuditLogs();
        setLogs(data);
      } catch (err) {
        console.error("Failed to load audit logs:", err);
        setLogs([]);
      } finally {
        setLoading(false);
      }
    }

    loadLogs();
  }, []);

  const filteredLogs = useMemo(() => {
    const keyword = search.toLowerCase();

    return logs.filter(
      (log) =>
        (log.user_name || "").toLowerCase().includes(keyword) ||
        (log.action || "").toLowerCase().includes(keyword) ||
        (log.module || "").toLowerCase().includes(keyword) ||
        (log.status || "").toLowerCase().includes(keyword)
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
            All logs are stored in and loaded from Supabase.
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
              Monitor login activity, user actions, and system operations — powered by Supabase.
            </p>
          </div>

          <input
            placeholder="Search logs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={styles.search}
          />
        </div>

        {loading ? (
          <div style={styles.empty}>Loading audit logs from database...</div>
        ) : (
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
                  <strong>{log.user_name}</strong>
                  <p style={styles.small}>{log.role}</p>
                </div>

                <span>{log.action}</span>
                <span>{log.module}</span>

                <div>
                  <strong>{log.created_at ? new Date(log.created_at).toLocaleDateString() : "N/A"}</strong>
                  <p style={styles.smallLight}>
                    {log.created_at ? new Date(log.created_at).toLocaleTimeString() : ""}
                  </p>
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
        )}
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
    display: "flex",
    alignItems: "center",
    gap: "14px",
    boxShadow: "0 12px 30px rgba(15,23,42,0.08)",
    border: "1px solid #e2e8f0",
  },
  headerIcon: {
    width: "48px",
    height: "48px",
    borderRadius: "16px",
    background: "linear-gradient(135deg, #0284c7, #0f766e)",
    display: "grid",
    placeItems: "center",
    fontSize: "23px",
  },
  headerText: {
    fontSize: "12px",
    color: "#64748b",
    margin: 0,
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
    boxShadow: "0 12px 30px rgba(15,23,42,0.08)",
    border: "1px solid #e2e8f0",
  },
  statLabel: {
    color: "#64748b",
    margin: 0,
    fontWeight: 800,
    fontSize: "13px",
  },
  statValue: {
    fontSize: "28px",
    fontWeight: 900,
    margin: "12px 0 0",
  },
  card: {
    background: "#fff",
    padding: "20px",
    borderRadius: "20px",
    boxShadow: "0 12px 30px rgba(15,23,42,0.08)",
    border: "1px solid #e2e8f0",
  },
  tableTop: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: "16px",
  },
  cardTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: "22px",
    fontWeight: 900,
  },
  tableSub: {
    margin: "6px 0 0",
    color: "#64748b",
    fontSize: "14px",
  },
  tableHead: {
    display: "grid",
    gridTemplateColumns: "1fr 2fr 2fr 1.5fr 1.5fr 1fr",
    fontWeight: 900,
    color: "#64748b",
    padding: "12px 16px",
  },
  tableRow: {
    display: "grid",
    gridTemplateColumns: "1fr 2fr 2fr 1.5fr 1.5fr 1fr",
    padding: "12px 16px",
    borderBottom: "1px solid #eee",
    alignItems: "center",
  },
  id: {
    color: "#0284c7",
    fontWeight: 900,
  },
  small: {
    fontSize: "12px",
    color: "#64748b",
    margin: "4px 0 0",
  },
  smallLight: {
    fontSize: "11px",
    color: "#94a3b8",
    margin: "4px 0 0",
  },
  status: {
    padding: "6px 10px",
    borderRadius: "10px",
    textAlign: "center",
    fontWeight: 900,
    fontSize: "12px",
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
    padding: "10px 14px",
    borderRadius: "14px",
    border: "1px solid #cbd5e1",
    outline: "none",
    fontWeight: 700,
    width: "270px",
    background: "#f8fafc",
  },
  empty: {
    textAlign: "center",
    padding: "20px",
    color: "#64748b",
    fontWeight: 800,
  },
  table: {
    minWidth: "900px",
  },
};