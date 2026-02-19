import { NavLink } from "react-router-dom";

function Item({ to, icon, label }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) => `navItem ${isActive ? "active" : ""}`}
    >
      <span className="navIcon">{icon}</span>
      <span>{label}</span>
    </NavLink>
  );
}

export default function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brandIcon">💧</div>
        <div>
          <div className="brandName">WaterFlow</div>
          <div className="brandSub">Smart Pipeline System</div>
        </div>
      </div>

      <nav className="nav">
        <Item to="/dashboard" icon="📊" label="Dashboard" />
        <Item to="/pipelines" icon="🧱" label="Pipelines" />
        <Item to="/analytics" icon="📈" label="Analytics" />
        <Item to="/alerts" icon="🚨" label="Alerts" />
      </nav>

      <div className="sidebarFooter">
        <div className="small">Dataset-based • No AI</div>
      </div>
    </aside>
  );
}
