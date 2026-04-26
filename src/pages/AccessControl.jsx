import { useMemo, useState } from "react";

const initialUsers = [
  {
    id: "USR-001",
    name: "System Admin",
    email: "admin@waterflow.com",
    role: "Administrator",
    status: "Active",
    permissions: ["Admin Dashboard", "Engineer Management", "System Issues", "Access Control"],
  },
  {
    id: "USR-002",
    name: "Field Engineer",
    email: "engineer@waterflow.com",
    role: "Engineer",
    status: "Active",
    permissions: ["Dashboard", "Pipelines", "Alerts", "Maintenance", "Reports"],
  },
];

const permissionOptions = [
  "Admin Dashboard",
  "Engineer Management",
  "System Issues",
  "Access Control",
  "Dashboard",
  "Pipelines",
  "Alerts",
  "Maintenance",
  "Risk Calculator",
  "Reports",
];

export default function AccessControl() {
  const [users, setUsers] = useState(initialUsers);
  const [search, setSearch] = useState("");

  const filteredUsers = useMemo(() => {
    const keyword = search.toLowerCase();

    return users.filter(
      (user) =>
        user.name.toLowerCase().includes(keyword) ||
        user.email.toLowerCase().includes(keyword) ||
        user.role.toLowerCase().includes(keyword) ||
        user.status.toLowerCase().includes(keyword)
    );
  }, [users, search]);

  const stats = useMemo(() => {
    return {
      total: users.length,
      admins: users.filter((u) => u.role === "Administrator").length,
      engineers: users.filter((u) => u.role === "Engineer").length,
      active: users.filter((u) => u.status === "Active").length,
    };
  }, [users]);

  const updateUser = (id, field, value) => {
    setUsers((prev) =>
      prev.map((user) =>
        user.id === id ? { ...user, [field]: value } : user
      )
    );
  };

  const togglePermission = (id, permission) => {
    setUsers((prev) =>
      prev.map((user) => {
        if (user.id !== id) return user;

        const hasPermission = user.permissions.includes(permission);

        return {
          ...user,
          permissions: hasPermission
            ? user.permissions.filter((p) => p !== permission)
            : [...user.permissions, permission],
        };
      })
    );
  };

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <p style={styles.badge}>ADMIN MODULE</p>
          <h1 style={styles.title}>Access Control</h1>
          <p style={styles.subtitle}>
            Manage user roles, account status, and page access permissions.
          </p>
        </div>

        <div style={styles.headerBox}>
          <div style={styles.headerIcon}>🔐</div>
          <div>
            <strong>Role Security</strong>
            <p style={styles.headerText}>Permission management</p>
          </div>
        </div>
      </div>

      <div style={styles.statsGrid}>
        <StatCard label="Total Users" value={stats.total} color="#0284c7" />
        <StatCard label="Admins" value={stats.admins} color="#7c3aed" />
        <StatCard label="Engineers" value={stats.engineers} color="#0f766e" />
        <StatCard label="Active Accounts" value={stats.active} color="#16a34a" />
      </div>

      <section style={styles.card}>
        <div style={styles.tableTop}>
          <div>
            <h2 style={styles.cardTitle}>User Permission List</h2>
            <p style={styles.tableSub}>
              Change roles, disable accounts, and control what pages each user can access.
            </p>
          </div>

          <input
            placeholder="Search user..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={styles.search}
          />
        </div>

        <div style={styles.userList}>
          {filteredUsers.map((user) => (
            <div key={user.id} style={styles.userCard}>
              <div style={styles.userTop}>
                <div style={styles.avatar}>{user.role === "Administrator" ? "A" : "E"}</div>

                <div style={{ flex: 1 }}>
                  <h3 style={styles.userName}>{user.name}</h3>
                  <p style={styles.email}>{user.email}</p>
                  <p style={styles.id}>{user.id}</p>
                </div>

                <span
                  style={{
                    ...styles.statusBadge,
                    ...(user.status === "Active"
                      ? styles.activeStatus
                      : styles.inactiveStatus),
                  }}
                >
                  {user.status}
                </span>
              </div>

              <div style={styles.controls}>
                <label style={styles.labelWrap}>
                  <span style={styles.label}>Role</span>
                  <select
                    value={user.role}
                    onChange={(e) => updateUser(user.id, "role", e.target.value)}
                    style={styles.input}
                  >
                    <option value="Administrator">Administrator</option>
                    <option value="Engineer">Engineer</option>
                  </select>
                </label>

                <label style={styles.labelWrap}>
                  <span style={styles.label}>Account Status</span>
                  <select
                    value={user.status}
                    onChange={(e) =>
                      updateUser(user.id, "status", e.target.value)
                    }
                    style={styles.input}
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </label>
              </div>

              <div style={styles.permissionBox}>
                <h4 style={styles.permissionTitle}>Page Permissions</h4>

                <div style={styles.permissionGrid}>
                  {permissionOptions.map((permission) => {
                    const checked = user.permissions.includes(permission);

                    return (
                      <label
                        key={permission}
                        style={{
                          ...styles.permissionItem,
                          ...(checked ? styles.permissionActive : {}),
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => togglePermission(user.id, permission)}
                        />
                        <span>{permission}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}

          {filteredUsers.length === 0 && (
            <div style={styles.empty}>No user accounts found.</div>
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
    alignItems: "center",
    gap: "24px",
    marginBottom: "24px",
  },
  badge: {
    margin: "0 0 8px",
    color: "#0284c7",
    fontWeight: 900,
    letterSpacing: "1.5px",
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
  headerBox: {
    background: "#ffffff",
    padding: "16px 18px",
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
    margin: 0,
    color: "#64748b",
    fontSize: "13px",
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(150px, 1fr))",
    gap: "18px",
    marginBottom: "22px",
  },
  statCard: {
    background: "#ffffff",
    borderRadius: "22px",
    padding: "22px",
    boxShadow: "0 12px 30px rgba(15,23,42,0.08)",
    border: "1px solid #e2e8f0",
  },
  statLabel: {
    margin: 0,
    color: "#64748b",
    fontWeight: 800,
    fontSize: "13px",
  },
  statValue: {
    margin: "12px 0 0",
    fontSize: "34px",
    fontWeight: 950,
  },
  card: {
    background: "#ffffff",
    borderRadius: "24px",
    padding: "24px",
    boxShadow: "0 12px 30px rgba(15,23,42,0.08)",
    border: "1px solid #e2e8f0",
  },
  tableTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "16px",
    marginBottom: "20px",
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
  search: {
    width: "270px",
    padding: "13px 14px",
    borderRadius: "14px",
    border: "1px solid #cbd5e1",
    outline: "none",
    background: "#f8fafc",
    fontWeight: 700,
  },
  userList: {
    display: "grid",
    gap: "18px",
  },
  userCard: {
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: "22px",
    padding: "20px",
  },
  userTop: {
    display: "flex",
    alignItems: "center",
    gap: "14px",
    marginBottom: "18px",
  },
  avatar: {
    width: "52px",
    height: "52px",
    borderRadius: "16px",
    background: "linear-gradient(135deg, #0284c7, #0f766e)",
    color: "#ffffff",
    display: "grid",
    placeItems: "center",
    fontSize: "22px",
    fontWeight: 900,
  },
  userName: {
    margin: 0,
    color: "#0f172a",
    fontSize: "20px",
    fontWeight: 900,
  },
  email: {
    margin: "4px 0 0",
    color: "#64748b",
    fontWeight: 700,
    fontSize: "13px",
  },
  id: {
    margin: "4px 0 0",
    color: "#0284c7",
    fontWeight: 900,
    fontSize: "12px",
  },
  statusBadge: {
    padding: "8px 12px",
    borderRadius: "999px",
    fontSize: "12px",
    fontWeight: 900,
  },
  activeStatus: {
    background: "#dcfce7",
    color: "#166534",
  },
  inactiveStatus: {
    background: "#fee2e2",
    color: "#991b1b",
  },
  controls: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "14px",
    marginBottom: "18px",
  },
  labelWrap: {
    display: "grid",
    gap: "7px",
  },
  label: {
    color: "#334155",
    fontSize: "13px",
    fontWeight: 900,
  },
  input: {
    width: "100%",
    padding: "13px 14px",
    borderRadius: "14px",
    border: "1px solid #cbd5e1",
    outline: "none",
    background: "#ffffff",
    boxSizing: "border-box",
    fontWeight: 700,
    color: "#0f172a",
  },
  permissionBox: {
    background: "#ffffff",
    borderRadius: "18px",
    padding: "16px",
    border: "1px solid #e2e8f0",
  },
  permissionTitle: {
    margin: "0 0 12px",
    color: "#0f172a",
    fontSize: "15px",
    fontWeight: 900,
  },
  permissionGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(160px, 1fr))",
    gap: "10px",
  },
  permissionItem: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "10px 12px",
    borderRadius: "12px",
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    color: "#475569",
    fontWeight: 800,
    fontSize: "13px",
    cursor: "pointer",
  },
  permissionActive: {
    background: "#e0f2fe",
    border: "1px solid #7dd3fc",
    color: "#0369a1",
  },
  empty: {
    padding: "24px",
    textAlign: "center",
    color: "#64748b",
    background: "#f8fafc",
    borderRadius: "16px",
    fontWeight: 800,
  },
};