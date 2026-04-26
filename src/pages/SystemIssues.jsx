import { useMemo, useState } from "react";

const initialIssues = [
  {
    id: "ISS-001",
    title: "Engineer login delay",
    type: "Authentication",
    priority: "High",
    status: "Open",
    reportedBy: "Kasun Perera",
    reportedDate: "2026-04-20",
    description: "Engineer portal takes too long to redirect after login.",
  },
  {
    id: "ISS-002",
    title: "Risk chart not loading",
    type: "Dashboard",
    priority: "Medium",
    status: "In Progress",
    reportedBy: "System Monitor",
    reportedDate: "2026-04-22",
    description: "Analytics chart sometimes fails to render on dashboard.",
  },
  {
    id: "ISS-003",
    title: "Email reset alert not received",
    type: "Email Service",
    priority: "Low",
    status: "Resolved",
    reportedBy: "Admin",
    reportedDate: "2026-04-23",
    description: "Forgot password verification email was delayed.",
  },
];

export default function SystemIssues() {
  const [issues, setIssues] = useState(initialIssues);
  const [search, setSearch] = useState("");

  const [form, setForm] = useState({
    title: "",
    type: "Authentication",
    priority: "Medium",
    status: "Open",
    reportedBy: "",
    reportedDate: "",
    description: "",
  });

  const filteredIssues = useMemo(() => {
    const keyword = search.toLowerCase();

    return issues.filter(
      (issue) =>
        issue.id.toLowerCase().includes(keyword) ||
        issue.title.toLowerCase().includes(keyword) ||
        issue.type.toLowerCase().includes(keyword) ||
        issue.priority.toLowerCase().includes(keyword) ||
        issue.status.toLowerCase().includes(keyword) ||
        issue.reportedBy.toLowerCase().includes(keyword)
    );
  }, [issues, search]);

  const stats = useMemo(() => {
    return {
      total: issues.length,
      open: issues.filter((i) => i.status === "Open").length,
      progress: issues.filter((i) => i.status === "In Progress").length,
      resolved: issues.filter((i) => i.status === "Resolved").length,
    };
  }, [issues]);

  const handleChange = (e) => {
    setForm((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const resetForm = () => {
    setForm({
      title: "",
      type: "Authentication",
      priority: "Medium",
      status: "Open",
      reportedBy: "",
      reportedDate: "",
      description: "",
    });
  };

  const addIssue = (e) => {
    e.preventDefault();

    const newIssue = {
      id: `ISS-${String(issues.length + 1).padStart(3, "0")}`,
      ...form,
    };

    setIssues((prev) => [newIssue, ...prev]);
    resetForm();
  };

  const updateStatus = (id, status) => {
    setIssues((prev) =>
      prev.map((issue) => (issue.id === id ? { ...issue, status } : issue))
    );
  };

  const deleteIssue = (id) => {
    const ok = window.confirm("Are you sure you want to delete this issue?");
    if (!ok) return;

    setIssues((prev) => prev.filter((issue) => issue.id !== id));
  };

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <p style={styles.badge}>ADMIN MODULE</p>
          <h1 style={styles.title}>System Issues</h1>
          <p style={styles.subtitle}>
            Track login problems, system errors, email failures, dashboard bugs
            and technical support issues.
          </p>
        </div>

        <div style={styles.headerBox}>
          <div style={styles.headerIcon}>🛠️</div>
          <div>
            <strong>System Support</strong>
            <p style={styles.headerText}>Admin maintenance center</p>
          </div>
        </div>
      </div>

      <div style={styles.statsGrid}>
        <StatCard label="Total Issues" value={stats.total} color="#0284c7" />
        <StatCard label="Open" value={stats.open} color="#dc2626" />
        <StatCard label="In Progress" value={stats.progress} color="#d97706" />
        <StatCard label="Resolved" value={stats.resolved} color="#16a34a" />
      </div>

      <div style={styles.layout}>
        <section style={styles.formCard}>
          <div style={styles.formHeader}>
            <h2 style={styles.cardTitle}>Report New Issue</h2>
            <span style={styles.formBadge}>Admin Ticket</span>
          </div>

          <form onSubmit={addIssue} style={styles.form}>
            <Input
              label="Issue Title"
              name="title"
              placeholder="Example: Login redirect not working"
              value={form.title}
              onChange={handleChange}
              required
            />

            <div style={styles.twoCol}>
              <Select
                label="Issue Type"
                name="type"
                value={form.type}
                onChange={handleChange}
                options={[
                  "Authentication",
                  "Dashboard",
                  "Email Service",
                  "Database",
                  "API Error",
                  "User Access",
                  "Report Generation",
                  "Other",
                ]}
              />

              <Select
                label="Priority"
                name="priority"
                value={form.priority}
                onChange={handleChange}
                options={["Low", "Medium", "High", "Critical"]}
              />
            </div>

            <div style={styles.twoCol}>
              <Select
                label="Status"
                name="status"
                value={form.status}
                onChange={handleChange}
                options={["Open", "In Progress", "Resolved"]}
              />

              <Input
                label="Reported Date"
                name="reportedDate"
                type="date"
                value={form.reportedDate}
                onChange={handleChange}
                required
              />
            </div>

            <Input
              label="Reported By"
              name="reportedBy"
              placeholder="Admin / Engineer / System Monitor"
              value={form.reportedBy}
              onChange={handleChange}
              required
            />

            <label style={styles.labelWrap}>
              <span style={styles.label}>Description</span>
              <textarea
                name="description"
                placeholder="Describe the system issue..."
                value={form.description}
                onChange={handleChange}
                required
                style={styles.textarea}
              />
            </label>

            <button type="submit" style={styles.primaryBtn}>
              Create Issue Ticket
            </button>
          </form>
        </section>

        <section style={styles.tableCard}>
          <div style={styles.tableTop}>
            <div>
              <h2 style={styles.cardTitle}>Issue Tickets</h2>
              <p style={styles.tableSub}>
                Monitor and update system maintenance issues.
              </p>
            </div>

            <input
              placeholder="Search issue..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={styles.search}
            />
          </div>

          <div style={styles.table}>
            <div style={styles.tableHead}>
              <span>Ticket</span>
              <span>Issue</span>
              <span>Type</span>
              <span>Priority</span>
              <span>Status</span>
              <span>Actions</span>
            </div>

            {filteredIssues.map((issue) => (
              <div style={styles.tableRow} key={issue.id}>
                <span style={styles.id}>{issue.id}</span>

                <div>
                  <strong>{issue.title}</strong>
                  <p style={styles.small}>{issue.description}</p>
                  <p style={styles.smallLight}>
                    Reported by {issue.reportedBy} • {issue.reportedDate}
                  </p>
                </div>

                <span>{issue.type}</span>

                <span
                  style={{
                    ...styles.badgePill,
                    ...getPriorityStyle(issue.priority),
                  }}
                >
                  {issue.priority}
                </span>

                <span
                  style={{
                    ...styles.badgePill,
                    ...getStatusStyle(issue.status),
                  }}
                >
                  {issue.status}
                </span>

                <div style={styles.actions}>
                  <button
                    type="button"
                    onClick={() => updateStatus(issue.id, "In Progress")}
                    style={styles.progressBtn}
                  >
                    Progress
                  </button>

                  <button
                    type="button"
                    onClick={() => updateStatus(issue.id, "Resolved")}
                    style={styles.resolveBtn}
                  >
                    Resolve
                  </button>

                  <button
                    type="button"
                    onClick={() => deleteIssue(issue.id)}
                    style={styles.deleteBtn}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}

            {filteredIssues.length === 0 && (
              <div style={styles.empty}>No system issues found.</div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function Input({
  label,
  name,
  value,
  onChange,
  placeholder,
  type = "text",
  required = false,
}) {
  return (
    <label style={styles.labelWrap}>
      <span style={styles.label}>{label}</span>
      <input
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        type={type}
        required={required}
        style={styles.input}
      />
    </label>
  );
}

function Select({ label, name, value, onChange, options }) {
  return (
    <label style={styles.labelWrap}>
      <span style={styles.label}>{label}</span>
      <select
        name={name}
        value={value}
        onChange={onChange}
        style={styles.input}
      >
        {options.map((option) => (
          <option value={option} key={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
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

function getPriorityStyle(priority) {
  if (priority === "Critical") return { background: "#fee2e2", color: "#7f1d1d" };
  if (priority === "High") return { background: "#ffedd5", color: "#9a3412" };
  if (priority === "Medium") return { background: "#fef3c7", color: "#92400e" };
  return { background: "#dcfce7", color: "#166534" };
}

function getStatusStyle(status) {
  if (status === "Resolved") return { background: "#dcfce7", color: "#166534" };
  if (status === "In Progress") return { background: "#fef3c7", color: "#92400e" };
  return { background: "#fee2e2", color: "#991b1b" };
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
    maxWidth: "760px",
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
  layout: {
    display: "grid",
    gridTemplateColumns: "430px 1fr",
    gap: "22px",
    alignItems: "start",
  },
  formCard: {
    background: "#ffffff",
    borderRadius: "24px",
    padding: "24px",
    boxShadow: "0 12px 30px rgba(15,23,42,0.08)",
    border: "1px solid #e2e8f0",
  },
  tableCard: {
    background: "#ffffff",
    borderRadius: "24px",
    padding: "24px",
    boxShadow: "0 12px 30px rgba(15,23,42,0.08)",
    border: "1px solid #e2e8f0",
    overflowX: "auto",
  },
  formHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "18px",
  },
  cardTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: "22px",
    fontWeight: 900,
  },
  formBadge: {
    background: "#e0f2fe",
    color: "#0369a1",
    padding: "8px 12px",
    borderRadius: "999px",
    fontSize: "12px",
    fontWeight: 900,
  },
  form: {
    display: "grid",
    gap: "12px",
  },
  twoCol: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "12px",
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
    background: "#f8fafc",
    boxSizing: "border-box",
    fontWeight: 700,
    color: "#0f172a",
  },
  textarea: {
    width: "100%",
    minHeight: "95px",
    padding: "13px 14px",
    borderRadius: "14px",
    border: "1px solid #cbd5e1",
    outline: "none",
    background: "#f8fafc",
    boxSizing: "border-box",
    fontWeight: 700,
    color: "#0f172a",
    resize: "vertical",
    fontFamily: "inherit",
  },
  primaryBtn: {
    marginTop: "8px",
    padding: "15px",
    border: "none",
    borderRadius: "14px",
    background: "linear-gradient(135deg, #0284c7, #0f766e)",
    color: "#ffffff",
    fontWeight: 900,
    cursor: "pointer",
    boxShadow: "0 12px 24px rgba(2,132,199,0.22)",
  },
  tableTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "16px",
    marginBottom: "18px",
  },
  tableSub: {
    margin: "6px 0 0",
    color: "#64748b",
    fontSize: "14px",
  },
  search: {
    width: "260px",
    padding: "13px 14px",
    borderRadius: "14px",
    border: "1px solid #cbd5e1",
    outline: "none",
    background: "#f8fafc",
    fontWeight: 700,
  },
  table: {
    display: "grid",
    gap: "10px",
    minWidth: "980px",
  },
  tableHead: {
    display: "grid",
    gridTemplateColumns: "0.7fr 2fr 1.1fr 0.9fr 1fr 1.6fr",
    padding: "12px 16px",
    color: "#64748b",
    fontWeight: 900,
    fontSize: "13px",
  },
  tableRow: {
    display: "grid",
    gridTemplateColumns: "0.7fr 2fr 1.1fr 0.9fr 1fr 1.6fr",
    alignItems: "center",
    padding: "16px",
    background: "#f8fafc",
    borderRadius: "16px",
    color: "#334155",
    fontWeight: 800,
  },
  id: {
    color: "#0284c7",
    fontWeight: 950,
  },
  small: {
    margin: "4px 0 0",
    color: "#64748b",
    fontSize: "13px",
    fontWeight: 600,
    lineHeight: 1.4,
  },
  smallLight: {
    margin: "5px 0 0",
    color: "#94a3b8",
    fontSize: "12px",
    fontWeight: 600,
  },
  badgePill: {
    padding: "8px 10px",
    borderRadius: "999px",
    fontSize: "12px",
    fontWeight: 900,
    textAlign: "center",
  },
  actions: {
    display: "flex",
    gap: "7px",
    flexWrap: "wrap",
  },
  progressBtn: {
    border: "none",
    background: "#fef3c7",
    color: "#92400e",
    padding: "8px 10px",
    borderRadius: "10px",
    fontWeight: 900,
    cursor: "pointer",
  },
  resolveBtn: {
    border: "none",
    background: "#dcfce7",
    color: "#166534",
    padding: "8px 10px",
    borderRadius: "10px",
    fontWeight: 900,
    cursor: "pointer",
  },
  deleteBtn: {
    border: "none",
    background: "#fee2e2",
    color: "#991b1b",
    padding: "8px 10px",
    borderRadius: "10px",
    fontWeight: 900,
    cursor: "pointer",
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