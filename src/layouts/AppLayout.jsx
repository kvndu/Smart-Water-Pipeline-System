import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";

export default function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [alert, setAlert] = useState(null);

  const isDashboard =
    location.pathname === "/dashboard" || location.pathname === "/admin-dashboard";

  // Expose a global method to trigger a mock alert for demo purposes
  useEffect(() => {
    window.triggerMockAlert = () => {
      const risks = ["HIGH", "CRITICAL"];
      const messages = [
        "Sudden pressure drop detected in Zone WAT-2.",
        "Acoustic sensor triggered possible leak in CI main.",
        "High vibration reported on Pipeline #948.",
        "Maintenance overdue for critical asset.",
      ];
      
      setAlert({
        id: Date.now(),
        risk: risks[Math.floor(Math.random() * risks.length)],
        message: messages[Math.floor(Math.random() * messages.length)],
        time: new Date().toLocaleTimeString(),
      });

      // Auto clear after 6 seconds
      setTimeout(() => setAlert(null), 6000);
    };
  }, []);

  return (
    <div style={{ minHeight: "100vh", background: "#eef6fb", position: "relative" }}>
      {!isDashboard && (
        <div style={{ padding: "16px 32px 0" }}>
          <button className="backBtn" onClick={() => navigate(-1)}>
            ← Back
          </button>
        </div>
      )}

      {/* Global Alert Toaster */}
      {alert && (
        <div
          style={{
            position: "fixed",
            top: "24px",
            right: "24px",
            background: "white",
            borderLeft: `6px solid ${alert.risk === "CRITICAL" ? "#dc2626" : "#f59e0b"}`,
            borderRadius: "12px",
            padding: "16px 20px",
            boxShadow: "0 20px 40px rgba(0,0,0,0.15)",
            zIndex: 9999,
            animation: "slideInRight 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards",
            minWidth: "300px"
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px" }}>
            <div>
              <strong style={{ display: "block", color: "#123047", fontSize: "15px", marginBottom: "4px" }}>
                {alert.risk === "CRITICAL" ? "🚨 Critical Alert!" : "⚠️ High Priority Alert"}
              </strong>
              <p style={{ margin: 0, color: "#5f7688", fontSize: "13px", lineHeight: 1.4 }}>
                {alert.message}
              </p>
              <small style={{ color: "#8aa1af", fontSize: "11px", display: "block", marginTop: "8px" }}>
                {alert.time}
              </small>
            </div>
            <button
              onClick={() => setAlert(null)}
              style={{ background: "transparent", border: "none", color: "#8aa1af", fontSize: "16px", cursor: "pointer", padding: 0 }}
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Hidden button for keyboard shortcut triggering if needed by the student during Viva */}
      <button 
        onClick={() => window.triggerMockAlert()} 
        style={{ position: "fixed", bottom: "20px", right: "20px", opacity: 0.1, zIndex: 9999, borderRadius: "50%", width: "30px", height: "30px", background: "red", border: "none", cursor: "pointer" }}
        title="Secret demo trigger"
      />

      <Outlet />

      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}