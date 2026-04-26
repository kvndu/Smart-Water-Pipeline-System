import { Outlet } from "react-router-dom";

export default function AppLayout() {
  return (
    <div style={{ minHeight: "100vh", background: "#eef6fb" }}>
      <Outlet />
    </div>
  );
}