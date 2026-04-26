import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import AppLayout from "./layouts/AppLayout.jsx";

import Login from "./pages/Login.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import AdminDashboard from "./pages/AdminDashboard.jsx";
import EngineerManagement from "./pages/EngineerManagement.jsx";
import SystemIssues from "./pages/SystemIssues.jsx";
import AccessControl from "./pages/AccessControl.jsx";
import AuditLogs from "./pages/AuditLogs.jsx";

import Analytics from "./pages/Analytics.jsx";
import Reports from "./pages/Reports.jsx";
import Pipelines from "./pages/Pipelines.jsx";
import Alerts from "./pages/Alerts.jsx";
import Maintenance from "./pages/Maintenance.jsx";
import SystemHub from "./pages/SystemHub.jsx";
import RiskCalculator from "./pages/RiskCalculator";
import PipelineDetail from "./pages/PipelineDetail.jsx";
import MapView from "./pages/MapView.jsx";
import PipelineNetworkView from "./pages/PipelineNetworkView.jsx";

function ProtectedRoute({ children }) {
  const isAuth = localStorage.getItem("waterflow_auth") === "true";
  return isAuth ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/login" element={<Login />} />

        {/* Protected */}
        <Route
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/" element={<Navigate to="/dashboard" replace />} />

          {/* Engineer */}
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/pipelines" element={<Pipelines />} />
          <Route path="/pipelines/:id" element={<PipelineDetail />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/alerts" element={<Alerts />} />
          <Route path="/maintenance" element={<Maintenance />} />
          <Route path="/risk-calculator" element={<RiskCalculator />} />
          <Route path="/map-view" element={<MapView />} />
          <Route path="/pipeline-network" element={<PipelineNetworkView />} />
          <Route path="/system-hub" element={<SystemHub />} />
          <Route
            path="/decision-hub"
            element={<Navigate to="/system-hub" replace />}
          />

          {/* Admin */}
          <Route path="/admin-dashboard" element={<AdminDashboard />} />
          <Route path="/engineer-management"element={<EngineerManagement />} /> 
          <Route path="/system-issues" element={<SystemIssues />} />
          <Route path="/access-control" element={<AccessControl />} />
          <Route path="/audit-logs" element={<AuditLogs />} />
        </Route>

        {/* Unknown */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}