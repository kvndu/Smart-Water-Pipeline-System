import { NavLink, useNavigate } from "react-router-dom";

function NavItem({ to, icon, label, badge }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `navItem ${isActive ? "active" : ""}`
      }
    >
      <div className="navLeft">
        <span className="navIcon">{icon}</span>
        <span>{label}</span>
      </div>

      {badge ? (
        <span className="navBadge">{badge}</span>
      ) : null}
    </NavLink>
  );
}

export default function Sidebar({ alertsCount = 0 }) {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem("waterflow_auth");
    localStorage.removeItem("waterflow_role");
    navigate("/login");
  };

  return (
    <aside className="sidebar">
      {/* Brand */}
      <div className="brand">
        <div className="brandIcon">💧</div>
        <div>
          <div className="brandName">WaterFlow</div>
          <div className="brandSub">Pipeline Monitoring System</div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="nav">
        <NavItem to="/dashboard" icon="📊" label="Dashboard" />
        <NavItem to="/system-hub" icon="🎯" label="Decision Hub" />
        <NavItem to="/pipelines" icon="🧱" label="Pipelines" />
        <NavItem to="/analytics" icon="📈" label="Analytics" />
        <NavItem to="/reports" icon="📑" label="Reports & Analytics" />
        <NavItem
          to="/alerts"
          icon="🚨"
          label="Alerts"
          badge={alertsCount > 0 ? alertsCount : null}
        />
        <NavItem to="/maintenance" icon="🛠️" label="Maintenance & Operations" />
      </nav>

      {/* Footer */}
      <div className="sidebarFooter">
        <div className="small">
          Status: <span className="statusDot"></span> System Online
        </div>
        <div className="small" style={{ marginTop: 6, marginBottom: 12 }}>
          Dataset-based Monitoring
        </div>
        <button
          onClick={handleLogout}
          style={{
            width: "100%",
            padding: "8px",
            background: "#fef2f2",
            border: "1px solid #fecaca",
            color: "#dc2626",
            borderRadius: "8px",
            fontWeight: 800,
            cursor: "pointer",
            fontSize: "12px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "6px"
          }}
        >
          <span>🚪</span> Logout
        </button>
      </div>
    </aside>
  );
}
