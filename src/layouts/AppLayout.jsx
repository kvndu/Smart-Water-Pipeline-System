import { Outlet, useLocation } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import Sidebar from "../components/Sidebar.jsx";

// ✅ Simple Toast component (inline) - no extra file needed
function Toast({ toast, onClose }) {
  if (!toast) return null;

  const typeClass =
    toast.type === "error"
      ? "danger"
      : toast.type === "warning"
      ? "warn"
      : "ok";

  return (
    <div className={`toast ${typeClass}`} role="status">
      <div style={{ fontWeight: 900 }}>{toast.message}</div>
      <button className="toastClose" onClick={onClose} type="button">
        ✕
      </button>
    </div>
  );
}

export default function AppLayout() {
  const location = useLocation();

  
  const [toast, setToast] = useState(null);

  
  const showToast = (message, type = "success") => {
    setToast({ message, type });
   
    window.clearTimeout(window.__toastTimer);
    window.__toastTimer = window.setTimeout(() => setToast(null), 3000);
  };

  
  useEffect(() => {
    setToast(null);
  }, [location.pathname]);

  
  const outletContext = useMemo(() => ({ showToast }), []);

  return (
    <div className="appShell">
      <Sidebar />

      <main className="appMain">
 
        <Toast toast={toast} onClose={() => setToast(null)} />

        
        <Outlet context={outletContext} />
      </main>
    </div>
  );
}
