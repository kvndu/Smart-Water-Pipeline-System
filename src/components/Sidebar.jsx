import { NavLink } from "react-router-dom";

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
        <NavItem to="/pipelines" icon="🧱" label="Pipelines" />
        <NavItem to="/analytics" icon="📈" label="Analytics" />
        <NavItem
          to="/alerts"
          icon="🚨"
          label="Alerts"
          badge={alertsCount > 0 ? alertsCount : null}
        />
        <NavItem to="/maintenance" icon="🛠️" label="Maintenance" />
      </nav>

      {/* Footer */}
      <div className="sidebarFooter">
        <div className="small">
          Status: <span className="statusDot"></span> System Online
        </div>
        <div className="small" style={{ marginTop: 6 }}>
          Dataset-based Monitoring
        </div>
      </div>
    </aside>
  );
}
