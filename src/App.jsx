import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import AppLayout from "./layouts/AppLayout.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Analytics from "./pages/Analytics.jsx";
import Reports from "./pages/Reports.jsx";
import Pipelines from "./pages/Pipelines.jsx";
import Alerts from "./pages/Alerts.jsx";
import Maintenance from "./pages/Maintenance.jsx";
import Login from "./pages/Login.jsx";
import SystemHub from "./pages/SystemHub.jsx";

function ProtectedRoute({ children }) {
  const isAuth = localStorage.getItem("waterflow_auth") === "true";
  return isAuth ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/system-hub" element={<SystemHub />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/pipelines" element={<Pipelines />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/alerts" element={<Alerts />} />
          <Route path="/maintenance" element={<Maintenance />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
