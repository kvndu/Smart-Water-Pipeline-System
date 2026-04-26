import { NavLink, useNavigate } from "react-router-dom";

function NavItem({ to, iconSrc, label, badge }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) => `navItem ${isActive ? "active" : ""}`}
    >
      <div className="navLeft">
        <span
          className="navIcon"
          style={{ "--icon-url": `url(${iconSrc})` }}
        ></span>
        <span className="navLabel">{label}</span>
      </div>

      {badge ? <span className="navBadge">{badge}</span> : null}
    </NavLink>
  );
}

export default function Sidebar({ alertsCount = 0 }) {
  const navigate = useNavigate();

  const role = localStorage.getItem("waterflow_role");
  const isAdmin = role === "Administrator";

  const handleLogout = () => {
    localStorage.removeItem("waterflow_auth");
    localStorage.removeItem("waterflow_role");
    localStorage.removeItem("waterflow_user");
    navigate("/login", { replace: true });
  };

  return (
    <aside className="sidebar">
      <div className="brand">
        <img
          src="/icons/water_treatment.png"
          alt="PipeGuard logo"
          className="brandLogo"
        />

        <div className="brandText">
          <div className="brandTitle">PipeGuard</div>
          <div className="brandSub">
            {isAdmin ? "Admin control system" : "Smart pipeline system"}
          </div>
        </div>
      </div>

      <div className="navSectionTitle">
        {isAdmin ? "ADMIN NAVIGATION" : "MAIN NAVIGATION"}
      </div>

      <nav className="navMenu">
        {isAdmin ? (
          <>
            <NavItem
              to="/admin-dashboard"
              iconSrc="/icons/dashboard.svg"
              label="Admin Dashboard"
            />

            <NavItem
              to="/engineer-management"
              iconSrc="/icons/pipeline.svg"
              label="Engineer Management"
            />

            <NavItem
              to="/system-issues"
              iconSrc="/icons/maintenance.svg"
              label="System Issues"
           />

           <NavItem
              to="/access-control"
              iconSrc="/icons/decision.svg"
              label="Access Control"
           />

           <NavItem
              to="/audit-logs"
              iconSrc="/icons/reports.svg"
              label="Audit Logs"
           />
          </>
        ) : (
          <>
            <NavItem
              to="/dashboard"
              iconSrc="/icons/dashboard.svg"
              label="Overview Dashboard"
            />

            <NavItem
              to="/pipelines"
              iconSrc="/icons/pipeline.svg"
              label="Pipeline Records"
            />

            <NavItem
              to="/alerts"
              iconSrc="/icons/alerts.svg"
              label="Alerts Center"
              badge={alertsCount > 0 ? alertsCount : null}
            />

            <NavItem
              to="/maintenance"
              iconSrc="/icons/maintenance.svg"
              label="Maintenance"
            />

            <NavItem
              to="/risk-calculator"
              iconSrc="/icons/risk-calculator.svg"
              label="Risk Calculator"
            />

            <NavItem
              to="/map-view"
              iconSrc="/icons/map-view.svg"
              label="Map View"
            />

            <NavItem
              to="/pipeline-network"
              iconSrc="/icons/pipeline-network.svg"
              label="Pipeline Network"
            />

            <div className="navSectionTitle" style={{ marginTop: 18 }}>
              ANALYSIS
            </div>

            <NavItem
              to="/analytics"
              iconSrc="/icons/analytics.svg"
              label="Analytics"
            />

            <NavItem
              to="/reports"
              iconSrc="/icons/reports.svg"
              label="Reports"
            />

            <NavItem
              to="/decision-hub"
              iconSrc="/icons/decision.svg"
              label="Decision Hub"
            />
          </>
        )}
      </nav>

      <div className="sidebarFooter">
        <div className="systemStatus">
          <span className="statusDot"></span>
          <span>Online</span>
        </div>

        <button className="logoutBtn" onClick={handleLogout}>
          Logout
        </button>
      </div>
    </aside>
  );
}